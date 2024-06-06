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

import { ColumnPassThroughOptions } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { classNames } from 'primereact/utils';
import * as React from 'react';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import { Memory } from '../../common/memory';
import { BigIntMemoryRange, isWithin, toHexStringWithRadixMarker, toOffset } from '../../common/memory-range';
import { writeMemoryType } from '../../common/messaging';
import { BreakpointService, breakpointService } from '../breakpoints/breakpoint-service';
import type { MemoryRowData, MemorySizeOptions, MemoryTableSelection, MemoryTableState } from '../components/memory-table';
import { decorationService } from '../decorations/decoration-service';
import { Disposable, FullNodeAttributes } from '../utils/view-types';
import { createGroupVscodeContext } from '../utils/vscode-contexts';
import { characterWidthInContainer, elementInnerWidth, hasCtrlCmdMask } from '../utils/window';
import { messenger } from '../view-messenger';
import { AddressColumn } from './address-column';
import { ColumnContribution, ColumnRenderProps } from './column-contribution-service';
import {
    findGroup,
    getGroupPosition,
    groupAttributes,
    GroupPosition,
    handleGroupNavigation,
    handleGroupSelection,
    SelectionProps
} from './table-group';

export interface DataColumnSelection extends MemoryTableSelection {
    selectedRange: BigIntMemoryRange;
    editingRange?: BigIntMemoryRange;
}

export namespace DataColumnSelection {
    export function is(selection?: MemoryTableSelection): selection is DataColumnSelection {
        return !!selection && 'selectedRange' in selection;
    }
}

export class DataColumn implements ColumnContribution {
    static ID = 'data';
    static CLASS_NAME = 'column-data';

    readonly id = DataColumn.ID;
    readonly className = DataColumn.CLASS_NAME;
    readonly label = 'Data';
    readonly priority = 1;

    protected focusGroupInstead(event: React.FocusEvent): void {
        const previous = event.relatedTarget as HTMLOrSVGElement | null;
        if (previous?.dataset['column'] === AddressColumn.ID) {
            (event.target.firstElementChild as unknown as HTMLOrSVGElement)?.focus?.();
            event.stopPropagation();
        }
        if (!!previous?.dataset['column']) {
            (event.target.lastElementChild as unknown as HTMLOrSVGElement)?.focus?.();
            event.stopPropagation();
        }
    }

    pt(_columnIndex: number, _state: MemoryTableState): ColumnPassThroughOptions {
        return {
            root: {
                onFocus: event => this.focusGroupInstead(event)
            }
        };
    }

    render(columnIndex: number, row: MemoryRowData, config: ColumnRenderProps): React.ReactNode {
        return <EditableDataColumnRow columnIndex={columnIndex} row={row} config={config} />;
    }
}

export function getAddressRange(element: HTMLOrSVGElement): BigIntMemoryRange | undefined {
    const start = element.dataset['rangeStart'];
    const end = element.dataset['rangeEnd'];
    if (!start || !end) { return undefined; }
    return { startAddress: BigInt(start), endAddress: BigInt(end) };
};

export interface EditableDataColumnRowProps {
    row: MemoryRowData;
    columnIndex: number;
    config: ColumnRenderProps;
}

export interface EditableDataColumnRowState {
    position?: GroupPosition;
}

export class EditableDataColumnRow extends React.Component<EditableDataColumnRowProps, EditableDataColumnRowState> {
    protected inputText = React.createRef<HTMLInputElement>();
    protected toDisposeOnUnmount?: Disposable;

    protected selectionProps: SelectionProps =
        {
            createSelection: (event, position) => this.createSelection(event, position),
            getSelection: () => this.props.config.selection,
            setSelection: this.props.config.setSelection
        };

    render(): React.ReactNode {
        return this.renderGroups();
    }

    componentDidUpdate(_prevProps: Readonly<EditableDataColumnRowProps>, prevState: Readonly<EditableDataColumnRowState>): void {
        const editingPosition = prevState?.position;
        if (editingPosition && !this.state.position) {
            // we went out of editing mode --> restore focus
            setTimeout(() => findGroup<HTMLElement>(editingPosition)?.focus());
        }
    }

