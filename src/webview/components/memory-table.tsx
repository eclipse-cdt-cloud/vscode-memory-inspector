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
import { Decoration, Endianness, Memory } from '../utils/view-types';
import { toHexStringWithRadixMarker } from '../../common/memory-range';
import { decorationService } from '../decorations/decoration-service';

interface VariableDecoration {
    name: string;
    color: string;
    firstAppearance?: boolean;
}

interface GroupData {
    node: React.ReactNode;
    ascii: string; index: number;
    variables: VariableDecoration[];
    isHighlighted?: boolean;
}

interface ByteData {
    node: React.ReactNode;
    ascii: string; index: number;
    variables: VariableDecoration[];
    isHighlighted?: boolean;
}

interface ItemData {
    node: React.ReactNode;
    content: string;
    variable?: VariableDecoration;
    index: number;
    isHighlighted?: boolean;
}

interface StylableNodeAttributes {
    className?: string;
    style?: React.CSSProperties;
    variable?: VariableDecoration;
    title?: string;
    isHighlighted?: boolean;
}

interface FullNodeAttributes extends StylableNodeAttributes {
    content: string;
}

interface RowOptions {
    address: string;
    groups: React.ReactNode;
    ascii?: string;
    variables?: VariableDecoration[];
    doShowDivider?: boolean;
    index: number;
    isHighlighted?: boolean;
}

interface MemoryTableProps {
    memory?: Memory;
    decorations: Decoration[];
    endianness: Endianness;
    byteSize: number;
    bytesPerGroup: number;
    groupsPerRow: number;
}

export class MemoryTable extends React.Component<MemoryTableProps> {
    public render(): React.ReactNode {
        const rows = this.getTableRows();
        return (
            <div>
                <VSCodeDataGrid>
                    <VSCodeDataGridRow rowType='header'>
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='1'>
                            Address
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='2'>
                            Groups
                        </VSCodeDataGridCell>
                    </VSCodeDataGridRow>
                    {rows}
                </VSCodeDataGrid>
            </div>
        );
    }

    protected getTableRows(): React.ReactNode {
        if (!this.props.memory) {
            return (
                <VSCodeDataGridRow>
                    <VSCodeDataGridCell gridColumn='1'>No Data</VSCodeDataGridCell>
                    <VSCodeDataGridCell gridColumn='2'>No Data</VSCodeDataGridCell>
                </VSCodeDataGridRow>
            );
        }

        return [...this.renderRows(this.props.memory.bytes, this.props.memory.address)];
    }

    protected *renderRows(iteratee: Uint8Array, address: bigint): IterableIterator<React.ReactNode> {
        const bytesPerRow = this.props.bytesPerGroup * this.props.groupsPerRow;
        let rowsYielded = 0;
        let groups = [];
        let ascii = '';
        let variables = [];
        let isRowHighlighted = false;
        for (const { node, index, ascii: groupAscii, variables: groupVariables, isHighlighted = false } of this.renderGroups(iteratee, address)) {
            groups.push(node);
            ascii += groupAscii;
            variables.push(...groupVariables);
            isRowHighlighted = isRowHighlighted || isHighlighted;
            if (groups.length === this.props.groupsPerRow || index === iteratee.length - 1) {
                const rowAddress = address + BigInt(bytesPerRow * rowsYielded);
                const options = {
                    address: toHexStringWithRadixMarker(rowAddress),
                    doShowDivider: (rowsYielded % 4) === 3,
                    isHighlighted: isRowHighlighted,
                    ascii,
                    groups,
                    variables,
                    index,
                };
                yield this.renderRow(options);
                ascii = '';
                variables = [];
                groups = [];
                rowsYielded += 1;
                isRowHighlighted = false;
            }
        }
    }

