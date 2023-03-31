/********************************************************************************
 * Copyright (C) 2023 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import * as vscode from 'vscode';
import { DebugProtocol } from '@vscode/debugprotocol';
import { AdapterCapabilities } from './adapter-capabilities';
import { toHexStringWithRadixMarker, VariableRange } from '../../common/memory-range';

type WithChildren<Original> = Original & { children?: Array<WithChildren<DebugProtocol.Variable>> };
type VariablesTree = Record<number, WithChildren<DebugProtocol.Scope | DebugProtocol.Variable>>;

class GdbAdapterTracker implements vscode.DebugAdapterTracker {
    private currentFrame?: number;
    private variablesTree: VariablesTree = {};
    private readonly pendingMessages = new Map<number, number>();
    private static hexAddress = /0x[0-9a-f]+/i;
    private static notADigit = /[^0-9]/;

    constructor(private readonly onEnd: vscode.Disposable) { }

    onWillReceiveMessage(message: unknown): void {
        if (isScopesRequest(message)) {
            this.currentFrame = message.arguments.frameId;
            console.log('Sending a fun scopes request!', message);
        } else if (isVariableRequest(message)) {
            if (message.arguments.variablesReference in this.variablesTree) {
                this.pendingMessages.set(message.seq, message.arguments.variablesReference);
            }
            console.log('Sending a fun variable request!', message);
        }
    }
    onDidSendMessage(message: unknown): void {
        if (isScopesResponse(message)) {
            console.log('Got a fun scope message!', message);
            for (const scope of message.body.scopes) {
                if (scope.name === 'Local') {
                    if (!this.variablesTree[scope.variablesReference] || this.variablesTree[scope.variablesReference].name !== 'Local') {
                        this.variablesTree = { [scope.variablesReference]: { ...scope } };
                    }
                    return;
                }
            }
        } else if (isVariableResponse(message)) {
            if (this.pendingMessages.has(message.request_seq)) {
                const parentReference = this.pendingMessages.get(message.request_seq)!;
                this.pendingMessages.delete(message.request_seq);
                if (parentReference in this.variablesTree) {
                    this.variablesTree[parentReference].children = message.body.variables;
                }
            }
            console.log('Got a fun variable message!', message);
        }
    }
    onExit(): void {
        this.onEnd.dispose();
        this.pendingMessages.clear();
    }

    async getLocals(session: vscode.DebugSession): Promise<VariableRange[]> {
        if (this.currentFrame === undefined) { return []; }
        const maybeRanges = await Promise.all(Object.values(this.variablesTree).reduce<Array<Promise<VariableRange | undefined>>>((previous, parent) => {
            if (parent.name === 'Local' && parent.children?.length) {
                parent.children.forEach(child => {
                    previous.push(this.variableToVariableRange(child, session));
                });
            }
            return previous;
        }, []));
        return maybeRanges.filter((candidate): candidate is VariableRange => !!candidate);
    }

    private async variableToVariableRange(variable: DebugProtocol.Variable, session: vscode.DebugSession): Promise<VariableRange | undefined> {
        if (variable.memoryReference === undefined || this.currentFrame === undefined) { return undefined; }
        try {
            const [addressResponse, sizeResponse] = await Promise.all([
                session.customRequest('evaluate', <DebugProtocol.EvaluateArguments>{ expression: `&(${variable.name})`, context: 'watch', frameId: this.currentFrame }),
                session.customRequest('evaluate', <DebugProtocol.EvaluateArguments>{ expression: `sizeof(${variable.name})`, context: 'watch', frameId: this.currentFrame }),
            ]) as DebugProtocol.EvaluateResponse['body'][];
            const addressPart = GdbAdapterTracker.hexAddress.exec(addressResponse.result);
            if (!addressPart) { return undefined; }
            const startAddress = BigInt(addressPart[0]);
            const endAddress = GdbAdapterTracker.notADigit.test(sizeResponse.result) ? undefined : startAddress + BigInt(sizeResponse.result);
            return {
                name: variable.name,
                startAddress: toHexStringWithRadixMarker(startAddress),
                endAddress: endAddress === undefined ? undefined : toHexStringWithRadixMarker(endAddress),
                value: variable.value,
            };
        } catch (err) {
            return undefined;
        }
    }
}

function isScopesRequest(message: unknown): message is DebugProtocol.ScopesRequest {
    const candidate = message as DebugProtocol.ScopesRequest;
    return !!candidate && candidate.command === 'scopes';
}

function isVariableRequest(message: unknown): message is DebugProtocol.VariablesRequest {
    const candidate = message as DebugProtocol.VariablesRequest;
    return !!candidate && candidate.command === 'variables';
}

function isScopesResponse(message: unknown): message is DebugProtocol.ScopesResponse {
    const candidate = message as DebugProtocol.ScopesResponse;
    return !!candidate && candidate.command === 'scopes' && Array.isArray(candidate.body.scopes);
}

function isVariableResponse(message: unknown): message is DebugProtocol.VariablesResponse {
    const candidate = message as DebugProtocol.VariablesResponse;
    return !!candidate && candidate.command === 'variables' && Array.isArray(candidate.body.variables);
}

export class GdbCapabilities implements AdapterCapabilities {
    private sessions = new Map<string, GdbAdapterTracker>();
    initializeAdapterTracker(session: vscode.DebugSession): GdbAdapterTracker | undefined {
        if (session.type === 'gdb') {
            const sessionTracker = new GdbAdapterTracker(new vscode.Disposable(() => this.sessions.delete(session.id)));
            this.sessions.set(session.id, sessionTracker);
            return sessionTracker;
        }
    }

    getVariables(session: vscode.DebugSession): Promise<VariableRange[]> {
        return Promise.resolve(this.sessions.get(session.id)?.getLocals(session) ?? []);
    }
}