    protected renderGroups(): React.ReactNode {
        const { row, config } = this.props;
        const groups = [];
        let maus: React.ReactNode[] = [];
        let address = row.startAddress;
        let groupStartAddress = address;
        let groupIdx = 0;
        while (address < row.endAddress) {
            maus.push(this.renderMau(config, address));
            const next = address + 1n;
            if (maus.length % config.tableConfig.mausPerGroup === 0) {
                this.applyEndianness(maus, config);
                groups.push(this.renderGroup(maus, groupStartAddress, next, groupIdx++));
                groupStartAddress = next;
                maus = [];
            }
            address = next;
        }
        if (maus.length) { groups.push(this.renderGroup(maus, groupStartAddress, row.endAddress, groupIdx)); }
        return groups;
    }

    protected renderGroup(maus: React.ReactNode, startAddress: bigint, endAddress: bigint, idx: number): React.ReactNode {
        const { config, row, columnIndex } = this.props;
        const groupProps = groupAttributes({
            rowIndex: row.rowIndex,
            columnIndex: columnIndex,
            groupIndex: idx,
            maxGroupIndex: this.props.config.groupsPerRowToRender - 1
        }, this.selectionProps);
        const breakpointMetadata = breakpointService.metadata(toHexStringWithRadixMarker(startAddress));

        return <span
            tabIndex={0}
            className={classNames('byte-group', 'hoverable', ...BreakpointService.inlineClasses(breakpointMetadata))}
            data-column='data'
            {...groupProps}
            data-range-start={startAddress}
            data-range-end={endAddress}
            key={startAddress.toString(16)}
            onKeyDown={this.onKeyDown}
            onDoubleClick={this.setGroupEdit}
            {...createGroupVscodeContext(startAddress, toOffset(startAddress, endAddress, config.tableConfig.bytesPerMau * 8), breakpointMetadata)}
        >
            {maus}
        </span>;
    }

    protected renderMau(props: ColumnRenderProps, currentAddress: bigint): React.ReactNode {
        if (DataColumnSelection.is(props.selection)) {
            if (currentAddress === props.selection.editingRange?.startAddress) {
                // render editable text field
                return this.renderEditingGroup(props.selection.editingRange);
            } else if (props.selection.editingRange && isWithin(currentAddress, props.selection.editingRange)) {
                // covered by the editable text field
                return;
            }
        }
        const initialOffset = toOffset(props.memory.address, currentAddress, props.tableConfig.bytesPerMau * 8);
        const finalOffset = initialOffset + props.tableConfig.bytesPerMau;
        const bytes: React.ReactNode[] = [];
        for (let i = initialOffset; i < finalOffset; i++) {
            bytes.push(this.renderEightBits(props.memory, currentAddress, i));
        }
        this.applyEndianness(bytes, props);
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
        const decoration = decorationService.getDecoration(currentAdress);
        return {
            className: classNames(...decoration?.classNames ?? [], 'eight-bits'),
            style: decoration?.style,
            content: (memory.bytes[offset] ?? 0).toString(16).padStart(2, '0')
        };
    }

    protected applyEndianness<T>(group: T[], options: ColumnRenderProps): T[] {
        // Assume data from the DAP comes in Big Endian so we need to revert the order if we use Little Endian
        return options.tableConfig.endianness === 'Big Endian' ? group : group.reverse();
    }

    protected renderEditingGroup(editedRange: BigIntMemoryRange): React.ReactNode {
        const defaultValue = this.createEditingGroupDefaultValue(editedRange);
        const decoration = decorationService.getDecoration(editedRange.startAddress);

        const style: React.CSSProperties = {
            ...decoration?.style,
            width: `calc(${defaultValue.length}ch + ${DataColumn.Styles.PADDING_RIGHT_LEFT_PX}px)` // we balance the two pixels with padding on the group
        };

        return <InputText key={editedRange.startAddress.toString(16)}
            ref={this.inputText}
            className={classNames(...decoration?.classNames ?? [], 'data-edit')}
            maxLength={defaultValue.length}
            defaultValue={defaultValue}
            onBlur={this.onBlur}
            onKeyDown={this.onEditKeyDown}
            autoFocus
            style={style}
        />;
    }

