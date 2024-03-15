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

import type * as React from 'react';
import { Memory } from '../../common/memory';
import { BigIntMemoryRange } from '../../common/memory-range';
import { ReadMemoryArguments } from '../../common/messaging';
import type { Disposable, MemoryState, SerializedTableRenderOptions, UpdateExecutor } from '../utils/view-types';

export type ColumnFittingType = 'content-width';

export interface ColumnContribution {
    readonly id: string;
    readonly className?: string;
    readonly label: string;
    /** Depending on the supported fitting mode, the column will be rendered differently */
    fittingType?: ColumnFittingType;
    /** Sorted low to high. If ommitted, sorted alphabetically by ID after all contributions with numbers. */
    priority?: number;
    render(range: BigIntMemoryRange, memory: Memory, options: TableRenderOptions): React.ReactNode
    /** Called when fetching new memory or when activating the column. */
    fetchData?(currentViewParameters: ReadMemoryArguments): Promise<void>;
    /** Called when the user reveals the column */
    activate?(memory: MemoryState): Promise<void>;
    /** Called when the user hides the column */
    deactivate?(): void;
}

export interface ColumnStatus {
    contribution: ColumnContribution;
    active: boolean;
    /** If set to false, the column will always be displayed */
    configurable: boolean;
}

export interface TableRenderOptions extends Omit<SerializedTableRenderOptions, 'columnOptions'> {
    columnOptions: ColumnStatus[];
}

class ColumnContributionService {
    protected columnArray = new Array<ColumnStatus>();
    protected registeredColumns = new Map<string, ColumnStatus>;
    /**
     * @param configurable - if `false`, the column will always be dispayled.
     * @param defaultActive if {@link configurable} is `false`, this field will default to `true` and be ignored. Otherwise defaults to `false`.
     */
    register(contribution: ColumnContribution, configurable = true, defaultActive?: boolean): Disposable {
        if (this.registeredColumns.has(contribution.id)) { return { dispose: () => { } }; }
        const active = defaultActive || !configurable; // If not configurable, must be active.
        const wrapper = { contribution, active, configurable };
        this.registeredColumns.set(contribution.id, wrapper);
        this.columnArray.push(wrapper);
        this.columnArray.sort(sortContributions);
        return {
            dispose: () => {
                this.hide(contribution.id);
                this.registeredColumns.delete(contribution.id);
                this.columnArray = this.columnArray.filter(candidate => wrapper !== candidate);
            }
        };
    }
    async show(id: string, memoryState: MemoryState): Promise<ColumnStatus[]> {
        const wrapper = this.registeredColumns.get(id);
        if (wrapper) {
            await wrapper.contribution.activate?.(memoryState);
            wrapper.active = true;
        }
        return this.columnArray.slice();
    }
    hide(id: string): ColumnStatus[] {
        const wrapper = this.registeredColumns.get(id);
        if (wrapper?.active) {
            wrapper.active = false;
            wrapper.contribution.deactivate?.();
        }
        return this.columnArray.slice();
    }
    getColumns(): ColumnStatus[] {
        return this.columnArray.slice();
    }
    getUpdateExecutors(): UpdateExecutor[] {
        return this.columnArray.map(({ contribution }) => contribution).filter((candidate): candidate is ColumnContribution & UpdateExecutor => candidate.fetchData !== undefined);
    }
}

export const columnContributionService = new ColumnContributionService();

function sortContributions(left: ColumnStatus, right: ColumnStatus): number {
    const leftHasPriority = typeof left.contribution.priority === 'number';
    const rightHasPriority = typeof right.contribution.priority === 'number';
    if (leftHasPriority && !rightHasPriority) { return -1; }
    if (rightHasPriority && !leftHasPriority) { return 1; }
    if ((!rightHasPriority && !leftHasPriority) || (left.contribution.priority! - right.contribution.priority! === 0)) {
        return left.contribution.id.localeCompare(right.contribution.id);
    }
    return left.contribution.priority! - right.contribution.priority!;
}
