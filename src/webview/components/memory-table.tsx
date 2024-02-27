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

import { DebugProtocol } from '@vscode/debugprotocol';
import isDeepEqual from 'fast-deep-equal';
import memoize from 'memoize-one';
import { Column } from 'primereact/column';
import { DataTable, DataTableCellSelection, DataTableProps, DataTableRowData, DataTableSelectionCellChangeEvent } from 'primereact/datatable';
import { ProgressSpinner } from 'primereact/progressspinner';
import { classNames } from 'primereact/utils';
import React from 'react';
import { AddressColumn } from '../columns/address-column';
import { ColumnStatus, TableRenderOptions } from '../columns/column-contribution-service';
import { Endianness, Memory, MemoryDisplayConfiguration, ScrollingBehavior, isTrigger } from '../utils/view-types';
import { MemoryAppContext } from './memory-app-provider';

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

interface MemoryTableProps {
    endianness: Endianness;
    columnOptions: ColumnStatus[];
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
    selection: DataTableCellSelection<MemoryRowData[]> | null;
}

type MemorySizeOptions = Pick<MemoryDisplayConfiguration, 'bytesPerWord' | 'wordsPerGroup' | 'groupsPerRow'>;
namespace MemorySizeOptions {
    export function create(context: MemoryAppContext): MemorySizeOptions {
        const { groupsPerRow, bytesPerWord, wordsPerGroup }: MemorySizeOptions = context;
        return {
            bytesPerWord,
            groupsPerRow,
            wordsPerGroup
        };
    }
}

export class MemoryTable extends React.PureComponent<MemoryTableProps, MemoryTableState> {
    static contextType = MemoryAppContext;
    declare context: MemoryAppContext;

    protected prevContext?: MemoryAppContext;

    protected datatableRef = React.createRef<DataTable<MemoryRowData[]>>();

    protected get isShowMoreEnabled(): boolean {
        return !!this.context.memory?.bytes.length;
    }

    constructor(props: MemoryTableProps) {
        super(props);

        this.initState();
    }

    protected initState(): void {
        this.state = {
            // eslint-disable-next-line no-null/no-null
            selection: null,
        };
    }

    componentDidUpdate(): void {
        if (this.prevContext && this.prevContext !== this.context) {
            const hasMemoryChanged = this.prevContext.memory?.address !== this.context.memory?.address
                || this.prevContext.offset !== this.context.offset || this.prevContext.count !== this.context.count;
            const hasOptionsChanged = this.prevContext.wordsPerGroup !== this.context.wordsPerGroup || this.prevContext.groupsPerRow !== this.context.groupsPerRow;

            // Reset selection
            const selection = this.state.selection;
            if (selection && (hasMemoryChanged || hasOptionsChanged)) {
                // eslint-disable-next-line no-null/no-null
                this.setState(prev => ({ ...prev, selection: null }));
            }
        }
        this.prevContext = this.context;
    }

    public render(): React.ReactNode {
        const memory = this.context.memory;
        let rows: MemoryRowData[] = [];

        if (memory) {
            const memorySizeOptions = MemorySizeOptions.create(this.context);
            const options = this.createMemoryRowListOptions(memory, memorySizeOptions);
            rows = this.createTableRows(memory, options);
        }

        const props = this.createDataTableProperties(rows);
        const remainingWidth = 99; // Available width in percent without the fit columns
        const columnWidth = remainingWidth / (this.props.columnOptions.length);

        return (
            <div className='flex-1 overflow-auto px-4'>
                <DataTable<MemoryRowData[]>
                    ref={this.datatableRef}
                    {...props}
                >
                    {this.props.columnOptions.map(({ contribution }) => {
                        const fit = contribution.id === AddressColumn.ID;
                        const renderOptions: TableRenderOptions = { columnOptions: this.props.columnOptions, endianness: this.props.endianness, ...this.context };
                        return <Column
                            key={contribution.id}
                            field={contribution.id}
                            header={contribution.label}
                            className={classNames({ fit })}
                            headerClassName={classNames({ fit })}
                            style={{ width: fit ? undefined : `${columnWidth}%` }}
                            body={(row?: MemoryRowData) => row && contribution.render(row, this.context.memory!, renderOptions)}>
                            {contribution.label}
                        </Column>;
                    })}
                </DataTable>
            </div >
        );
    }

    protected createDataTableProperties(rows: MemoryRowData[]): DataTableProps<MemoryRowData[]> {
        return {
            cellSelection: true,
            className: MemoryTable.TABLE_CLASS,
            footer: this.renderFooter(),
            header: this.renderHeader(),
            lazy: true,
            metaKeySelection: false,
            onSelectionChange: this.onSelectionChanged,
            rowClassName: this.rowClass,
            resizableColumns: true,
            scrollable: true,
            scrollHeight: 'flex',
            selectionMode: 'single',
            selection: this.state.selection,
            tableStyle: { minWidth: '30rem' },
            value: rows
        };

    }

    protected onSelectionChanged = (event: DataTableSelectionCellChangeEvent<MemoryRowData[]>) => {
        this.setState(prev => ({ ...prev, selection: event.value }));
    };

    protected renderHeader(): React.ReactNode | undefined {
        const { offset, count, fetchMemory, scrollingBehavior } = this.context;

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

        if (this.context.isMemoryFetching) {
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
        const { offset, count, fetchMemory, scrollingBehavior } = this.context;

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

    protected createTableRows = memoize((memory: Memory, options: MemoryRowListOptions): MemoryRowData[] => {
        const rows: MemoryRowData[] = [];
        for (let i = 0; i < options.numRows; i++) {
            const startAddress = memory.address + options.bigWordsPerRow * BigInt(i);
            rows.push(this.createMemoryRow(i, startAddress, options));
        }

        return rows;
    }, isDeepEqual);

    protected createMemoryRowListOptions(memory: Memory, options: MemorySizeOptions): MemoryRowListOptions {
        const wordsPerRow = options.wordsPerGroup * options.groupsPerRow;
        const numRows = Math.ceil((memory.bytes.length) / (wordsPerRow * options.bytesPerWord));
        const bigWordsPerRow = BigInt(wordsPerRow);

        return {
            numRows,
            wordsPerRow,
            bigWordsPerRow
        };
    };

    protected createMemoryRow(rowIndex: number, startAddress: bigint, memoryTableOptions: MemoryRowListOptions): MemoryRowData {
        return {
            rowIndex,
            startAddress,
            endAddress: startAddress + memoryTableOptions.bigWordsPerRow
        };
    }
}

export namespace MemoryTable {
    export const TABLE_CLASS = 'memory-inspector-table';
    export const GROUP_SEPARATOR = 'group-separator';
}