    protected createEditingGroupDefaultValue(editedRange: BigIntMemoryRange): string {
        const bitsPerMau = this.props.config.tableConfig.bytesPerMau * 8;

        const startOffset = toOffset(this.props.config.memory.address, editedRange.startAddress, bitsPerMau);
        const numBytes = toOffset(editedRange.startAddress, editedRange.endAddress, bitsPerMau);

        const area = Array.from(this.props.config.memory.bytes.slice(startOffset, startOffset + numBytes));
        this.applyEndianness(area, this.props.config);

        return area.map(byte => byte.toString(16).padStart(2, '0')).join('');
    }

    protected onBlur: React.FocusEventHandler<HTMLInputElement> = _event => {
        this.submitChanges();
    };

    protected onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = async event => {
        switch (event.key) {
            case ' ': {
                this.setGroupEdit(event);
                break;
            }
            case 'v': {
                if (hasCtrlCmdMask(event)) {
                    // paste clipboard text and submit as change
                    const range = getAddressRange(event.currentTarget);
                    if (range) {
                        const text = await navigator.clipboard.readText();
                        if (text.length > 0) {
                            this.submitChanges(text, range);
                        }
                    }
                }
                break;
            }
        }
        handleGroupNavigation(event);
        handleGroupSelection(event, this.selectionProps);
        event.stopPropagation();
    };

    protected onEditKeyDown: React.KeyboardEventHandler<HTMLInputElement> = event => {
        switch (event.key) {
            case 'Escape': {
                this.disableEdit();
                break;
            }
            case 'Enter': {
                this.submitChanges();
                break;
            }
        }
        event.stopPropagation();
    };

    protected setGroupEdit = (event: React.MouseEvent<HTMLSpanElement> | React.KeyboardEvent<HTMLSpanElement>) => {
        event.stopPropagation();
        const position = getGroupPosition(event.currentTarget);
        if (!position) {
            return;
        }
        const selection = this.createSelection(event, position);
        if (selection) {
            selection.editingRange = selection.selectedRange;
            this.props.config.setSelection(selection);
            this.setState({ position });
        }
    };

    protected createSelection(event: React.BaseSyntheticEvent, position: GroupPosition): DataColumnSelection | undefined {
        const range = getAddressRange(event.currentTarget);
        if (!position || !range) {
            return undefined;
        }
        return {
            row: this.props.row,
            column: { columnIndex: position.columnIndex, id: DataColumn.ID },
            group: { groupIndex: position.groupIndex },
            textContent: event.currentTarget.textContent ?? event.currentTarget.innerText,
            selectedRange: range,
            editingRange: undefined,
        };
    }

    protected disableEdit(): void {
        const selection = this.props.config.selection;
        if (DataColumnSelection.is(selection)) {
            selection.editingRange = undefined;
            this.props.config.setSelection({ ...selection });
            this.setState({ position: undefined });
        }
    }

    protected async submitChanges(data = this.inputText.current?.value, range?: BigIntMemoryRange): Promise<void> {
        if (!data || !DataColumnSelection.is(this.props.config.selection)) { return; }

        const editingRange = range ?? this.props.config.selection.editingRange;
        if (!editingRange) {
            return;
        }
        const originalData = this.createEditingGroupDefaultValue(editingRange);
        if (originalData !== data) {
            const newMemoryValue = this.processData(data, editingRange);
            const converted = Buffer.from(newMemoryValue, 'hex').toString('base64');
            await messenger.sendRequest(writeMemoryType, HOST_EXTENSION, {
                memoryReference: toHexStringWithRadixMarker(editingRange.startAddress),
                data: converted
            }).catch(() => { });
        }

        this.disableEdit();
    }

    protected processData(data: string, editedRange: BigIntMemoryRange): string {
        const characters = toOffset(editedRange.startAddress, editedRange.endAddress, this.props.config.tableConfig.bytesPerMau * 8) * 2;
        // Revert Endianness
        if (this.props.config.tableConfig.endianness === 'Little Endian') {
            const chunks = data.padStart(characters, '0').match(/.{2}/g) || [];
            return chunks.reverse().join('');
        }

        return data.padStart(characters, '0');
    }
}

export namespace DataColumn {
    export namespace Styles {
        // `padding: 4px 2px;` applies 2px right and left per group (see memory-table.css)
        export const PADDING_RIGHT_LEFT_PX = 4;
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
        ) + Styles.PADDING_RIGHT_LEFT_PX;
        // Accommodate the non-existent margin of the final element.
        const maxGroups = Math.max(columnWidth / groupWidth, 1);

        return Math.floor(maxGroups);
    }
}
