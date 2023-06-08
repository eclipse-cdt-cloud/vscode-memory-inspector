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
import { Decoration, Memory, StylableNodeAttributes } from '../utils/view-types';
import { toHexStringWithRadixMarker } from '../../common/memory-range';
import { TableRenderOptions } from '../columns/column-contribution-service';

interface MemoryTableProps extends TableRenderOptions {
    memory?: Memory;
    decorations: Decoration[];
}

export class MemoryTable extends React.Component<MemoryTableProps> {
    public render(): React.ReactNode {
        const rows = this.getTableRows();
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
                    {rows}
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
