/********************************************************************************
 * Copyright (C) 2023 Ericsson and others.
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
import type * as React from 'react';
import { LongMemoryRange } from '../../common/memory-range';
import type { Disposable, MemoryState, UpdateExecutor } from '../utils/view-types';

export interface ColumnContribution {
    readonly label: string;
    readonly id: string;
    render(memory: MemoryState, range: LongMemoryRange): React.ReactElement
    /** Called when fetching new memory or when activating the column. */
    fetchData?(currentViewParameters: DebugProtocol.ReadMemoryArguments): Promise<void>;
    /** Called when the user reveals the column */
    activate?(memory: MemoryState): Promise<void>;
    /** Called when the user hides the column */
    deactivate?(): void;
}

class ColumnContributionService {
    private activeColumns = new Array<ColumnContribution>();
    private registeredColumns = new Map<string, ColumnContribution>;
    register(contribution: ColumnContribution): Disposable {
        this.registeredColumns.set(contribution.id, contribution);
        return {
            dispose: () => {
                this.hide(contribution.id);
                this.registeredColumns.delete(contribution.id);
            }
        };
    }
    async show(id: string, memoryState: MemoryState): Promise<ColumnContribution[]> {
        const contribution = this.registeredColumns.get(id);
        if (contribution) {
            await contribution.activate?.(memoryState);
            this.activeColumns.push(contribution);
            this.activeColumns.sort((left, right) => left.id.localeCompare(right.id));
        }
        return this.activeColumns.slice();
    }
    hide(id: string): ColumnContribution[] {
        const contribution = this.registeredColumns.get(id);
        let index;
        if (contribution && (index = this.activeColumns.findIndex(candidate => candidate === contribution)) !== -1) {
            this.activeColumns.splice(index, 1);
        }
        return this.activeColumns.slice();
    }
    getUpdateExecutors(): UpdateExecutor[] {
        return this.activeColumns.filter((candidate): candidate is ColumnContribution & UpdateExecutor => candidate.fetchData !== undefined);
    }
}

export const columnContributionService = new ColumnContributionService();
