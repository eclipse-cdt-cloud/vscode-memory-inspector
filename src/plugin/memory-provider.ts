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
import { VariableRange, WrittenMemory } from '../common/memory-range';
import { ReadMemoryResult, SessionContext, WriteMemoryResult } from '../common/messaging';
import { AdapterRegistry } from './adapter-registry/adapter-registry';
import * as manifest from './manifest';
import { sendRequest } from '../common/debug-requests';
import { stringToBytesMemory } from '../common/memory';

export interface LabeledUint8Array extends Uint8Array {
    label?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isInitializeMessage = (message: any): message is DebugProtocol.InitializeResponse => message.command === 'initialize' && message.type === 'response';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isStoppedEvent = (message: any): boolean => message.type === 'event' && message.event === 'stopped';

export class MemoryProvider {
    public static ReadKey = `${manifest.PACKAGE_NAME}.canRead`;
    public static WriteKey = `${manifest.PACKAGE_NAME}.canWrite`;

    private _onDidStopDebug = new vscode.EventEmitter<vscode.DebugSession>();
    public readonly onDidStopDebug = this._onDidStopDebug.event;

    private _onDidWriteMemory = new vscode.EventEmitter<WrittenMemory>();
    public readonly onDidWriteMemory = this._onDidWriteMemory.event;

    private _sessionContext: SessionContext = { canRead: false, canWrite: false };
    private _onDidChangeSessionContext = new vscode.EventEmitter<SessionContext>();
    public readonly onDidChangeSessionContext = this._onDidChangeSessionContext.event;

    protected readonly sessions = new Map<string, DebugProtocol.Capabilities | undefined>();

    constructor(protected adapterRegistry: AdapterRegistry) {
    }

    get sessionContext(): SessionContext {
        return this._sessionContext;
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
                    if (isInitializeMessage(message)) {
                        // Check for right capabilities in the adapter
                        this.sessions.set(session.id, message.body);
                        if (vscode.debug.activeDebugSession?.id === session.id) {
                            this.setContext(session);
                        }
                    }
                    if (isStoppedEvent(message)) {
                        this._onDidStopDebug.fire(session);
                    }
                    contributedTracker?.onDidSendMessage?.(message);
                },
                onError: error => { contributedTracker?.onError?.(error); },
                onExit: (code, signal) => { contributedTracker?.onExit?.(code, signal); },
                onWillReceiveMessage: message => { contributedTracker?.onWillReceiveMessage?.(message); }
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
        this.sessions.delete(session.id);
    }

    protected setContext(session?: vscode.DebugSession): void {
        const capabilities = session && this.sessions.get(session.id);
        this._sessionContext = {
            sessionId: session?.id,
            canRead: !!capabilities?.supportsReadMemoryRequest,
            canWrite: !!capabilities?.supportsWriteMemoryRequest
        };
        vscode.commands.executeCommand('setContext', MemoryProvider.ReadKey, this.sessionContext.canRead);
        vscode.commands.executeCommand('setContext', MemoryProvider.WriteKey, this.sessionContext.canWrite);
        this._onDidChangeSessionContext.fire(this.sessionContext);
    }

    /** Returns the session if the capability is present, otherwise throws. */
    protected assertCapability(capability: keyof DebugProtocol.Capabilities, action: string): vscode.DebugSession {
        const session = this.assertActiveSession(action);
        if (!this.sessions.get(session.id)?.[capability]) {
            throw new Error(`Cannot ${action}. Session does not have capability ${capability}.`);
        }
        return session;
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

    public async writeMemory(args: DebugProtocol.WriteMemoryArguments & { count?: number }): Promise<WriteMemoryResult> {
        return sendRequest(this.assertCapability('supportsWriteMemoryRequest', 'write memory'), 'writeMemory', args).then(response => {
            const offset = response?.offset ? (args.offset ?? 0) + response.offset : args.offset;
            // we accept count as an additional argument so we can skip the memory length calculation
            const count = response?.bytesWritten ?? args.count ?? stringToBytesMemory(args.data).length;
            this._onDidWriteMemory.fire({ memoryReference: args.memoryReference, offset, count });
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
