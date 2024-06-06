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

import { BigIntVariableRange } from '../../common/memory-range';
import { WebviewContext } from '../../common/webview-context';
import { BreakpointMetadata } from '../breakpoints/breakpoint-service';
/**
 * Custom data property used by VSCode to provide additional context info when opening a webview context menu
 * The data property needs to represent a valid JSON object.  Data context properties up the parent chain are merged into the child context.
 * This context info can be used to in `when` clauses from webview/context menu contributions and is accessible as argument of the corresponding command.
 */
export interface VscodeContext {
    'data-vscode-context': string;
}

export type WebviewSection = 'optionsWidget' | 'advancedOptionsOverlay' | 'memoryTable';

export function createVscodeContext<C extends {}>(context: C): VscodeContext {
    return { 'data-vscode-context': JSON.stringify(includeFlatKeys(context), replacerForBigInt) };
}

function includeFlatKeys(src: object): Record<string, unknown> {
    return { ...src, ...flattenKeys(src) };
}

// VSCode context cannot make use of nested keys in 'when' clauses.
function flattenKeys(src: object, dst: Record<string, unknown> = {}, prefix = 'memory-inspector.'): Record<string, unknown> {
    if (!src || typeof src !== 'object') { return dst; }
    for (const [key, value] of Object.entries(src)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            flattenKeys(value, dst, `${prefix}${key}.`);
        } else {
            dst[`${prefix}${key}`] = value;
        }
    }
    return dst;
}

export function createSectionVscodeContext(webviewSection: WebviewSection): VscodeContext {
    return createVscodeContext({ webviewSection });
}

export function createOverlayMoreActionsVscodeContext(): VscodeContext {
    return createVscodeContext({ webviewSection: 'advancedOptionsOverlay', advancedOptions: true, optionsMenu: true });
}

export function createColumnVscodeContext(column: string): VscodeContext {
    return createVscodeContext({ column });
}

export function createAppVscodeContext(context: Omit<WebviewContext, 'webviewSection'>): VscodeContext {
    return createVscodeContext({ ...context, webviewSection: 'app', preventDefaultContextMenuItems: true });
}

export function createGroupVscodeContext(startAddress: bigint, length: number, breakpoint?: BreakpointMetadata): VscodeContext {
    return createVscodeContext({ memoryData: { group: { startAddress, length } }, breakpoint: { ...breakpoint, isBreakable: true } });
}

export function createVariableVscodeContext(variable: BigIntVariableRange, breakpoint?: BreakpointMetadata): VscodeContext {
    const { name, type, value, parentVariablesReference, isPointer } = variable;
    return createVscodeContext({ variable: { name, type, value, parentVariablesReference, isPointer }, breakpoint: { ...breakpoint, isBreakable: true } });
}

function replacerForBigInt(_: string, value: unknown): unknown {
    if (typeof value === 'bigint') {
        return `0x${value.toString(16)}`;
    }
    return value;
}

