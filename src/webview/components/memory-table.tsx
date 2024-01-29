/********************************************************************************
 * Copyright (C) 2022 Ericsson, Arm and others.
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

// Primereact works with null values
/* eslint-disable no-null/no-null */

import React from 'react';
import { Decoration, Memory, MemoryDisplayConfiguration, ScrollingBehavior, isTrigger } from '../utils/view-types';
import { TableRenderOptions } from '../columns/column-contribution-service';
import { DebugProtocol } from '@vscode/debugprotocol';
import { DataTable, DataTableCellSelection, DataTableProps, DataTableRowData, DataTableSelectionCellChangeEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import deepequal from 'fast-deep-equal';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Nullable } from 'primereact/ts-helpers';

export interface MoreMemorySelectProps {
    count: number;
    offset: number;
    options: number[];
    direction: 'above' | 'below';
    scrollingBehavior: ScrollingBehavior;
    fetchMemory(partialOptions?: Partial<DebugProtocol.ReadMemoryArguments>): Promise<void>;
}

export const MoreMemorySelect: React.FC<MoreMemorySelectProps> = ({ count, offset, options, fetchMemory, direction, scrollingBehavior }) => {
    const [numBytes, setNumBytes] = React.useState<number>(options[0]);
    const containerRef = React.createRef<HTMLDivElement>();
    const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        e.stopPropagation();
        const { value } = e.currentTarget;
        setNumBytes(parseInt(value));
    };

    const loadMoreMemory = (e: React.MouseEvent | React.KeyboardEvent): void => {
        containerRef.current?.blur();
        if (isTrigger(e)) {
            let newOffset = offset;
            let newCount = count;
            if (direction === 'above') {
                newOffset = offset - numBytes;
            }
            if (scrollingBehavior === 'Infinite') {
                newCount = count + numBytes;
            } else {
                if (direction === 'below') {
                    newOffset = offset + numBytes;
                }
            }
            fetchMemory({ offset: newOffset, count: newCount });
        }
    };

    return (
        <div
            className='more-memory-select'
            tabIndex={0}
            role='button'
            onClick={loadMoreMemory}
            onKeyDown={loadMoreMemory}
            ref={containerRef}
        >
            <div className='more-memory-select-top no-select'>
                Load
                <select
                    className='bytes-select'
                    onChange={onSelectChange}
                    tabIndex={0}
                >
                    {options.map(option => (
                        <option
                            key={`more-memory-select-${option}`}
                            value={option}
                        >
                            {option}
                        </option>))}
                </select>
                {`more bytes ${direction}`}
            </div>
        </div>
    );
};

interface MemoryTableProps extends TableRenderOptions, MemoryDisplayConfiguration {
    memory?: Memory;
    decorations: Decoration[];
    offset: number;
    count: number;
    fetchMemory(partialOptions?: Partial<DebugProtocol.ReadMemoryArguments>): Promise<void>;
    isMemoryFetching: boolean;
}

interface MemoryRowListOptions {
    numRows: number;
    wordsPerRow: number;
    bigWordsPerRow: bigint;
}

interface MemoryRowData {
    rowIndex: number;
    startAddress: bigint;
    endAddress: bigint;
}

interface MemoryTableState {
    memory?: Memory;
    data: MemoryRowData[];
    selectedData: Nullable<DataTableCellSelection<MemoryRowData[]>>;
}

const itemHeightSingleGroupPerRow = 31;
const heightGroupsPerRowGain = 14;

export class MemoryTable extends React.Component<MemoryTableProps, MemoryTableState> {

    protected datatableRef;

    protected get isShowMoreEnabled(): boolean {
        return !!this.props.memory?.bytes.length;
    }

    constructor(props: MemoryTableProps) {
        super(props);

        this.datatableRef = React.createRef<DataTable<MemoryRowData[]>>();
        this.initState();
    }

    protected initState(): void {
        const memory = this.props.memory;
        const numRows = memory ? this.createMemoryRowListOptions(memory, this.props).numRows : 1;
        this.state = {
            data: Array.from({ length: numRows }),
            selectedData: null,
        };
    }

    public componentDidUpdate(prevProps: Readonly<MemoryTableProps>): void {
        this.onMemoryChange(this.props);
        this.onOptionsChange(prevProps, this.props);
    }

    /**
     * Updates the internal `state.data` to the new memory changes.
     */
    protected onMemoryChange(currentProps: Readonly<MemoryTableProps>): void {
        const state = this.state;
        const memory = currentProps.memory;

        if (!deepequal(memory, state.memory)) {
            this.resetState(currentProps);
        }
    }

    /**
     * Updates the internal `state.data` to respect the new options.
     *
     * **Details**
     *
     * Changes to the options restructures the whole datatable. We need to replace the old data with new the new memory.
     */
    protected onOptionsChange(prevProps: Readonly<MemoryTableProps>, currentProps: Readonly<MemoryTableProps>): void {
        if ((prevProps.wordsPerGroup !== currentProps.wordsPerGroup || prevProps.groupsPerRow !== currentProps.groupsPerRow)) {
            this.resetState(currentProps);
        }
    }

