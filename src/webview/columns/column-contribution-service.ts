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
import { BigIntMemoryRange } from '../../common/memory-range';
import type { Disposable, Memory, MemoryState, UpdateExecutor } from '../utils/view-types';

export interface ColumnContribution {
    readonly label: string;
    readonly id: string;
    render(range: BigIntMemoryRange, memory: Memory): React.ReactNode
    /** Called when fetching new memory or when activating the column. */
    fetchData?(currentViewParameters: DebugProtocol.ReadMemoryArguments): Promise<void>;
    /** Called when the user reveals the column */
    activate?(memory: MemoryState): Promise<void>;
    /** Called when the user hides the column */
    deactivate?(): void;
}

export interface ColumnStatus {
    contribution: ColumnContribution;
    active: boolean;
}

class ColumnContributionService {
    protected columnArray = new Array<ColumnStatus>();
    protected registeredColumns = new Map<string, ColumnStatus>;
    register(contribution: ColumnContribution): Disposable {
        if (this.registeredColumns.has(contribution.id)) { return { dispose: () => { } }; }
        const wrapper = { contribution, active: false };
        this.registeredColumns.set(contribution.id, wrapper);
        this.columnArray.push(wrapper);
        this.columnArray.sort((left, right) => left.contribution.id.localeCompare(right.contribution.id));
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
