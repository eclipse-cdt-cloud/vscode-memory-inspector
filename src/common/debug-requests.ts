/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
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
    'readMemory': [DebugProtocol.ReadMemoryArguments, DebugProtocol.ReadMemoryResponse['body']]
    'writeMemory': [DebugProtocol.WriteMemoryArguments, DebugProtocol.WriteMemoryResponse['body']]
}

export async function sendRequest<K extends keyof DebugRequestTypes>(session: DebugSession,
    command: K, args: DebugRequestTypes[K][0]): Promise<DebugRequestTypes[K][1]> {
    return session.customRequest(command, args);
}

export namespace EvaluateExpression {
    export function sizeOf(expression: string): string {
        return `sizeof(${expression})`;
    }
    export function addressOf(expression: string): string {
        return `&(${expression})`;
    }
};