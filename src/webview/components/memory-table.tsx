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
import { Decoration, Endianness, Memory, StylableNodeAttributes } from '../utils/view-types';
import { toHexStringWithRadixMarker } from '../../common/memory-range';
import { ColumnStatus } from '../columns/column-contribution-service';

interface MemoryTableProps {
    memory?: Memory;
    decorations: Decoration[];
    columns: ColumnStatus[];
    endianness: Endianness;
    wordSize: number;
    bytesPerGroup: number;
    groupsPerRow: number;
}

export class MemoryTable extends React.Component<MemoryTableProps> {
    public render(): React.ReactNode {
        const rows = this.getTableRows();
        return (
            <div>
                <VSCodeDataGrid>
                    <VSCodeDataGridRow rowType='header' gridTemplateColumns={new Array(this.props.columns.length + 2).fill('1fr').join(' ')}>
                        {this.props.columns.map(({ contribution }, index) => <VSCodeDataGridCell key={contribution.id} cellType='columnheader' gridColumn={index.toString()}>
                            {contribution.label}
                        </VSCodeDataGridCell>)}
                    </VSCodeDataGridRow>
                    {rows}
                </VSCodeDataGrid>
            </div>
        );
    }

    private getTableRows(): React.ReactNode {
        if (!this.props.memory) {
            return (
                <VSCodeDataGridRow gridTemplateColumns={new Array(this.props.columns.length + 2).fill('1fr').join(' ')}>
                    <VSCodeDataGridCell gridColumn='1'>No Data</VSCodeDataGridCell>
                    <VSCodeDataGridCell gridColumn='2'>No Data</VSCodeDataGridCell>
                    {this.props.columns.map((column, index) =>
                        column.active
                        && <VSCodeDataGridCell key={column.contribution.id} gridColumn={(index + 3).toString()}>No Data</VSCodeDataGridCell>
                    )}
                </VSCodeDataGridRow>
            );
        }

        return this.renderRows(this.props.memory);
    }

    private renderRows(memory: Memory): React.ReactNode {
        const wordsPerRow = this.props.wordSize * this.props.bytesPerGroup;
        const numRows = Math.ceil(memory.bytes.length / wordsPerRow);
        const bigWordsPerRow = BigInt(wordsPerRow);
        const gridTemplateColumns = new Array(this.props.columns.length + 2).fill('1fr').join(' ');
        const rows = [];
        let startAddress = memory.address;
        for (let i = 0; i < numRows; i++) {
            rows.push(this.renderRow(startAddress, startAddress + bigWordsPerRow, gridTemplateColumns));
            startAddress += bigWordsPerRow;
        }
        return rows;
    }

    private renderRow(startAddress: bigint, endAddress: bigint, columnStyle: string, divider?: boolean): React.ReactNode {
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
                {this.props.columns.map((column, index) => (
                    <VSCodeDataGridCell key={column.contribution.id} style={{ fontFamily: 'var(--vscode-editor-font-family)' }} gridColumn={index.toString()}>
                        {column.contribution.render(range, this.props.memory!)}
                    </VSCodeDataGridCell>
                ))}
            </VSCodeDataGridRow>
        );
    }

    private getRowAttributes(divider?: boolean): Partial<StylableNodeAttributes> {
        let className = 'row';
        if (divider) {
            className += ' divider';
        }
        return { className };
    }
}
