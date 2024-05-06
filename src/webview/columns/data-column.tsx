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

import { InputText } from 'primereact/inputtext';
import * as React from 'react';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import { Memory } from '../../common/memory';
import { BigIntMemoryRange, isWithin, toHexStringWithRadixMarker, toOffset } from '../../common/memory-range';
import { writeMemoryType } from '../../common/messaging';
import type { MemorySizeOptions } from '../components/memory-table';
import { decorationService } from '../decorations/decoration-service';
import { Disposable, FullNodeAttributes } from '../utils/view-types';
import { createGroupVscodeContext } from '../utils/vscode-contexts';
import { characterWidthInContainer, elementInnerWidth } from '../utils/window';
import { messenger } from '../view-messenger';
import { ColumnContribution, TableRenderOptions } from './column-contribution-service';

export class DataColumn implements ColumnContribution {
    static CLASS_NAME = 'column-data';

    readonly id = 'data';
    readonly className = DataColumn.CLASS_NAME;
    readonly label = 'Data';
    readonly priority = 1;

    render(range: BigIntMemoryRange, memory: Memory, options: TableRenderOptions): React.ReactNode {
        return <EditableDataColumnRow range={range} memory={memory} options={options} />;
    }
}

export interface EditableDataColumnRowProps {
    range: BigIntMemoryRange;
    memory: Memory;
    options: TableRenderOptions;
}

export interface EditableDataColumnRowState {
    editedRange?: BigIntMemoryRange;
}

export class EditableDataColumnRow extends React.Component<EditableDataColumnRowProps, EditableDataColumnRowState> {
    state: EditableDataColumnRowState = {};
    protected inputText = React.createRef<HTMLInputElement>();
    protected toDisposeOnUnmount?: Disposable;

    render(): React.ReactNode {
        return this.renderGroups();
    }

    protected renderGroups(): React.ReactNode {
        const { range, options, memory } = this.props;
        const groups = [];
        let maus: React.ReactNode[] = [];
        let address = range.startAddress;
        let groupStartAddress = address;
        while (address < range.endAddress) {
            maus.push(this.renderMau(memory, options, address));
            const next = address + 1n;
            if (maus.length % options.mausPerGroup === 0) {
                this.applyEndianness(maus, options);
                groups.push(this.renderGroup(maus, groupStartAddress, next));
                groupStartAddress = next;
                maus = [];
            }
            address = next;
        }
        if (maus.length) { groups.push(this.renderGroup(maus, groupStartAddress, range.endAddress)); }
        return groups;
    }

    protected renderGroup(maus: React.ReactNode, startAddress: bigint, endAddress: bigint): React.ReactNode {
        return <span
            className='byte-group hoverable'
            data-column='data'
            data-range={`${startAddress}-${endAddress}`}
            key={startAddress.toString(16)}
            onDoubleClick={this.setGroupEdit}
            {...createGroupVscodeContext(startAddress, toOffset(startAddress, endAddress, this.props.options.bytesPerMau * 8))}
        >
            {maus}
        </span>;
    }

    protected renderMau(memory: Memory, options: TableRenderOptions, currentAddress: bigint): React.ReactNode {
        if (currentAddress === this.state.editedRange?.startAddress) {
            return this.renderEditingGroup(this.state.editedRange);
        } else if (this.state.editedRange && isWithin(currentAddress, this.state.editedRange)) {
            return;
        }
        const initialOffset = toOffset(memory.address, currentAddress, options.bytesPerMau * 8);
        const finalOffset = initialOffset + options.bytesPerMau;
        const bytes: React.ReactNode[] = [];
        for (let i = initialOffset; i < finalOffset; i++) {
            bytes.push(this.renderEightBits(memory, currentAddress, i));
        }
        this.applyEndianness(bytes, options);
        return <span className='single-mau' data-address={currentAddress.toString()} key={currentAddress.toString(16)}>{bytes}</span>;
    }

    protected renderEightBits(memory: Memory, currentAddress: bigint, offset: number): React.ReactNode {
        const { content, className, style, title } = this.getBitAttributes(memory, currentAddress, offset);
        return <span
            style={style}
            key={offset.toString(16)}
            className={className}
            data-id={offset}
            title={title}
        >
            {content}
        </span>;
    }

    protected getBitAttributes(memory: Memory, currentAdress: bigint, offset: number): FullNodeAttributes {
        return {
            className: 'eight-bits',
            style: decorationService.getDecoration(currentAdress)?.style,
            content: (memory.bytes[offset] ?? 0).toString(16).padStart(2, '0')
        };
    }

    protected applyEndianness<T>(group: T[], options: TableRenderOptions): T[] {
        // Assume data from the DAP comes in Big Endian so we need to revert the order if we use Little Endian
        return options.endianness === 'Big Endian' ? group : group.reverse();
    }

