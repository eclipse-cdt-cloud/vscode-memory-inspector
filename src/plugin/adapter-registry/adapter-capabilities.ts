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

import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { isDebugRequest, isDebugResponse } from '../../common/debug-requests';
import { VariableRange } from '../../common/memory-range';
import { MemoryDisplaySettingsContribution } from '../../common/webview-configuration';
import { Logger } from '../logger';

/** Represents capabilities that may be achieved with particular debug adapters but are not part of the DAP */
export interface AdapterCapabilities {
    /** Resolve variables known to the adapter to their locations. Fallback if {@link getResidents} is not present */
    getVariables?(session: vscode.DebugSession): Promise<VariableRange[]>;
    /** Resolve symbols resident in the memory at the specified range. Will be preferred to {@link getVariables} if present. */
    getResidents?(session: vscode.DebugSession, params: DebugProtocol.ReadMemoryArguments): Promise<VariableRange[]>;
    /** Resolves the address of a given variable in bytes with the current context. */
    getAddressOfVariable?(session: vscode.DebugSession, variableName: string): Promise<string | undefined>;
    /** Resolves the size of a given variable in bytes within the current context. */
    getSizeOfVariable?(session: vscode.DebugSession, variableName: string): Promise<bigint | undefined>;
    /** Retrieve the suggested default display settings for the memory view. */
    getMemoryDisplaySettings?(session: vscode.DebugSession): Promise<Partial<MemoryDisplaySettingsContribution>>;
    /** Initialize the trackers of this adapter's for the debug session. */
    initializeAdapterTracker?(session: vscode.DebugSession): vscode.DebugAdapterTracker | undefined;
}

export type WithChildren<Original> = Original & { children?: Array<WithChildren<DebugProtocol.Variable>> };
export type VariablesTree = Record<number, WithChildren<DebugProtocol.Scope | DebugProtocol.Variable>>;
export const hexAddress = /0x[0-9a-f]+/i;
export const decimalAddress = /[0-9]+/i;
export const notADigit = /[^0-9]/;

export function extractHexAddress(text?: string): string | undefined {
    return text ? hexAddress.exec(text)?.[0] : undefined;
}

export function extractDecimalAddress(text?: string): string | undefined {
    return text ? decimalAddress.exec(text)?.[0] : undefined;
}

export function extractAddress(text?: string): string | undefined {
    // search for hex address first as a hex address (0x12345678) also matches an integer address (12345678)
    return text ? extractHexAddress(text) ?? extractDecimalAddress(text) : undefined;
}

/** This class implements some of the basic elements of tracking adapter sessions in order to maintain a list of variables. */
export class AdapterVariableTracker implements vscode.DebugAdapterTracker {
    protected currentFrame?: number;
    protected variablesTree: VariablesTree = {};
    protected readonly pendingMessages = new Map<number, number>();

    constructor(protected readonly onEnd: vscode.Disposable, protected logger: Logger) { }

    onWillReceiveMessage(message: unknown): void {
        if (isDebugRequest('scopes', message)) {
            this.currentFrame = message.arguments.frameId;
        } else if (isDebugRequest('variables', message)) {
            if (message.arguments.variablesReference in this.variablesTree) {
                this.pendingMessages.set(message.seq, message.arguments.variablesReference);
            }
        }
    }

    /** Produces a two-level tree of scopes and their immediate children. Does not handle expansion of complex variables. */
    onDidSendMessage(message: unknown): void {
        if (isDebugResponse('scopes', message)) {
            this.variablesTree = {}; // Scopes request implies that all scopes will be queried again.
            for (const scope of message.body?.scopes) {
                if (this.isDesiredScope(scope)) {
                    if (!this.variablesTree[scope.variablesReference] || this.variablesTree[scope.variablesReference].name !== scope.name) {
                        this.variablesTree[scope.variablesReference] = { ...scope };
                    }
                }
            }
        } else if (isDebugResponse('variables', message)) {
            if (this.pendingMessages.has(message.request_seq)) {
                const parentReference = this.pendingMessages.get(message.request_seq)!;
                this.pendingMessages.delete(message.request_seq);
                if (parentReference in this.variablesTree) {
                    this.variablesTree[parentReference].children = message.body?.variables;
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
                    previous.push(this.variableToVariableRange(child, session, parent));
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

    protected variableToVariableRange(
        _variable: DebugProtocol.Variable,
        _session: vscode.DebugSession,
        _parent: WithChildren<DebugProtocol.Scope | DebugProtocol.Variable>): Promise<VariableRange | undefined> {
        throw new Error('To be implemented by derived classes!');
    }

    /** Resolves the address of a given variable in bytes within the current context. */
    getAddressOfVariable?(variableName: string, session: vscode.DebugSession): Promise<string | undefined>;

    /** Resolves the size of a given variable in bytes within the current context. */
    getSizeOfVariable?(variableName: string, session: vscode.DebugSession): Promise<bigint | undefined>;
}

export class VariableTracker implements AdapterCapabilities {
    protected sessions = new Map<string, AdapterVariableTracker>();
    protected types: string[];

    constructor(protected TrackerConstructor: typeof AdapterVariableTracker, protected logger: Logger, ...types: string[]) {
        if (types.length === 0) {
            logger.warn('No debug session types to track');
        }
        this.types = types;
    }

    initializeAdapterTracker(session: vscode.DebugSession): AdapterVariableTracker | undefined {
        if (this.types.includes(session.type)) {
            const sessionTracker = new this.TrackerConstructor(new vscode.Disposable(() => this.sessions.delete(session.id)), this.logger);
            this.sessions.set(session.id, sessionTracker);
            return sessionTracker;
        }
    }

    async getVariables(session: vscode.DebugSession): Promise<VariableRange[]> {
        return this.sessions.get(session.id)?.getLocals(session) ?? [];
    }

    async getAddressOfVariable(session: vscode.DebugSession, variableName: string): Promise<string | undefined> {
        return this.sessions.get(session.id)?.getAddressOfVariable?.(variableName, session);
    }

    async getSizeOfVariable(session: vscode.DebugSession, variableName: string): Promise<bigint | undefined> {
        return this.sessions.get(session.id)?.getSizeOfVariable?.(variableName, session);
    }
}
