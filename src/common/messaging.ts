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
import { URI } from 'vscode-uri';
import type { TrackedDataBreakpoints } from './breakpoint';
import { DebugEvents, DebugRequestTypes } from './debug-requests';
import { VariablesView } from './external-views';
import type { VariableRange, WrittenMemory } from './memory-range';
import { MemoryViewSettings } from './webview-configuration';
import { WebviewContext } from './webview-context';

// convenience types for easier readability and better semantics
export type MemoryOptions = Partial<DebugProtocol.ReadMemoryArguments>;

export type ReadMemoryArguments = DebugRequestTypes['readMemory'][0];
export type ReadMemoryResult = DebugRequestTypes['readMemory'][1];

export type WriteMemoryArguments = DebugRequestTypes['writeMemory'][0];
export type WriteMemoryResult = DebugRequestTypes['writeMemory'][1];

export type StoppedEvent = DebugEvents['stopped'];
export type ContinuedEvent = DebugEvents['continued'];

export type StoreMemoryArguments = MemoryOptions & { proposedOutputName?: string } | VariablesView.IVariablesContext | WebviewContext;
export type StoreMemoryResult = void;

export type ApplyMemoryArguments = URI | undefined;
export type ApplyMemoryResult = MemoryOptions;

export interface SessionContext {
    sessionId?: string;
    canRead: boolean;
    canWrite: boolean;
    stopped?: boolean;
}

// Notifications
export const readyType: NotificationType<void> = { method: 'ready' };
export const setMemoryViewSettingsType: NotificationType<Partial<MemoryViewSettings>> = { method: 'setMemoryViewSettings' };
export const setTitleType: NotificationType<string> = { method: 'setTitle' };
export const memoryWrittenType: NotificationType<WrittenMemory> = { method: 'memoryWritten' };
export const sessionContextChangedType: NotificationType<SessionContext> = { method: 'sessionContextChanged' };
export const setTrackedBreakpointType: NotificationType<TrackedDataBreakpoints> = { method: 'setTrackedBreakpoints' };
export const notifyStoppedType: NotificationType<StoppedEvent> = { method: 'notifyStoppedType' };
export const notifyContinuedType: NotificationType<ContinuedEvent> = { method: 'notifyContinuedType' };

// Requests
export const setOptionsType: RequestType<MemoryOptions, void> = { method: 'setOptions' };
export const logMessageType: RequestType<string, void> = { method: 'logMessage' };
export const readMemoryType: RequestType<ReadMemoryArguments, ReadMemoryResult> = { method: 'readMemory' };
export const writeMemoryType: RequestType<WriteMemoryArguments, WriteMemoryResult> = { method: 'writeMemory' };
export const getVariablesType: RequestType<ReadMemoryArguments, VariableRange[]> = { method: 'getVariables' };
export const storeMemoryType: RequestType<StoreMemoryArguments, void> = { method: 'storeMemory' };
export const applyMemoryType: RequestType<ApplyMemoryArguments, ApplyMemoryResult> = { method: 'applyMemory' };

export const showAdvancedOptionsType: NotificationType<void> = { method: 'showAdvancedOptions' };
export const getWebviewSelectionType: RequestType<void, WebviewSelection> = { method: 'getWebviewSelection' };

export interface WebviewSelection {
    selectedCell?: {
        column: string
        value: string
    }
    textSelection?: string;
}