    protected *renderGroups(iteratee: Uint8Array, address: bigint): IterableIterator<GroupData> {
        let bytesInGroup: React.ReactNode[] = [];
        let ascii = '';
        let variables = [];
        let isGroupHighlighted = false;
        for (const { node, index, ascii: byteAscii, variables: byteVariables, isHighlighted = false } of this.renderBytes(iteratee, address)) {
            bytesInGroup.push(node);
            ascii += byteAscii;
            variables.push(...byteVariables);
            isGroupHighlighted = isGroupHighlighted || isHighlighted;
            if (bytesInGroup.length === this.props.bytesPerGroup || index === iteratee.length - 1) {
                const itemID = address + BigInt(index);
                if (this.props.endianness === Endianness.Little) {
                    bytesInGroup.reverse();
                }
                yield {
                    node: <span className='byte-group' key={itemID.toString(16)}>{bytesInGroup}</span>,
                    ascii,
                    index,
                    variables,
                    isHighlighted: isGroupHighlighted,
                };
                bytesInGroup = [];
                ascii = '';
                variables = [];
                isGroupHighlighted = false;
            }
        }
    }

    protected *renderBytes(iteratee: Uint8Array, address: bigint): IterableIterator<ByteData> {
        const itemsPerByte = this.props.byteSize / 8;
        let currentByte = 0;
        let chunksInByte: React.ReactNode[] = [];
        let variables: VariableDecoration[] = [];
        let isByteHighlighted = false;
        for (const { node, content, index, variable, isHighlighted = false } of this.renderArrayItems(iteratee, address)) {
            chunksInByte.push(node);
            const numericalValue = parseInt(content, 16);
            currentByte = (currentByte << 8) + numericalValue;
            isByteHighlighted = isByteHighlighted || isHighlighted;
            if (variable?.firstAppearance) {
                variables.push(variable);
            }
            if (chunksInByte.length === itemsPerByte || index === iteratee.length - 1) {
                const itemID = address + BigInt(index);
                const ascii = this.getASCIIForSingleByte(currentByte);
                yield {
                    node: <span className='single-byte' key={itemID.toString(16)}>{chunksInByte}</span>,
                    ascii,
                    index,
                    variables,
                    isHighlighted: isByteHighlighted,
                };
                currentByte = 0;
                chunksInByte = [];
                variables = [];
                isByteHighlighted = false;
            }
        }
    }

    protected *renderArrayItems(iteratee: Uint8Array, address: bigint): IterableIterator<ItemData> {
        const getBitAttributes = this.getBitAttributes.bind(this);
        for (let i = 0; i < iteratee.length; i += 1) {
            const itemID = toHexStringWithRadixMarker(address + BigInt(i));
            const { content = '', className, style, variable, title, isHighlighted } = getBitAttributes(i, iteratee, address);
            const node = (
                <span
                    style={style}
                    key={itemID}
                    className={className}
                    data-id={itemID}
                    title={title}
                >
                    {content}
                </span>
            );
            yield {
                node,
                content,
                index: i,
                variable,
                isHighlighted,
            };
        }
    }

    protected getBitAttributes(arrayOffset: number, iteratee: Uint8Array, address: bigint): Partial<FullNodeAttributes> {
        const currentCellAddress = (address + BigInt(arrayOffset));
        const classNames = ['eight-bits'];
        return {
            className: classNames.join(' '),
            variable: undefined,
            style: decorationService.getDecoration(currentCellAddress)?.style,
            content: iteratee[arrayOffset].toString(16).padStart(2, '0')
        };
    }

    protected getASCIIForSingleByte(byte: number | undefined): string {
        const isPrintableAsAscii = (input: number): boolean => input >= 32 && input < (128 - 1);

        return typeof byte === 'undefined'
            ? ' ' : isPrintableAsAscii(byte) ? String.fromCharCode(byte) : '.';
    }

    protected renderRow(options: RowOptions, getRowAttributes = this.getRowAttributes.bind(this)): React.ReactNode {
        const { address, groups } = options;
        const { className, style, title } = getRowAttributes(options);
        return (
            <VSCodeDataGridRow
                // Add a marker to help visual navigation when scrolling
                className={className}
                style={style}
                title={title}
                key={address}
            >
                <VSCodeDataGridCell style={{ fontFamily: 'var(--vscode-editor-font-family)' }} gridColumn='1'>{address}</VSCodeDataGridCell>
                <VSCodeDataGridCell style={{ fontFamily: 'var(--vscode-editor-font-family)' }} gridColumn='2'>{groups}</VSCodeDataGridCell>
            </VSCodeDataGridRow>
        );
    }

    protected getRowAttributes(options: Partial<RowOptions>): Partial<StylableNodeAttributes> {
        let className = 'row';
        if (options.doShowDivider) {
            className += ' divider';
        }
        return { className };
    }
}
