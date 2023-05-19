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

import * as vscode from 'vscode';
import * as manifest from './manifest';
import { DebugProtocol } from '@vscode/debugprotocol';
import { MemoryReadResult, MemoryWriteResult } from '../common/messaging';
import { AdapterRegistry } from './adapter-registry/adapter-registry';
import { VariableRange } from '../common/memory-range';

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

    private _onDidStopDebug: vscode.EventEmitter<vscode.DebugSession> = new vscode.EventEmitter<vscode.DebugSession>();
    public readonly onDidStopDebug: vscode.Event<vscode.DebugSession> = this._onDidStopDebug.event;

    protected readonly sessions = new Map<string, DebugProtocol.Capabilities | undefined>();
    protected adapterRegistry?: AdapterRegistry;

    public activate(context: vscode.ExtensionContext, registry: AdapterRegistry): void {
        this.adapterRegistry = registry;
        const createDebugAdapterTracker = (session: vscode.DebugSession): Required<vscode.DebugAdapterTracker> => {
            const handlerForSession = registry.getHandlerForSession(session.type);
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
                            this.setContext(message.body);
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
            vscode.debug.onDidChangeActiveDebugSession(session => {
                const capabilities = session && this.sessions.get(session.id);
                this.setContext(capabilities);
            })
        );
    }

    protected async debugSessionStarted(_session: vscode.DebugSession): Promise<void> {
        // Do nothing for now
    }

    protected debugSessionTerminated(session: vscode.DebugSession): void {
        this.sessions.delete(session.id);
    }

    protected setContext(capabilities?: DebugProtocol.Capabilities): void {
        vscode.commands.executeCommand('setContext', MemoryProvider.ReadKey, !!capabilities?.supportsReadMemoryRequest);
        vscode.commands.executeCommand('setContext', MemoryProvider.WriteKey, !!capabilities?.supportsWriteMemoryRequest);
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

    public async readMemory(readMemoryArguments: DebugProtocol.ReadMemoryArguments): Promise<MemoryReadResult> {
        return this.assertCapability('supportsReadMemoryRequest', 'read memory').customRequest('readMemory', readMemoryArguments);
    }

    public async writeMemory(writeMemoryArguments: DebugProtocol.WriteMemoryArguments): Promise<MemoryWriteResult> {
        return this.assertCapability('supportsWriteMemoryRequest', 'write memory').customRequest('writeMemory', writeMemoryArguments);
    }

    public async getVariables(variableArguments: DebugProtocol.ReadMemoryArguments): Promise<VariableRange[]> {
        const session = this.assertActiveSession('get variables');
        const handler = this.adapterRegistry?.getHandlerForSession(session.type);
        if (handler?.getResidents) { return handler.getResidents(session, variableArguments); }
        return handler?.getVariables?.(session) ?? [];
    }
}
