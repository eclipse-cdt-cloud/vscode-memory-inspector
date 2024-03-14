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

import * as React from 'react';
import { BigIntMemoryRange, Endianness, toHexStringWithRadixMarker, toOffset } from '../../common/memory-range';
import { FullNodeAttributes } from '../utils/view-types';
import { ColumnContribution, TableRenderOptions } from './column-contribution-service';
import { decorationService } from '../decorations/decoration-service';
import type { MemorySizeOptions } from '../components/memory-table';
import { elementInnerWidth, characterWidthInContainer } from '../utils/window';
import { Memory } from '../../common/memory';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import { messenger } from '../view-messenger';
import { writeMemoryType } from '../../common/messaging';
import { DebugProtocol } from '@vscode/debugprotocol';
import { InputText } from 'primereact/inputtext';

export interface DataColumnByteGroup {
    startAddress: bigint;
    endAddress: bigint;
    words: DataColumnWord[];
}

export interface DataColumnWord {
    address: bigint;
    initialOffset: number;
    finalOffset: number;
    bits: DataColumnBit[];
}

export interface DataColumnBit {
    address: bigint;
    offset: number;
    value: string;
}

export class DataColumn implements ColumnContribution {
    static CLASS_NAME = 'column-data';

    readonly id = 'data';
    readonly className = DataColumn.CLASS_NAME;
    readonly label = 'Data';
    readonly priority = 1;

    render(range: BigIntMemoryRange, memory: Memory, options: TableRenderOptions): React.ReactNode {
        const byteGroups = this.parse({ memory, range, renderOptions: options });
        return byteGroups.map(group =>
            <EditableDataColumnGroup key={group.startAddress.toString(16)} range={range} group={group} options={options} writeMemory={this.writeMemory}></EditableDataColumnGroup>);
    }

    protected writeMemory = async (writeArguments: DebugProtocol.WriteMemoryArguments): Promise<void> => {
        await messenger.sendRequest(writeMemoryType, HOST_EXTENSION, writeArguments);
    };

    // Parse the provided memory, so that we can separate UI from data
    protected parse(options: { range: BigIntMemoryRange, memory: Memory, renderOptions: TableRenderOptions }): DataColumnByteGroup[] {
        const { memory, range, renderOptions } = options;

        const getBits = (address: bigint, offset: number): DataColumnBit => ({
            address,
            offset,
            value: (memory.bytes[offset] ?? 0).toString(16).padStart(2, '0')
        });

        const getWords = (address: bigint): DataColumnWord => {
            const initialOffset = toOffset(memory.address, address, renderOptions.bytesPerWord * 8);
            const finalOffset = initialOffset + renderOptions.bytesPerWord;

            const bytes: DataColumnWord = {
                address,
                initialOffset,
                finalOffset,
                bits: []
            };

            for (let i = initialOffset; i < finalOffset; i++) {
                bytes.bits.push(getBits(address, i));
            }

            bytes.bits = this.applyEndianness(bytes.bits, renderOptions);
            return bytes;
        };

        const byteGroups: DataColumnByteGroup[] = [];

        let words: DataColumnWord[] = [];
        let startAddress = range.startAddress;
        for (let i = range.startAddress; i < range.endAddress; i++) {
            words.push(getWords(i));
            if (words.length % renderOptions.wordsPerGroup === 0) {
                words = this.applyEndianness(words, renderOptions);
                const endAddress = i;
                byteGroups.push({
                    startAddress,
                    endAddress,
                    words
                });
                startAddress = endAddress + 1n;
                words = [];
            }
        }

        if (words.length) { byteGroups.push({ startAddress, endAddress: range.endAddress, words }); }

        return byteGroups;
    }

    protected applyEndianness<T>(group: T[], options: TableRenderOptions): T[] {
        // Assume data from the DAP comes in Big Endian so we need to revert the order if we use Little Endian
        return options.endianness === Endianness.Big ? group : group.reverse();
    }
}

export interface EditableDataColumnGroupProps {
    range: BigIntMemoryRange;
    group: DataColumnByteGroup;
    options: TableRenderOptions;
    writeMemory?(writeArguments: DebugProtocol.WriteMemoryArguments): Promise<void>;
}

export interface EditableDataColumnGroupState {
    value: string;
    isEdit: boolean;
}

export class EditableDataColumnGroup extends React.Component<EditableDataColumnGroupProps, EditableDataColumnGroupState> {

    constructor(props: EditableDataColumnGroupProps) {
        super(props);

        this.state = {
            isEdit: false,
            value: this.asLine(this.props.group)
        };
    }

    protected byteGroupStyle: React.CSSProperties = {
        marginRight: `${DataColumn.Styles.MARGIN_RIGHT_PX}px`
    };

