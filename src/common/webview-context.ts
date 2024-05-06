/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
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

import { WebviewIdMessageParticipant } from 'vscode-messenger-common';
import { Endianness, VariableMetadata } from './memory-range';
import { ReadMemoryArguments } from './messaging';

export interface WebviewContext {
    messageParticipant: WebviewIdMessageParticipant,
    webviewSection: string,
    showAsciiColumn: boolean
    showVariablesColumn: boolean,
    showRadixPrefix: boolean,
    endianness: Endianness,
    bytesPerMau: number,
    activeReadArguments: Required<ReadMemoryArguments>
}

export interface WebviewCellContext extends WebviewContext {
    column: string;
    value: string;
}

export interface WebviewVariableContext extends WebviewCellContext {
    variable?: VariableMetadata
}

/**
 * Retrieves the currently visible (configurable) columns from the given {@link WebviewContext}.
 * @returns A string array containing the visible columns ids.
 */
export function getVisibleColumns(context: WebviewContext): string[] {
    const columns = [];
    if (context.showAsciiColumn) {
        columns.push('ascii');
    }
    if (context.showVariablesColumn) {
        columns.push('variables');
    }
    return columns;
}

export function isWebviewContext(args: WebviewContext | unknown): args is WebviewContext {
    const assumed = args ? args as WebviewContext : undefined;
    return typeof assumed?.messageParticipant?.type === 'string' && assumed.messageParticipant.type === 'webview' && typeof assumed.messageParticipant.webviewId === 'string'
        && typeof assumed.webviewSection === 'string' && typeof assumed.showAsciiColumn === 'boolean' && typeof assumed.showVariablesColumn === 'boolean'
        && typeof assumed.showRadixPrefix === 'boolean' && typeof assumed.activeReadArguments?.count === 'number' && typeof assumed.activeReadArguments?.offset === 'number'
        && typeof assumed.activeReadArguments?.memoryReference === 'string';
}

export function isWebviewVariableContext(args: WebviewVariableContext | unknown): args is Required<WebviewVariableContext> {
    const assumed = args ? args as WebviewVariableContext : undefined;
    return !!assumed && isWebviewContext(args)
        && !!assumed.variable
        && typeof assumed.variable.name === 'string' && !!assumed.variable.name
        && (typeof assumed.variable.type === 'string' || assumed.variable.type === undefined)
        && (typeof assumed.variable.value === 'string' || assumed.variable.value === undefined)
        && (typeof assumed.variable.isPointer === 'boolean' || assumed.variable.isPointer === undefined);
}
