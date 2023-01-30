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

import type { DebugProtocol } from '@vscode/debugprotocol';
import { NotificationType, RequestType } from 'vscode-messenger-common';

export interface MemoryOptions {
    startAddress: number;
    locationOffset: number;
    readLength: number;
}

export const readyType: NotificationType<void> = { method: 'ready' };
export const logMessageType: RequestType<string, void> = { method: 'logMessage' };
export const setOptionsType: RequestType<MemoryOptions, void> = { method: 'setOptions' };
export const readMemoryType: RequestType<DebugProtocol.ReadMemoryArguments, DebugProtocol.ReadMemoryResponse> = { method: 'readMemory' };
export const writeMemoryType: RequestType<DebugProtocol.WriteMemoryArguments, DebugProtocol.WriteMemoryResponse> = { method: 'writeMemory' };
