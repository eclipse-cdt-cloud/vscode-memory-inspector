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

import React from 'react';
import {
    VSCodeDataGrid,
    VSCodeDataGridRow,
    VSCodeDataGridCell
} from '@vscode/webview-ui-toolkit/react';
import { Decoration, Memory, MemoryDisplayConfiguration, StylableNodeAttributes, isTrigger } from '../utils/view-types';
import { toHexStringWithRadixMarker } from '../../common/memory-range';
import { TableRenderOptions } from '../columns/column-contribution-service';
import { DebugProtocol } from '@vscode/debugprotocol';

export interface MoreMemorySelectProps {
    count: number;
    offset: number;
    options: number[];
    direction: 'above' | 'below';
    fetchMemory(partialOptions?: Partial<DebugProtocol.ReadMemoryArguments>): Promise<void>;
}

export const MoreMemorySelect: React.FC<MoreMemorySelectProps> = ({ count, offset, options, fetchMemory, direction }) => {
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
            newCount = count + numBytes;
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
}

export class MemoryTable extends React.Component<MemoryTableProps> {
    public render(): React.ReactNode {
        const rows = this.getTableRows();
        const { offset, count, memory, fetchMemory } = this.props;
        const showMoreMemoryButton = !!memory?.bytes.length;
        return (
            <div>
                <VSCodeDataGrid>
                    <VSCodeDataGridRow rowType='header' gridTemplateColumns={new Array(this.props.columnOptions.length).fill('1fr').join(' ')}>
                        {this.props.columnOptions.map(({ contribution }, index) => <VSCodeDataGridCell
                            key={contribution.id}
                            cellType='columnheader'
                            gridColumn={(index + 1).toString()}
                        >
                            {contribution.label}
                        </VSCodeDataGridCell>)}
                    </VSCodeDataGridRow>
                    {showMoreMemoryButton && (<MoreMemorySelect
                        offset={offset}
                        count={count}
                        options={[128, 256, 512]}
                        direction='above'
                        fetchMemory={fetchMemory}
                    />)}
                    {rows}
                    {showMoreMemoryButton && (<MoreMemorySelect
                        offset={offset}
                        count={count}
                        options={[128, 256, 512]}
                        direction='below'
                        fetchMemory={fetchMemory}
                    />)}
                </VSCodeDataGrid>
            </div>
        );
    }

    protected getTableRows(): React.ReactNode {
        if (!this.props.memory) {
            return (
                <VSCodeDataGridRow gridTemplateColumns={new Array(this.props.columnOptions.length).fill('1fr').join(' ')}>
                    {this.props.columnOptions.map((column, index) =>
                        column.active
                        && <VSCodeDataGridCell key={column.contribution.id} gridColumn={(index + 1).toString()}>No Data</VSCodeDataGridCell>
                    )}
                </VSCodeDataGridRow>
            );
        }

        return this.renderRows(this.props.memory);
    }

    protected renderRows(memory: Memory): React.ReactNode {
        const wordsPerRow = this.props.wordsPerGroup * this.props.groupsPerRow;
        const numRows = Math.ceil((memory.bytes.length * 8) / (wordsPerRow * this.props.wordSize));
        const bigWordsPerRow = BigInt(wordsPerRow);
        const gridTemplateColumns = new Array(this.props.columnOptions.length).fill('1fr').join(' ');
        const rows = [];
        let startAddress = memory.address;
        for (let i = 0; i < numRows; i++) {
            rows.push(this.renderRow(startAddress, startAddress + bigWordsPerRow, gridTemplateColumns, i % 4 === 3));
            startAddress += bigWordsPerRow;
        }
        return rows;
    }

    protected renderRow(startAddress: bigint, endAddress: bigint, columnStyle: string, divider?: boolean): React.ReactNode {
        const addressString = toHexStringWithRadixMarker(startAddress);
        const range = { startAddress, endAddress };
        const { title, style, className } = this.getRowAttributes(divider);
        return (
            <VSCodeDataGridRow
                // Add a marker to help visual navigation when scrolling
                className={className}
                style={style}
                title={title}
                key={addressString}
                gridTemplateColumns={columnStyle}
            >
                {this.props.columnOptions.map((column, index) => (
                    <VSCodeDataGridCell key={column.contribution.id} style={{ fontFamily: 'var(--vscode-editor-font-family)' }} gridColumn={(index + 1).toString()}>
                        {column.contribution.render(range, this.props.memory!, this.props)}
                    </VSCodeDataGridCell>
                ))}
            </VSCodeDataGridRow>
        );
    }

    protected getRowAttributes(divider?: boolean): Partial<StylableNodeAttributes> {
        const className = 'row';
        if (divider) {
            return { style: { borderBottom: '2px solid var(--vscode-editor-lineHighlightBorder)' }, className };
        }
        return { className };
    }
}
