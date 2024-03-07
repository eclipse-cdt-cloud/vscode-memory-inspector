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
    activeReadArguments: Required<DebugProtocol.ReadMemoryArguments>;
    options: number[];
    direction: 'above' | 'below';
    fetchMemory(partialOptions?: Partial<DebugProtocol.ReadMemoryArguments>): Promise<void>;
    disabled: boolean
}

export interface MoreMemoryAboveSelectProps extends MoreMemorySelectProps {
    direction: 'above';
    shouldPrepend?: boolean;
}

export interface MoreMemoryBelowSelectProps extends MoreMemorySelectProps {
    direction: 'below';
    shouldAppend?: boolean;
}

export const MoreMemorySelect: React.FC<MoreMemoryAboveSelectProps | MoreMemoryBelowSelectProps> = props => {
    const [numBytes, setNumBytes] = React.useState<number>(props.options[0]);
    const containerRef = React.createRef<HTMLDivElement>();
    const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        e.stopPropagation();
        const { value } = e.currentTarget;
        setNumBytes(parseInt(value));
    };

    const updateMemory = (e: React.MouseEvent | React.KeyboardEvent): void => {
        containerRef.current?.blur();
        if (isTrigger(e)) {
            const direction = props.direction;

            if (direction === 'above') {
                handleAboveDirection(props);
            } else if (direction === 'below') {
                handleBelowDirection(props);
            } else {
                throw new Error(`Unknown direction ${direction}`);
            }
        }
    };

    const handleAboveDirection = (aboveProps: MoreMemoryAboveSelectProps): void => {
        const { activeReadArguments, shouldPrepend, fetchMemory } = aboveProps;

        const newOffset = activeReadArguments.offset - numBytes;
        const newCount = shouldPrepend ? activeReadArguments.count + numBytes : activeReadArguments.count;

        fetchMemory({ offset: newOffset, count: newCount });
    };

    const handleBelowDirection = (belowProps: MoreMemoryBelowSelectProps): void => {
        const { activeReadArguments, fetchMemory } = belowProps;

        if (belowProps.shouldAppend) {
            const newCount = activeReadArguments.count + numBytes;
            fetchMemory({ count: newCount });
        } else {
            const newOffset = activeReadArguments.offset + numBytes;
            fetchMemory({ offset: newOffset });
        }
    };

    return (
        <div
            className={`more-memory-select ${props.disabled ? 'p-disabled' : ''}`}
            tabIndex={0}
            role='button'
            onClick={updateMemory}
            onKeyDown={updateMemory}
            ref={containerRef}
        >
            <div className='more-memory-select-top no-select'>
                Load
                <select
                    className={`bytes-select ${props.disabled ? 'p-disabled' : ''}`}
                    onChange={onSelectChange}
                    tabIndex={0}
                    disabled={props.disabled}
                >
                    {props.options.map(option => (
                        <option
                            key={`more-memory-select-${option}`}
                            value={option}
                        >
                            {option}
                        </option>))}
                </select>
                {`more bytes ${props.direction}`}
            </div>
        </div>
    );
};

interface MemoryTableProps extends TableRenderOptions, MemoryDisplayConfiguration {
    configuredReadArguments: Required<DebugProtocol.ReadMemoryArguments>;
    activeReadArguments: Required<DebugProtocol.ReadMemoryArguments>;
    memory?: Memory;
    decorations: Decoration[];
    effectiveAddressLength: number;
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

    protected get datatableWrapper(): HTMLElement | undefined {
        return this.datatableRef.current?.getElement().querySelector<HTMLElement>('[data-pc-section="wrapper"]') ?? undefined;
    }

