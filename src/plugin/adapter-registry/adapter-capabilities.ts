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
import { VariableRange } from '../../common/memory-range';
import { Logger } from '../logger';

/** Represents capabilities that may be achieved with particular debug adapters but are not part of the DAP */
export interface AdapterCapabilities {
    /** Resolve variables known to the adapter to their locations. Fallback if {@link getResidents} is not present */
    getVariables?(session: vscode.DebugSession): Promise<VariableRange[]>;
    /** Resolve symbols resident in the memory at the specified range. Will be preferred to {@link getVariables} if present. */
    getResidents?(session: vscode.DebugSession, params: DebugProtocol.ReadMemoryArguments): Promise<VariableRange[]>;
    initializeAdapterTracker?(session: vscode.DebugSession): vscode.DebugAdapterTracker | undefined;
}

export type WithChildren<Original> = Original & { children?: Array<WithChildren<DebugProtocol.Variable>> };
export type VariablesTree = Record<number, WithChildren<DebugProtocol.Scope | DebugProtocol.Variable>>;
export const hexAddress = /0x[0-9a-f]+/i;
export const notADigit = /[^0-9]/;

/** This class implements some of the basic elements of tracking adapter sessions in order to maintain a list of variables. */
export class AdapterVariableTracker implements vscode.DebugAdapterTracker {
    protected currentFrame?: number;
    protected variablesTree: VariablesTree = {};
    protected readonly pendingMessages = new Map<number, number>();

    constructor(protected readonly onEnd: vscode.Disposable, protected logger: Logger) { }

    onWillReceiveMessage(message: unknown): void {
        if (isScopesRequest(message)) {
            this.currentFrame = message.arguments.frameId;
        } else if (isVariableRequest(message)) {
            if (message.arguments.variablesReference in this.variablesTree) {
                this.pendingMessages.set(message.seq, message.arguments.variablesReference);
            }
        }
    }

    /** Produces a two-level tree of scopes and their immediate children. Does not handle expansion of complex variables. */
    onDidSendMessage(message: unknown): void {
        if (isScopesResponse(message)) {
            for (const scope of message.body.scopes) {
                if (this.isDesiredScope(scope)) {
                    if (!this.variablesTree[scope.variablesReference] || this.variablesTree[scope.variablesReference].name !== scope.name) {
                        this.variablesTree[scope.variablesReference] = { ...scope };
                    }
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
        }
    }

    protected isDesiredScope(scope: DebugProtocol.Scope): boolean {
        return scope.name !== 'Registers';
    }

    onExit(): void {
        this.onEnd.dispose();
        this.pendingMessages.clear();
    }

    async getLocals(session: vscode.DebugSession): Promise<VariableRange[]> {
        this.logger.debug('Retrieving local variables in', session.name + ' Current variables:\n', this.variablesTree);
        if (this.currentFrame === undefined) { return []; }
        const maybeRanges = await Promise.all(Object.values(this.variablesTree).reduce<Array<Promise<VariableRange | undefined>>>((previous, parent) => {
            if (this.isDesiredVariable(parent) && parent.children?.length) {
                this.logger.debug('Resolving children of', parent.name);
                parent.children.forEach(child => {
                    previous.push(this.variableToVariableRange(child, session));
                });
            } else {
                this.logger.debug('Ignoring', parent.name);
            }
            return previous;
        }, []));
        return maybeRanges.filter((candidate): candidate is VariableRange => !!candidate);
    }

    protected isDesiredVariable(candidate: DebugProtocol.Variable | DebugProtocol.Scope): boolean {
        return candidate.presentationHint !== 'registers' && candidate.name !== 'Registers';
    }

    protected variableToVariableRange(_variable: DebugProtocol.Variable, _session: vscode.DebugSession): Promise<VariableRange | undefined> {
        throw new Error('To be implemented by derived classes!');
    }
}

export class VariableTracker {
    protected sessions = new Map<string, AdapterVariableTracker>();

    // Include `type` in addition to the rest parameter to indicate that at least one is required
    constructor(protected TrackerConstructor: typeof AdapterVariableTracker, protected logger: Logger, protected types: string[]) {
    }

    initializeAdapterTracker(session: vscode.DebugSession): AdapterVariableTracker | undefined {
        if (this.types.includes(session.type)) {
            const sessionTracker = new this.TrackerConstructor(new vscode.Disposable(() => this.sessions.delete(session.id)), this.logger);
            this.sessions.set(session.id, sessionTracker);
            return sessionTracker;
        }
    }

    getVariables(session: vscode.DebugSession): Promise<VariableRange[]> {
        return Promise.resolve(this.sessions.get(session.id)?.getLocals(session) ?? []);
    }
}

export function isScopesRequest(message: unknown): message is DebugProtocol.ScopesRequest {
    const candidate = message as DebugProtocol.ScopesRequest;
    return !!candidate && candidate.command === 'scopes';
}

export function isVariableRequest(message: unknown): message is DebugProtocol.VariablesRequest {
    const candidate = message as DebugProtocol.VariablesRequest;
    return !!candidate && candidate.command === 'variables';
}

export function isScopesResponse(message: unknown): message is DebugProtocol.ScopesResponse {
    const candidate = message as DebugProtocol.ScopesResponse;
    return !!candidate && candidate.command === 'scopes' && Array.isArray(candidate.body.scopes);
}

export function isVariableResponse(message: unknown): message is DebugProtocol.VariablesResponse {
    const candidate = message as DebugProtocol.VariablesResponse;
    return !!candidate && candidate.command === 'variables' && Array.isArray(candidate.body.variables);
}
