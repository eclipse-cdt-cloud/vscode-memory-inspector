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
import { DebugProtocol } from 'vscode-debugprotocol';

export interface LabeledUint8Array extends Uint8Array {
    label?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isInitializeMessage = (message: any): message is DebugProtocol.InitializeResponse => message.command === 'initialize' && message.type === 'response';

export class MemoryProvider {
    public static ContextKey = `${manifest.PACKAGE_NAME}.validDebugger`;

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        const createDebugAdapterTracker = (session: vscode.DebugSession): vscode.DebugAdapterTracker => ({
            onWillStartSession: () => this.debugSessionStarted(session),
            onWillStopSession: () => this.debugSessionTerminated(session),
            onDidSendMessage: message => {
                if (isInitializeMessage(message)) {
                    // Check for right capabilities in the adapter
                    if (message.body?.supportsReadMemoryRequest && message.body?.supportsWriteMemoryRequest) {
                        this.setContext(true);
                    }
                }
            }
        });

        context.subscriptions.push(
            vscode.debug.registerDebugAdapterTrackerFactory('*', { createDebugAdapterTracker })
        );
    }

    protected async debugSessionStarted(_session: vscode.DebugSession): Promise<void> {
        // Do nothing for now
    }

    protected debugSessionTerminated(_session: vscode.DebugSession): void {
        this.setContext(false);
    }

    protected setContext(valid: boolean): void {
        vscode.commands.executeCommand('setContext', MemoryProvider.ContextKey, valid);
    }

    public async readMemory(readMemoryArguments: DebugProtocol.ReadMemoryArguments): Promise<DebugProtocol.ReadMemoryResponse> {
        const session = vscode.debug.activeDebugSession;

        if (!session) {
            throw new Error('Cannot read memory. No active debug session.');
        }

        return session.customRequest('readMemory', readMemoryArguments);
    }

    public async writeMemory(writeMemoryArguments: DebugProtocol.WriteMemoryArguments): Promise<DebugProtocol.WriteMemoryResponse> {
        const session = vscode.debug.activeDebugSession;

        if (!session) {
            throw new Error('Cannot write memory. No active debug session.');
        }

        return session.customRequest('writeMemory', writeMemoryArguments);
    }
}