    protected renderEditingGroup(editedRange: BigIntMemoryRange): React.ReactNode {
        const defaultValue = this.createEditingGroupDefaultValue(editedRange);

        const style: React.CSSProperties = {
            ...decorationService.getDecoration(editedRange.startAddress)?.style,
            width: `calc(${defaultValue.length}ch + 2px)` // we balance the two pixels with padding on the group
        };

        return <InputText key={editedRange.startAddress.toString(16)}
            ref={this.inputText}
            className='data-edit'
            maxLength={defaultValue.length}
            defaultValue={defaultValue}
            onBlur={this.onBlur}
            onKeyDown={this.onKeyDown}
            autoFocus
            style={style}
        />;
    }

    protected createEditingGroupDefaultValue(editedRange: BigIntMemoryRange): string {
        const bitsPerMau = this.props.options.bytesPerMau * 8;
        const startOffset = toOffset(this.props.memory.address, editedRange.startAddress, bitsPerMau);
        const numBytes = toOffset(editedRange.startAddress, editedRange.endAddress, bitsPerMau);

        const area = Array.from(this.props.memory.bytes.slice(startOffset, startOffset + numBytes));
        this.applyEndianness(area, this.props.options);

        return area.map(byte => byte.toString(16).padStart(2, '0')).join('');
    }

    protected onBlur: React.FocusEventHandler<HTMLInputElement> = () => {
        this.submitChanges();
    };

    protected onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = event => {
        switch (event.key) {
            case 'Escape': {
                this.disableEdit();
                break;
            }
            case 'Enter': {
                this.submitChanges();
            }
        }
        event.stopPropagation();
    };

    protected setGroupEdit: React.MouseEventHandler<HTMLSpanElement> = event => {
        event.stopPropagation();
        const range = event.currentTarget.dataset.range;
        if (!range) { return; }
        const [startAddress, endAddress] = range.split('-').map(BigInt);
        this.setState({ editedRange: { startAddress, endAddress } });
    };

    protected disableEdit(): void {
        this.setState({ editedRange: undefined });
    }

    protected async submitChanges(): Promise<void> {
        if (!this.inputText.current || !this.state.editedRange) { return; }

        const originalData = this.createEditingGroupDefaultValue(this.state.editedRange);
        if (originalData !== this.inputText.current.value) {
            const newMemoryValue = this.processData(this.inputText.current.value, this.state.editedRange);
            const converted = Buffer.from(newMemoryValue, 'hex').toString('base64');
            await messenger.sendRequest(writeMemoryType, HOST_EXTENSION, {
                memoryReference: toHexStringWithRadixMarker(this.state.editedRange.startAddress),
                data: converted
            }).catch(() => { });
        }

        this.disableEdit();
    }

    protected processData(data: string, editedRange: BigIntMemoryRange): string {
        const characters = toOffset(editedRange.startAddress, editedRange.endAddress, this.props.options.bytesPerMau * 8) * 2;
        // Revert Endianness
        if (this.props.options.endianness === 'Little Endian') {
            const chunks = data.padStart(characters, '0').match(/.{2}/g) || [];
            return chunks.reverse().join('');
        }

        return data.padStart(characters, '0');
    }
}

export namespace DataColumn {
    export namespace Styles {
        // `margin-right: 2px` per group (see memory-table.css)
        export const MARGIN_RIGHT_PX = 2;
        // `padding: 0 1px` applies 1px right and left per group (see memory-table.css)
        export const PADDING_RIGHT_LEFT_PX = 2;
    }

    /**
     * The approximation is done by:
     *
     * 1. Calculating the group width including factors such as character size
     * 2. Dividing column width by group width
     *
     * @returns Approximated groups per row that will fit into the element
     */
    export function approximateGroupsPerRow(row: HTMLElement, options: MemorySizeOptions): number {
        const element = row.querySelector<HTMLElement>(`.${DataColumn.CLASS_NAME}`);
        // eslint-disable-next-line no-null/no-null
        if (element === null) {
            return 1;
        }
        const columnWidth = elementInnerWidth(element);
        // The browser also rounds the character width
        const charactersWidth = Math.round((characterWidthInContainer(element, '0') + Number.EPSILON) * 100) / 100;
        const charactersPerByte = 2;
        const groupWidth = (
            charactersWidth
            * charactersPerByte
            * options.bytesPerMau
            * options.mausPerGroup
        ) + Styles.MARGIN_RIGHT_PX + Styles.PADDING_RIGHT_LEFT_PX;
        // Accommodate the non-existent margin of the final element.
        const maxGroups = Math.max((columnWidth + Styles.MARGIN_RIGHT_PX) / groupWidth, 1);

        return Math.floor(maxGroups);
    }
}
