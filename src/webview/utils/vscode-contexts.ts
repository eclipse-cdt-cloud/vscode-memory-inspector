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
    return { 'data-vscode-context': JSON.stringify(context) };
}

export function createSectionVscodeContext(webviewSection: WebviewSection): VscodeContext {
    return createVscodeContext({ webviewSection });
}

export function createColumnVscodeContext(column: string): VscodeContext {
    return createVscodeContext({ column });
}

export function createAppVscodeContext(context: Omit<WebviewContext, 'webviewSection'>): VscodeContext {
    return createVscodeContext({ ...context, webviewSection: 'app', preventDefaultContextMenuItems: true });
}

export function createVariableVscodeContext(variable: BigIntVariableRange): VscodeContext {
    const { name, type, value } = variable;
    return createVscodeContext({ variable: { name, type, value } });
}

