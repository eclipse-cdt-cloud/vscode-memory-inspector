/********************************************************************************
 * Copyright (C) 2024 EclipseSource.
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
// inspired by https://github.com/eclipse-theia/theia/blob/master/packages/debug/src/browser/debug-session-connection.ts

import type { DebugProtocol } from '@vscode/debugprotocol';
import type { DebugSession } from 'vscode';

export interface DebugRequestTypes {
    'evaluate': [DebugProtocol.EvaluateArguments, DebugProtocol.EvaluateResponse['body']]
    'initialize': [DebugProtocol.InitializeRequestArguments, DebugProtocol.InitializeResponse['body']]
    'readMemory': [DebugProtocol.ReadMemoryArguments, DebugProtocol.ReadMemoryResponse['body']]
    'scopes': [DebugProtocol.ScopesArguments, DebugProtocol.ScopesResponse['body']]
    'variables': [DebugProtocol.VariablesArguments, DebugProtocol.VariablesResponse['body']]
    'writeMemory': [DebugProtocol.WriteMemoryArguments, DebugProtocol.WriteMemoryResponse['body']]
}

export interface DebugEvents {
    'memory': DebugProtocol.MemoryEvent,
    'stopped': DebugProtocol.StoppedEvent
}

export type DebugRequest<C, A> = Omit<DebugProtocol.Request, 'command' | 'arguments'> & { command: C, arguments: A };
export type DebugResponse<C, B> = Omit<DebugProtocol.Response, 'command' | 'body'> & { command: C, body: B };
export type DebugEvent<T> = DebugProtocol.Event & { body: T };

export async function sendRequest<K extends keyof DebugRequestTypes>(session: DebugSession,
    command: K, args: DebugRequestTypes[K][0]): Promise<DebugRequestTypes[K][1]> {
    return session.customRequest(command, args);
}

export function isDebugVariable(variable: DebugProtocol.Variable | unknown): variable is DebugProtocol.Variable {
    const assumed = variable ? variable as DebugProtocol.Variable : undefined;
    return typeof assumed?.name === 'string' && typeof assumed?.value === 'string';
}

export function isDebugScope(scope: DebugProtocol.Scope | unknown): scope is DebugProtocol.Scope {
    const assumed = scope ? scope as DebugProtocol.Scope : undefined;
    return typeof assumed?.name === 'string' && typeof assumed?.variablesReference === 'number';
}

export function isDebugEvaluateArguments(args: DebugProtocol.EvaluateArguments | unknown): args is DebugProtocol.EvaluateArguments {
    const assumed = args ? args as DebugProtocol.EvaluateArguments : undefined;
    return typeof assumed?.expression === 'string';
}

export function isDebugRequest<K extends keyof DebugRequestTypes>(command: K, message: unknown): message is DebugRequest<K, DebugRequestTypes[K][0]> {
    const assumed = message ? message as DebugProtocol.Request : undefined;
    return !!assumed && assumed.type === 'request' && assumed.command === command;
}

export function isDebugResponse<K extends keyof DebugRequestTypes>(command: K, message: unknown): message is DebugResponse<K, DebugRequestTypes[K][1]> {
    const assumed = message ? message as DebugProtocol.Response : undefined;
    return !!assumed && assumed.type === 'response' && assumed.command === command;
}

export function isDebugEvent<K extends keyof DebugEvents>(event: K, message: unknown): message is DebugEvents[K] {
    const assumed = message ? message as DebugProtocol.Event : undefined;
    return !!assumed && assumed.type === 'event' && assumed.event === event;
}
