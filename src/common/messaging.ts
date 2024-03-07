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
import type { NotificationType, RequestType } from 'vscode-messenger-common';
import { MemoryViewSettings } from '../webview/utils/view-types';
import type { VariableRange } from './memory-range';

export type MemoryReadResult = DebugProtocol.ReadMemoryResponse['body'];
export type MemoryWriteResult = DebugProtocol.WriteMemoryResponse['body'];

export const readyType: NotificationType<void> = { method: 'ready' };
export const logMessageType: RequestType<string, void> = { method: 'logMessage' };
export const setMemoryViewSettingsType: NotificationType<Partial<MemoryViewSettings>> = { method: 'setMemoryViewSettings' };
export const resetMemoryViewSettingsType: NotificationType<void> = { method: 'resetMemoryViewSettings' };
export const setTitleType: NotificationType<string> = { method: 'setTitle' };
export const setOptionsType: RequestType<Partial<DebugProtocol.ReadMemoryArguments | undefined>, void> = { method: 'setOptions' };
export const readMemoryType: RequestType<DebugProtocol.ReadMemoryArguments, MemoryReadResult> = { method: 'readMemory' };
export const writeMemoryType: RequestType<DebugProtocol.WriteMemoryArguments, MemoryWriteResult> = { method: 'writeMemory' };
export const getVariables: RequestType<DebugProtocol.ReadMemoryArguments, VariableRange[]> = { method: 'getVariables' };

export const showAdvancedOptionsType: NotificationType<void> = { method: 'showAdvancedOptions' };
export const getWebviewSelectionType: RequestType<void, WebviewSelection> = { method: 'getWebviewSelection' };

export interface WebviewSelection {
    selectedCell?: {
        column: string
        value: string
    }
    textSelection?: string;
}
