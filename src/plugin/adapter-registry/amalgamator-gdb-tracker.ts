/********************************************************************************
 * Copyright (C) 2024 Ericsson, Arm and others.
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
import { ConnectionContext, ReadMemoryArguments, ReadMemoryResult, WriteMemoryArguments, WriteMemoryResult } from '../../common/messaging';
import { AdapterCapabilities, AdapterVariableTracker, VariableTracker } from './adapter-capabilities';

// Copied from cdt-amalgamator [AmalgamatorSession.d.ts] file
/**
 * Response for our custom 'cdt-amalgamator/getChildDaps' request.
 */
export interface ConnectionContexts {
    children?: ConnectionContext[];
}
export interface GetContextsResponse extends DebugProtocol.Response {
    body: ConnectionContexts;
}
export type GetContextsResult = GetContextsResponse['body'];

export interface AmalgamatorReadArgs extends ReadMemoryArguments {
    child: ConnectionContext;
}

export class AmalgamatorSessionManager extends VariableTracker implements AdapterCapabilities {
    async getConnectionContexts(session: vscode.DebugSession): Promise<ConnectionContext[]> {
        return this.sessions.get(session.id)?.getConnectionContexts?.(session) || [];
    }

    async readMemory(session: vscode.DebugSession, args: ReadMemoryArguments, context: ConnectionContext): Promise<ReadMemoryResult> {
        if (!context) {
            vscode.window.showErrorMessage('Invalid context for Amalgamator. Select Context in Dropdown');
            return {
                address: args.memoryReference
            };
        }
        return this.sessions.get(session.id)?.readMemory?.(session, args, context);
    }

    async writeMemory(session: vscode.DebugSession, args: WriteMemoryArguments, context: ConnectionContext): Promise<WriteMemoryResult> {
        return this.sessions.get(session.id)?.writeMemory?.(session, args, context);
    }

    async getCurrentConnectionContext(session: vscode.DebugSession): Promise<ConnectionContext | undefined> {
        return this.sessions.get(session.id)?.getCurrentConnectionContext?.(session);
    }
}

export class AmalgamatorGdbVariableTransformer extends AdapterVariableTracker {
    protected connectionContexts?: ConnectionContext[];
    protected currentConnectionContext?: ConnectionContext;

    onWillReceiveMessage(message: unknown): void {
        if (isStacktraceRequest(message)) {
            if (typeof (message.arguments.threadId) !== 'undefined') {
                this.currentConnectionContext = {
                    id: message.arguments.threadId,
                    name: message.arguments.threadId.toString()
                };
            } else {
                this.logger.warn('Invalid ThreadID in stackTrace');
                this.currentConnectionContext = undefined;
            }
        } else {
            super.onWillReceiveMessage(message);
        }
    }

    get frame(): number | undefined { return this.currentFrame; }

    async getConnectionContexts(session: vscode.DebugSession): Promise<ConnectionContext[]> {
        if (!this.connectionContexts) {
            const contexts: GetContextsResult = (await session.customRequest('cdt-amalgamator/getChildDaps'));
            this.connectionContexts = contexts.children?.map(({ name, id }) => ({ name, id })) ?? [];
        }
        return Promise.resolve(this.connectionContexts);
    }

    async getCurrentConnectionContext(_session: vscode.DebugSession): Promise<ConnectionContext | undefined> {
        return Promise.resolve(this.currentConnectionContext);
    }

    readMemory(session: vscode.DebugSession, args: ReadMemoryArguments, context: ConnectionContext): Promise<ReadMemoryResult> {
        const amalReadArgs: AmalgamatorReadArgs = { ...args, child: context };
        return Promise.resolve(session.customRequest('cdt-amalgamator/readMemory', amalReadArgs));
    }
}

export function isStacktraceRequest(message: unknown): message is DebugProtocol.StackTraceRequest {
    const candidate = message as DebugProtocol.StackTraceRequest;
    return !!candidate && candidate.command === 'stackTrace';
}

export function isStacktraceResponse(message: unknown): message is DebugProtocol.StackTraceResponse {
    const candidate = message as DebugProtocol.StackTraceResponse;
    return !!candidate && candidate.command === 'stackTrace' && Array.isArray(candidate.body.stackFrames);
}
