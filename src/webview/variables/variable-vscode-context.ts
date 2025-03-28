/********************************************************************************
 * Copyright (C) 2025 EclipseSource.
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
import { JsonMap, VsCodeContextContribution } from '../vscode-context/vscode-context-contribution-service';

export class VariableVscodeContextContribution implements VsCodeContextContribution {
    readonly id = 'variable';

    contribute(_location: string, context: unknown): JsonMap | undefined {
        if (BigIntVariableRange.is(context)) {
            const { name, type, value, parentVariablesReference, isPointer } = context;
            return {
                variable: { name, type, value, parentVariablesReference, isPointer }
            };

        }

        return undefined;

    }
}
