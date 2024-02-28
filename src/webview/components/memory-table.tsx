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
import memoize from 'memoize-one';
import { Column } from 'primereact/column';
import { DataTable, DataTableCellSelection, DataTableProps, DataTableSelectionCellChangeEvent } from 'primereact/datatable';
import { ProgressSpinner } from 'primereact/progressspinner';
import React from 'react';
import { TableRenderOptions } from '../columns/column-contribution-service';
import { Decoration, Memory, MemoryDisplayConfiguration, ScrollingBehavior, isTrigger } from '../utils/view-types';
import isDeepEqual from 'fast-deep-equal';
import { classNames } from 'primereact/utils';
import { tryToNumber } from '../../common/typescript';
import { DataColumn } from '../columns/data-column';

export interface MoreMemorySelectProps {
    count: number;
    offset: number;
    options: number[];
    direction: 'above' | 'below';
    scrollingBehavior: ScrollingBehavior;
    fetchMemory(partialOptions?: Partial<DebugProtocol.ReadMemoryArguments>): Promise<void>;
    disabled: boolean
}

export const MoreMemorySelect: React.FC<MoreMemorySelectProps> = ({ count, offset, options, fetchMemory, direction, scrollingBehavior, disabled }) => {
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
            className={`more-memory-select ${disabled ? 'p-disabled' : ''}`}
            tabIndex={0}
            role='button'
            onClick={loadMoreMemory}
            onKeyDown={loadMoreMemory}
            ref={containerRef}
        >
            <div className='more-memory-select-top no-select'>
                Load
                <select
                    className={`bytes-select ${disabled ? 'p-disabled' : ''}`}
                    onChange={onSelectChange}
                    tabIndex={0}
                    disabled={disabled}
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
    isFrozen: boolean;
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
    /**
     * The value coming from {@link MemoryTableProps.groupsPerRow} can have non-numeric values such as `Autofit`.
     * For this reason, we need to transform the provided value to a numeric one to render correctly.
     */
    groupsPerRowToRender: number;
    selection: DataTableCellSelection<MemoryRowData[]> | null;
}

export type MemorySizeOptions = Pick<MemoryTableProps, 'bytesPerWord' | 'wordsPerGroup'> & { groupsPerRow: number };
export namespace MemorySizeOptions {
    export function create(props: MemoryTableProps, state: MemoryTableState): MemorySizeOptions {
        const { bytesPerWord, wordsPerGroup } = props;
        return {
            bytesPerWord,
            groupsPerRow: tryToNumber(props.groupsPerRow) ?? state.groupsPerRowToRender,
            wordsPerGroup
        };
    }
}

export class MemoryTable extends React.PureComponent<MemoryTableProps, MemoryTableState> {

    protected datatableRef = React.createRef<DataTable<MemoryRowData[]>>();
    protected resizeObserver?: ResizeObserver;

    protected get isShowMoreEnabled(): boolean {
        return !!this.props.memory?.bytes.length;
    }

    constructor(props: MemoryTableProps) {
        super(props);

        this.initState();
    }

    protected initState(): void {
        this.state = {
            groupsPerRowToRender: 1,
            // eslint-disable-next-line no-null/no-null
            selection: null,
        };
    }

    componentDidMount(): void {
        this.resizeObserver = new ResizeObserver(entries => {
            if (entries.length > 0) {
                this.autofitColumns();
            }
        });

        const element = this.datatableRef.current?.getElement();
        if (element) {
            this.resizeObserver.observe(element);
        }
    }

    componentDidUpdate(prevProps: Readonly<MemoryTableProps>): void {
        const hasMemoryChanged = prevProps.memory?.address !== this.props.memory?.address || prevProps.offset !== this.props.offset || prevProps.count !== this.props.count;
        const hasOptionsChanged = prevProps.wordsPerGroup !== this.props.wordsPerGroup || prevProps.groupsPerRow !== this.props.groupsPerRow;

        // Reset selection
        const selection = this.state.selection;
        if (selection && (hasMemoryChanged || hasOptionsChanged)) {
            // eslint-disable-next-line no-null/no-null
            this.setState(prev => ({ ...prev, selection: null }));
        }

        this.ensureGroupsPerRowToRenderIsSet();
    }

    componentWillUnmount(): void {
        this.resizeObserver?.disconnect();
    }

    public render(): React.ReactNode {
        const memory = this.props.memory;
        let rows: MemoryRowData[] = [];

        if (memory) {
            const memorySizeOptions = MemorySizeOptions.create(this.props, this.state);
            const options = this.createMemoryRowListOptions(memory, memorySizeOptions);
            rows = this.createTableRows(memory, options);
        }

        const props = this.createDataTableProperties(rows);
        // Available width in percent without the fit columns
        const remainingWidth = 100 -
            this.props.columnOptions.filter(c => c.contribution.fittingType === 'content-width').length;
        const columnWidth = remainingWidth / (this.props.columnOptions.length);

        return (
            <div className='flex-1 overflow-auto px-4'>
                <DataTable<MemoryRowData[]>
                    ref={this.datatableRef}
                    {...props}
                >
                    {this.props.columnOptions.map(({ contribution }) => {
                        const isContentWidhtFit = contribution.fittingType === 'content-width';
                        const className = classNames(contribution.className, {
                            'content-width-fit': isContentWidhtFit
                        });

                        return <Column
                            key={contribution.id}
                            field={contribution.id}
                            header={contribution.label}
                            className={className}
                            headerClassName={className}
                            style={{ width: isContentWidhtFit ? undefined : `${columnWidth}%` }}
                            body={(row?: MemoryRowData) => row && contribution.render(row, this.props.memory!, this.props)}>
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
            onColumnResizeEnd: this.onColumnResizeEnd,
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

    protected onColumnResizeEnd = () => {
        this.autofitColumns();
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
                    disabled={this.props.isFrozen}
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
                    disabled={this.props.isFrozen}
                />
            </div>;
        }

        return (
            <div className='flex align-items-center'>
                {memorySelect}
            </div>
        );
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

    /**
     * Triggers the autofitting for the columns
     */
    protected autofitColumns(): void {
        this.ensureGroupsPerRowToRenderIsSet();
    }

    /**
     * Ensures that the {@link MemoryTableState.groupsPerRowToRender} is correctly set.
     */
    protected ensureGroupsPerRowToRenderIsSet(): void {
        const groupsPerRowToRender = this.determineGroupsPerRowToRender();

        if (this.state.groupsPerRowToRender !== groupsPerRowToRender) {
            this.setState(prev => ({ ...prev, groupsPerRowToRender }));
        }
    }

    protected determineGroupsPerRowToRender(): number {
        const options = MemorySizeOptions.create(this.props, this.state);

        if (this.props.groupsPerRow === 'Autofit') {
            const row = this.datatableRef.current?.getElement().querySelector<HTMLElement>('tbody > tr');
            if (row) {
                return DataColumn.approximateGroupsPerRow(row, options);
            }
            return 1;
        }

        return options.groupsPerRow;
    }
}

export namespace MemoryTable {
    export const TABLE_CLASS = 'memory-inspector-table';
}