    public render(): React.ReactNode {
        const columnWidth = 100 / (this.props.columnOptions.length);
        const props = this.createDataTableProperties();

        return (
            <div className='flex-1 overflow-auto px-4'>
                <DataTable
                    ref={this.datatableRef}
                    {...props}
                >
                    {this.props.columnOptions.map(({ contribution }) => <Column
                        key={contribution.id}
                        field={contribution.id}
                        header={contribution.label}
                        style={{ width: `${columnWidth}%` }}
                        body={(row?: MemoryRowData) => row && contribution.render(row, this.props.memory!, this.props)}
                    >
                        {contribution.label}
                    </Column>)}
                </DataTable>
            </div>
        );
    }

    protected createDataTableProperties(): DataTableProps<MemoryRowData[]> {
        return {
            dataKey: 'startAddress',
            cellSelection: true,
            className: MemoryTable.TABLE_CLASS,
            footer: this.renderFooter(),
            header: this.renderHeader(),
            lazy: true,
            loading: false,
            metaKeySelection: false,
            onSelectionChange: this.onSelectionChanged,
            rowClassName: this.rowClass,
            resizableColumns: true,
            scrollable: true,
            scrollHeight: 'flex',
            selectionMode: 'single',
            selection: this.state.selectedData as DataTableCellSelection<MemoryRowData[]>,
            tableStyle: { minWidth: '30rem' },
            value: this.state.data,
            virtualScrollerOptions: {
                items: this.state.data,
                itemSize: itemHeightSingleGroupPerRow + heightGroupsPerRowGain * (this.props.groupsPerRow - 1),
            },
        };

    }

    protected onSelectionChanged = (event: DataTableSelectionCellChangeEvent<MemoryRowData[]>) => {
        this.setState(prev => ({ ...prev, selectedData: event.value }));
    };

    protected renderHeader(): React.ReactNode | undefined {
        const { offset, count, fetchMemory, scrollingBehavior } = this.props;

        let memorySelect: React.ReactNode | undefined;
        let loading: React.ReactNode | undefined;

        if (this.isShowMoreEnabled) {
            memorySelect = <div className='flex-auto'>
                <MoreMemorySelect
                    offset={offset}
                    count={count}
                    options={[128, 256, 512]}
                    direction='above'
                    scrollingBehavior={scrollingBehavior}
                    fetchMemory={fetchMemory}
                />
            </div>;
        }

        if (this.props.isMemoryFetching) {
            loading = <div className='absolute right-0 flex align-items-center'>
                <ProgressSpinner style={{ width: '16px', height: '16px' }} className='mr-2' />
                <span>Loading</span>
            </div>;
        }

        return (
            <div className='flex align-items-center'>
                {memorySelect}
                {loading}
            </div>
        );
    }

    protected renderFooter(): React.ReactNode | undefined {
        const { offset, count, fetchMemory, scrollingBehavior } = this.props;

        let memorySelect: React.ReactNode | undefined;

        if (this.isShowMoreEnabled) {
            memorySelect = <div className='flex-auto'>
                <MoreMemorySelect
                    offset={offset}
                    count={count}
                    options={[128, 256, 512]}
                    direction='below'
                    scrollingBehavior={scrollingBehavior}
                    fetchMemory={fetchMemory}
                />
            </div>;
        }

        return (
            <div className='flex align-items-center'>
                {memorySelect}
            </div>
        );
    }

    protected rowClass = (data?: DataTableRowData<MemoryRowData[]>) => {
        const css: string[] = [];

        if (data !== undefined && this.isGroupSeparatorRow(data)) {
            css.push(MemoryTable.GROUP_SEPARATOR);
        }

        return css;
    };

    protected isGroupSeparatorRow(row: MemoryRowData): boolean {
        return row.rowIndex % 4 === 3;
    }

    protected createTableRows(options: MemoryRowListOptions, first: number, last: number, memory?: Memory): MemoryRowData[] {
        if (memory === undefined) {
            return [];
        }

        const rows: MemoryRowData[] = [];
        for (let i = first; i < last && i < options.numRows; i++) {
            const startAddress = memory.address + options.bigWordsPerRow * BigInt(i);
            rows.push(this.createMemoryRow(i, startAddress, options));
        }

        return rows;
    }

    protected createMemoryRowListOptions(memory: Memory, props: MemoryTableProps): MemoryRowListOptions {
        const wordsPerRow = props.wordsPerGroup * props.groupsPerRow;
        const numRows = Math.ceil((memory.bytes.length * 8) / (wordsPerRow * props.wordSize));
        const bigWordsPerRow = BigInt(wordsPerRow);

        return {
            numRows,
            wordsPerRow,
            bigWordsPerRow
        };
    }

    protected createMemoryRow(rowIndex: number, startAddress: bigint, memoryTableOptions: MemoryRowListOptions): MemoryRowData {
        return {
            rowIndex,
            startAddress,
            endAddress: startAddress + memoryTableOptions.bigWordsPerRow
        };
    }

    protected resetState(props: MemoryTableProps): void {
        const memory = props.memory;
        let data: MemoryRowData[] = [];

        if (memory !== undefined) {
            const options = this.createMemoryRowListOptions(memory, props);
            data = this.createTableRows(options, 0, options.numRows, memory);
        }

        this.setState(({
            memory,
            data,
            selectedData: null
        }));
    }
}

export namespace MemoryTable {
    export const TABLE_CLASS = 'memory-inspector-table';
    export const GROUP_SEPARATOR = 'group-separator';
}