    protected get renderableCharacters(): number {
        return this.props.options.bytesPerWord * this.props.options.wordsPerGroup * 2;
    }

    render(): React.ReactNode {
        if (this.state.isEdit) {
            return this.renderEditingGroup();
        }

        return this.renderReadonlyGroup();
    }

    componentDidUpdate(_prevProps: Readonly<EditableDataColumnGroupProps>, prevState: Readonly<EditableDataColumnGroupState>): void {
        if (prevState.isEdit === false && this.state.isEdit) {
            this.setState(prev => ({ ...prev, value: this.asLine(this.props.group) }));
        }
    }

    protected asLine(group: DataColumnByteGroup): string {
        return group.words.flatMap(w => w.bits.flatMap(b => b.value).join('')).join('');
    }

    protected renderEditingGroup(): React.ReactNode {
        const { endAddress } = this.props.group;
        const isLast = endAddress === this.props.range.endAddress;

        const style: React.CSSProperties = {
            ...decorationService.getDecoration(this.props.group.startAddress)?.style,
            width: `calc(${this.renderableCharacters}ch + 10px)`,
            padding: '0 4px',
            marginRight: isLast ? undefined : this.byteGroupStyle.marginRight,
            minHeight: 'unset',
            border: '1px solid var(--vscode-inputOption-activeBorder)',
            background: 'unset'
        };

        return <InputText key={this.props.group.startAddress.toString(16)}
            maxLength={this.renderableCharacters}
            value={this.state.value}
            onKeyDown={this.onKeyDown}
            onChange={this.onChange}
            autoFocus
            style={style}
            onBlur={this.onBlur}
        ></InputText>;
    }

    protected renderReadonlyGroup(): React.ReactNode {
        const { startAddress, endAddress, words } = this.props.group;
        const isLast = endAddress === this.props.range.endAddress;
        const style: React.CSSProperties | undefined = isLast ? undefined : this.byteGroupStyle;
        return <span className='byte-group editable' style={style} key={startAddress.toString(16)} onClick={this.enableEdit}>{
            words.map(w => this.renderWord(w))
        }</span>;
    }

    protected renderWord(word: DataColumnWord): React.ReactNode {
        return <span className='single-word' key={word.address.toString(16)}>{
            word.bits.map(b => this.renderEightBits(b))
        }</span>;
    }

    protected renderEightBits(bit: DataColumnBit): React.ReactNode {
        const { content, className, style, title } = this.getBitAttributes(bit);
        return <span
            style={style}
            key={bit.offset.toString(16)}
            className={className}
            data-id={bit.offset}
            title={title}
        >
            {content}
        </span>;
    }

    protected getBitAttributes(bit: DataColumnBit): FullNodeAttributes {
        return {
            className: 'eight-bits',
            style: decorationService.getDecoration(bit.address)?.style,
            content: bit.value
        };
    }

    protected enableEdit: React.MouseEventHandler = event => {
        this.setState(prev => ({ ...prev, isEdit: true }));
        event.stopPropagation();
    };

    protected disableEdit = () => {
        this.setState(prev => ({ ...prev, isEdit: false, value: this.asLine(this.props.group) }));
    };

    protected onBlur: React.FocusEventHandler<HTMLInputElement> = () => {
        this.disableEdit();
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

    protected onChange: React.ChangeEventHandler<HTMLInputElement> = event => {
        this.setState(prev => ({ ...prev, value: event.target.value }));
    };

    protected async submitChanges(): Promise<void> {
        const newData = this.processData(this.state.value);
        const original = this.processData(this.asLine(this.props.group));

        if (newData && newData !== original) {
            const converted = Buffer.from(newData, 'hex').toString('base64');
            await this.props.writeMemory?.({
                memoryReference: toHexStringWithRadixMarker(this.props.group.startAddress),
                data: converted
            });
        }

        this.disableEdit();
    }

    protected processData(data: string): string {
        // Revert Endianness
        if (this.props.options.endianness === Endianness.Little) {
            const chunks = data.padStart(this.renderableCharacters, '0').match(/.{1,2}/g) || [];
            return chunks.reverse().join('');
        }

        return data.padStart(this.renderableCharacters, '0');
    }
}

export namespace DataColumn {
    export namespace Styles {
        export const MARGIN_RIGHT_PX = 2;
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
        const groupWidth = charactersWidth
            * 2 // characters per byte
            * options.bytesPerWord
            * options.wordsPerGroup
            + Styles.MARGIN_RIGHT_PX;
        // Accommodate the non-existent margin of the final element.
        const maxGroups = Math.max((columnWidth + Styles.MARGIN_RIGHT_PX) / groupWidth, 1);

        return Math.floor(maxGroups);
    }
}
