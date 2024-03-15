/********************************************************************************
 * Copyright (C) 2022 Ericsson, Arm and others.
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
import { isDebugEvent, isDebugRequest, isDebugResponse, sendRequest } from '../common/debug-requests';
import { stringToBytesMemory } from '../common/memory';
import { VariableRange, WrittenMemory } from '../common/memory-range';
import { ReadMemoryResult, SessionContext, WriteMemoryResult } from '../common/messaging';
import { AdapterRegistry } from './adapter-registry/adapter-registry';
import * as manifest from './manifest';

export interface LabeledUint8Array extends Uint8Array {
    label?: string;
}

export class MemoryProvider {
    public static ReadKey = `${manifest.PACKAGE_NAME}.canRead`;
    public static WriteKey = `${manifest.PACKAGE_NAME}.canWrite`;

    private _onDidStopDebug = new vscode.EventEmitter<vscode.DebugSession>();
    public readonly onDidStopDebug = this._onDidStopDebug.event;

    private _onDidWriteMemory = new vscode.EventEmitter<WrittenMemory>();
    public readonly onDidWriteMemory = this._onDidWriteMemory.event;

    private _onDidChangeSessionContext = new vscode.EventEmitter<SessionContext>();
    public readonly onDidChangeSessionContext = this._onDidChangeSessionContext.event;

    protected readonly sessionDebugCapabilities = new Map<string, DebugProtocol.Capabilities | undefined>();
    protected readonly sessionClientCapabilities = new Map<string, DebugProtocol.InitializeRequestArguments | undefined>();

    constructor(protected adapterRegistry: AdapterRegistry) {
    }

    public activate(context: vscode.ExtensionContext): void {
        const createDebugAdapterTracker = (session: vscode.DebugSession): Required<vscode.DebugAdapterTracker> => {
            const handlerForSession = this.adapterRegistry.getHandlerForSession(session.type);
            const contributedTracker = handlerForSession?.initializeAdapterTracker?.(session);

            return ({
                onWillStartSession: () => {
                    this.debugSessionStarted(session);
                    contributedTracker?.onWillStartSession?.();
                },
                onWillStopSession: () => {
                    this.debugSessionTerminated(session);
                    contributedTracker?.onWillStopSession?.();
                },
                onDidSendMessage: message => {
                    if (isDebugResponse('initialize', message)) {
                        // Check for right capabilities in the adapter
                        this.sessionDebugCapabilities.set(session.id, message.body);
                        if (vscode.debug.activeDebugSession?.id === session.id) {
                            this.setContext(session);
                        }
                    } else if (isDebugEvent('stopped', message)) {
                        this._onDidStopDebug.fire(session);
                    } else if (isDebugEvent('memory', message)) {
                        this._onDidWriteMemory.fire(message.body);
                    }
                    contributedTracker?.onDidSendMessage?.(message);
                },
                onError: error => { contributedTracker?.onError?.(error); },
                onExit: (code, signal) => { contributedTracker?.onExit?.(code, signal); },
                onWillReceiveMessage: message => {
                    if (isDebugRequest('initialize', message)) {
                        this.sessionClientCapabilities.set(session.id, message.arguments);
                    }
                    contributedTracker?.onWillReceiveMessage?.(message);
                }
            });
        };

        context.subscriptions.push(
            vscode.debug.registerDebugAdapterTrackerFactory('*', { createDebugAdapterTracker }),
            vscode.debug.onDidChangeActiveDebugSession(session => this.setContext(session))
        );
    }

    protected async debugSessionStarted(_session: vscode.DebugSession): Promise<void> {
        // Do nothing for now
    }

    protected debugSessionTerminated(session: vscode.DebugSession): void {
        this.sessionDebugCapabilities.delete(session.id);
        this.sessionClientCapabilities.delete(session.id);
    }

    createContext(session = vscode.debug.activeDebugSession): SessionContext {
        const sessionId = session?.id;
        const capabilities = sessionId ? this.sessionDebugCapabilities.get(sessionId) : undefined;
        return {
            sessionId,
            canRead: !!capabilities?.supportsReadMemoryRequest,
            canWrite: !!capabilities?.supportsWriteMemoryRequest
        };
    }

    protected setContext(session?: vscode.DebugSession): void {
        const newContext = this.createContext(session);
        vscode.commands.executeCommand('setContext', MemoryProvider.ReadKey, newContext.canRead);
        vscode.commands.executeCommand('setContext', MemoryProvider.WriteKey, newContext.canWrite);
        this._onDidChangeSessionContext.fire(newContext);
    }

    /** Returns the session if the capability is present, otherwise throws. */
    protected assertCapability(capability: keyof DebugProtocol.Capabilities, action: string): vscode.DebugSession {
        const session = this.assertActiveSession(action);
        if (!this.hasDebugCapabilitiy(session, capability)) {
            throw new Error(`Cannot ${action}. Session does not have capability ${capability}.`);
        }
        return session;
    }

    protected hasDebugCapabilitiy(session: vscode.DebugSession, capability: keyof DebugProtocol.Capabilities): boolean {
        return !!this.sessionDebugCapabilities.get(session.id)?.[capability];
    }

    protected hasClientCapabilitiy(session: vscode.DebugSession, capability: keyof DebugProtocol.InitializeRequestArguments): boolean {
        return !!this.sessionClientCapabilities.get(session.id)?.[capability];
    }

    protected assertActiveSession(action: string): vscode.DebugSession {
        if (!vscode.debug.activeDebugSession) {
            throw new Error(`Cannot ${action}. No active debug session.`);
        }
        return vscode.debug.activeDebugSession;
    }

    public async readMemory(args: DebugProtocol.ReadMemoryArguments): Promise<ReadMemoryResult> {
        return sendRequest(this.assertCapability('supportsReadMemoryRequest', 'read memory'), 'readMemory', args);
    }

    public async writeMemory(args: DebugProtocol.WriteMemoryArguments): Promise<WriteMemoryResult> {
        const session = this.assertCapability('supportsWriteMemoryRequest', 'write memory');
        return sendRequest(session, 'writeMemory', args).then(response => {
            if (!this.hasClientCapabilitiy(session, 'supportsMemoryEvent')) {
                // we only send out a custom event if we don't expect the client to handle the memory event
                // since our client is VS Code we can assume that they will always support this but better to be safe
                const offset = response?.offset ? (args.offset ?? 0) + response.offset : args.offset;
                const count = response?.bytesWritten ?? stringToBytesMemory(args.data).length;
                this._onDidWriteMemory.fire({ memoryReference: args.memoryReference, offset, count });
            }
            return response;
        });
    }

    public async getVariables(variableArguments: DebugProtocol.ReadMemoryArguments): Promise<VariableRange[]> {
        const session = this.assertActiveSession('get variables');
        const handler = this.adapterRegistry?.getHandlerForSession(session.type);
        if (handler?.getResidents) { return handler.getResidents(session, variableArguments); }
        return handler?.getVariables?.(session) ?? [];
    }

    public async getAddressOfVariable(variableName: string): Promise<string | undefined> {
        const session = this.assertActiveSession('get address of variable');
        const handler = this.adapterRegistry?.getHandlerForSession(session.type);
        return handler?.getAddressOfVariable?.(session, variableName);
    }

    public async getSizeOfVariable(variableName: string): Promise<bigint | undefined> {
        const session = this.assertActiveSession('get address of variable');
        const handler = this.adapterRegistry?.getHandlerForSession(session.type);
        return handler?.getSizeOfVariable?.(session, variableName);
    }
}