    protected get isLoading(): boolean {
        return this.props.isMemoryFetching;
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

                // The size changed - we could have too few rows visible to enable a scrollbar
                if (this.props.scrollingBehavior === 'Auto-Append') {
                    this.ensureSufficientVisibleRowsForScrollbar();
                }
            }
        });

        const element = this.datatableRef.current?.getElement();
        if (element) {
            this.resizeObserver.observe(element);
        }
    }

    componentDidUpdate(prevProps: Readonly<MemoryTableProps>): void {
        const hasMemoryChanged = (prevProps.memory === undefined || this.props.memory === undefined)
            || prevProps.memory.address !== this.props.memory.address
            || prevProps.activeReadArguments.offset !== this.props.activeReadArguments.offset
            || prevProps.activeReadArguments.count !== this.props.activeReadArguments.count;

        const hasOptionsChanged = prevProps.wordsPerGroup !== this.props.wordsPerGroup || prevProps.groupsPerRow !== this.props.groupsPerRow;

        // Reset selection
        const selection = this.state.selection;
        if (selection && (hasMemoryChanged || hasOptionsChanged)) {
            // eslint-disable-next-line no-null/no-null
            this.setState(prev => ({ ...prev, selection: null }));
        }

        this.ensureGroupsPerRowToRenderIsSet();
        if (this.props.memory !== undefined && this.props.scrollingBehavior === 'Auto-Append') {
            this.ensureSufficientVisibleRowsForScrollbar();

            // We have now less count than before - there was a change from outside
            if (prevProps.memory !== undefined && prevProps.activeReadArguments.count > this.props.activeReadArguments.count) {
                this.datatableRef.current?.resetScroll();
            }

            // If we disable frozen, then we need to check the current position of the scrollbar and if necessary append more memory
            if (prevProps.isFrozen && !this.props.isFrozen) {
                const wrapper = this.datatableWrapper;
                if (wrapper) {
                    this.appendMoreMemoryOnListEnd(wrapper);
                }
            }
        }
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

        const props = this.createScrollingBehaviorSpecificProperties(this.createDataTableProperties(rows));
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
                        const isContentWidthFit = contribution.fittingType === 'content-width';
                        const className = classNames(contribution.className, {
                            'content-width-fit': isContentWidthFit
                        });

                        return <Column
                            key={contribution.id}
                            field={contribution.id}
                            header={contribution.label}
                            className={className}
                            headerClassName={className}
                            style={{ width: isContentWidthFit ? undefined : `${columnWidth}%` }}
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
            className: classNames(MemoryTable.TABLE_CLASS, { [MemoryTable.TABLE_GROUPS_PER_ROW_AUTOFIT]: this.props.groupsPerRow === 'Autofit' }),
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

    protected createScrollingBehaviorSpecificProperties(props: DataTableProps<MemoryRowData[]>): DataTableProps<MemoryRowData[]> {
        if (this.props.scrollingBehavior === 'Auto-Append') {
            return {
                ...props,
                pt: {
                    wrapper: {
                        onScroll: event => {
                            this.appendMoreMemoryOnListEnd(event.currentTarget);
                        }
                    }
                }
            };
        } else {
            return {
                ...props,
                footer: this.renderFooter()
            };
        }
    }

    /**
     * This method ensures that we have sufficient rows visible to enable vertical scrollbars
     */
    protected ensureSufficientVisibleRowsForScrollbar(): void {
        if (this.props.memory === undefined) {
            return;
        }

        const requestedBytesNotLoaded = this.props.activeReadArguments.count > this.props.memory.bytes.length;
        if (requestedBytesNotLoaded) {
            return;
        }

        const datatableValues = this.datatableRef.current?.props.value;
        if (datatableValues && datatableValues.length < MemoryTable.renderableRowsAtOnceCountForWrapper(this.datatableWrapper)) {
            // We have too few rows, we need to load more data
            this.appendMoreMemory();
        }
    }

    protected appendMoreMemory(): void {
        if (!this.isLoading && this.props.memory !== undefined) {
            const memorySizeOptions = MemorySizeOptions.create(this.props, this.state);
            const options = this.createMemoryRowListOptions(this.props.memory, memorySizeOptions);
            const newCount = this.props.activeReadArguments.count + options.wordsPerRow * MemoryTable.renderableRowsAtOnceCountForWrapper(this.datatableWrapper);
            this.props.fetchMemory({ count: newCount });
        }
    }

    protected appendMoreMemoryOnListEnd(element: HTMLElement): void {
        if (!this.isLoading) {
            // Append new data only if we reach the bottom
            const distanceBottom = Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight);

            if (distanceBottom < 1) {
                this.appendMoreMemory();
            }
        }
    }

    protected onSelectionChanged = (event: DataTableSelectionCellChangeEvent<MemoryRowData[]>) => {
        this.setState(prev => ({ ...prev, selection: event.value }));
    };

    protected onColumnResizeEnd = () => {
        this.autofitColumns();
    };

    protected renderHeader(): React.ReactNode | undefined {
        let memorySelect: React.ReactNode | undefined;
        let loading: React.ReactNode | undefined;

        if (this.props.memory !== undefined) {
            const prependScrollingBehaviors: ScrollingBehavior[] = ['Grow', 'Auto-Append'];
            memorySelect = <div className='flex-auto'>
                <MoreMemorySelect
                    activeReadArguments={this.props.activeReadArguments}
                    options={[128, 256, 512]}
                    direction='above'
                    shouldPrepend={prependScrollingBehaviors.includes(this.props.scrollingBehavior)}
                    fetchMemory={this.props.fetchMemory}
                    disabled={this.props.isFrozen}
                />
            </div>;
        }

        if (this.isLoading) {
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
        let memorySelect: React.ReactNode | undefined;

        if (this.props.memory !== undefined) {
            memorySelect = <div className='flex-auto'>
                <MoreMemorySelect
                    activeReadArguments={this.props.activeReadArguments}
                    options={[128, 256, 512]}
                    direction='below'
                    shouldAppend={this.props.scrollingBehavior === 'Grow'}
                    fetchMemory={this.props.fetchMemory}
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
    export const TABLE_CLASS = 'memory-inspector-table' as const;
    export const TABLE_GROUPS_PER_ROW_AUTOFIT = 'groups-per-row-autofit' as const;

    /**
     * Approximates how many rows visually fit into the given wrapper without scrolling
     */
    export function visibleRowsCountInWrapper(wrapper?: HTMLElement): number {
        if (wrapper) {
            const row = wrapper.querySelector<HTMLElement>('tr');

            if (row) {
                return Math.ceil(wrapper.clientHeight / row.clientHeight);
            }
        }

        return 1;
    }

    /**
     * Returns the number of rows that the wrapper can render at once
     */
    export function renderableRowsAtOnceCountForWrapper(wrapper?: HTMLElement): number {
        const buffer = 8;
        return visibleRowsCountInWrapper(wrapper) + buffer;
    }
}
