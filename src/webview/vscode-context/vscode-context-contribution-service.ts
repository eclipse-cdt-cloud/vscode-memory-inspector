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

import { createVscodeContext, VscodeContext } from './vscode-contexts';

export type JsonArray = JsonAny[];
export type JsonAny = JsonPrimitive | JsonMap | JsonArray | bigint | null | undefined;
export type JsonPrimitive = string | number | boolean;
export interface JsonMap {
    [key: string]: JsonAny
}

export interface VsCodeContextContribution {
    readonly id: string;
    contribute(location: string, context: unknown): JsonMap | undefined
}

export class VsCodeContextContributionService {
    private readonly contributions = new Map<string, VsCodeContextContribution>();

    register(contribution: VsCodeContextContribution): void {
        this.contributions.set(contribution.id, contribution);
    }

    unregister(id: string): void {
        this.contributions.delete(id);
    }

    createContext(location: string, context: unknown): VscodeContext {
        const contributions = Array.from(this.contributions.values()).map(contribution => contribution.contribute(location, context));
        const vsCodeContext = Object.assign({}, ...contributions);

        return createVscodeContext(vsCodeContext);
    }
}

export const vsCodeContextContributionService = new VsCodeContextContributionService();
