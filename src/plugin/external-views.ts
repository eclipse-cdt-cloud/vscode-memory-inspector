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

import { DebugProtocol } from '@vscode/debugprotocol';
import { isDebugEvaluateArguments, isDebugScope, isDebugVariable } from '../common/debug-requests';

export namespace VariablesView {
    // from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/debug/browser/variablesView.ts
    export interface IVariablesContext {
        sessionId: string | undefined;
        container: DebugProtocol.Variable | DebugProtocol.Scope | DebugProtocol.EvaluateArguments;
        variable: DebugProtocol.Variable;
    }
}

export function isVariablesContext(context: VariablesView.IVariablesContext | unknown): context is VariablesView.IVariablesContext {
    const assumed = context ? context as VariablesView.IVariablesContext : undefined;
    return isDebugVariable(assumed?.variable) && (isDebugVariable(assumed?.container) || isDebugScope(assumed?.container) || isDebugEvaluateArguments(assumed?.container));
}
