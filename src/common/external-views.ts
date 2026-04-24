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
import {
  isDebugEvaluateArguments,
  isDebugScope,
  isDebugVariable,
} from '../common/debug-requests';

export namespace VariablesView {
  // from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/debug/browser/variablesView.ts
  export interface IVariablesContext {
    sessionId: string | undefined;
    container:
      | DebugProtocol.Variable
      | DebugProtocol.Scope
      | DebugProtocol.EvaluateArguments
      | undefined;
    variable: DebugProtocol.Variable;
  }
}

export function isVariablesContext(
  context: VariablesView.IVariablesContext | unknown,
): context is VariablesView.IVariablesContext {
  const assumed = context
    ? (context as VariablesView.IVariablesContext)
    : undefined;
  return (
    isDebugVariable(assumed?.variable) &&
    (!assumed?.container ||
      isDebugVariable(assumed?.container) ||
      isDebugScope(assumed?.container) ||
      isDebugEvaluateArguments(assumed?.container))
  );
}

export namespace WatchView {
  // Context argument passed to commands registered against the `debug/watch/context` menu.
  // VS Code's WatchExpressionsView passes an IExpression instance directly as the command argument
  // (NOT wrapped like the Variables view does). The relevant shape for our purposes is:
  //
  // - `name`            : the expression text for root watch expressions, or the variable name for children.
  // - `value`           : the evaluated value (string representation).
  // - `type`            : optional debugger-reported type.
  // - `memoryReference` : optional memory reference. When set, the `canViewMemory` context key becomes true
  //                       and our menu contribution shows up. We therefore rely on this being populated.
  // - `evaluateName`    : optional expression usable with the `evaluate` request (same as `name` for root
  //                       watch expressions).
  //
  // See: https://github.com/microsoft/vscode/pull/237751 (introduces `debug/watch/context`).
  //      https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/debug/browser/watchExpressionsView.ts
  export interface IWatchItemContext {
    name: string;
    value?: string;
    type?: string;
    memoryReference?: string;
    evaluateName?: string;
  }
}

export function isWatchItemContext(
  context: WatchView.IWatchItemContext | unknown,
): context is WatchView.IWatchItemContext {
  if (!context || typeof context !== 'object') {
    return false;
  }
  // Exclude values that match the Variables view wrapper shape; those are handled by `isVariablesContext`.
  if (isVariablesContext(context)) {
    return false;
  }
  const assumed = context as WatchView.IWatchItemContext;
  return typeof assumed.name === 'string';
}
