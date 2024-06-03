/********************************************************************************
 * Copyright (C) 2024 Ericsson and others.
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

import { DOMAttributes, HTMLAttributes } from 'react';
import { MemoryRowData, MemoryTableSelection } from '../components/memory-table';

export interface GroupPosition {
    columnIndex: number;
    rowIndex: number;
    groupIndex: number;
    maxGroupIndex: number;
}

export namespace GroupPosition {
    export namespace Attributes {
        export const ColumnIndex = 'data-column-index';
        export const RowIndex = 'data-row-index';
        export const GroupIndex = 'data-group-index';
        export const MaxGroupIndex = 'data-max-group-index';
        export const GroupSelected = 'data-group-selected';
    }

    export namespace DataSet {
        export const ColumnIndex = 'columnIndex';
        export const RowIndex = 'rowIndex';
        export const GroupIndex = 'groupIndex';
        export const MaxGroupIndex = 'maxGroupIndex';
        export const GroupSelected = 'groupSelected';
    }
}

export interface GroupPositionHTMLAttributes {
    [GroupPosition.Attributes.ColumnIndex]?: number | undefined;
    [GroupPosition.Attributes.RowIndex]?: number | undefined;
    [GroupPosition.Attributes.GroupIndex]?: number | undefined;
    [GroupPosition.Attributes.MaxGroupIndex]?: number | undefined;
    [GroupPosition.Attributes.GroupSelected]?: boolean | undefined;
}

export interface GroupDOMStringMap extends DOMStringMap {
    [GroupPosition.DataSet.ColumnIndex]: string | undefined;
    [GroupPosition.DataSet.RowIndex]: string | undefined;
    [GroupPosition.DataSet.GroupIndex]: string | undefined;
    [GroupPosition.DataSet.MaxGroupIndex]: string | undefined;
    [GroupPosition.DataSet.GroupSelected]: string | undefined;
}

export function groupAttributes<T extends HTMLElement>(position: GroupPosition, selection?: SelectionProps): HTMLAttributes<T> & DOMAttributes<T> & Record<string, unknown> {
    return {
        role: 'group',
        tabIndex: 0,
        onKeyDown: event => handleGroupNavigation(event) || selection && handleGroupSelection(event, selection),
        onClick: event => selection && handleGroupSelection(event, selection),
        onCopy: handleCopy,
        onCut: handleCut,
        [GroupPosition.Attributes.ColumnIndex]: position.columnIndex,
        [GroupPosition.Attributes.RowIndex]: position.rowIndex,
        [GroupPosition.Attributes.GroupIndex]: position.groupIndex,
        [GroupPosition.Attributes.MaxGroupIndex]: position.maxGroupIndex,
        [GroupPosition.Attributes.GroupSelected]: isGroupSelected(position, selection?.getSelection())
    };
}

export function isGroupSelected(position: GroupPosition, selection?: MemoryTableSelection): boolean {
    return selection?.column.columnIndex === position.columnIndex
        && selection?.row.rowIndex === position.rowIndex
        && selection?.group.groupIndex === position.groupIndex;
}

export function getGroupPosition(element: Element): GroupPosition | undefined {
    const data = (element as unknown as HTMLOrSVGElement).dataset as GroupDOMStringMap;
    const columnIndex = data.columnIndex;
    const rowIndex = data.rowIndex;
    const groupIndex = data.groupIndex;
    const maxGroupIndex = data.maxGroupIndex;
    if (!columnIndex || !rowIndex || !groupIndex) { return undefined; }
    return { columnIndex: Number(columnIndex), rowIndex: Number(rowIndex), groupIndex: Number(groupIndex), maxGroupIndex: Number(maxGroupIndex) };
}

export function findGroup<T extends Element>(position: GroupPosition, element?: Element | null): T | undefined {
    const context = element ?? document.documentElement;
    // eslint-disable-next-line max-len
    const group = context.querySelector<T>(`[${GroupPosition.Attributes.ColumnIndex}="${position.columnIndex}"][${GroupPosition.Attributes.RowIndex}="${position.rowIndex}"][${GroupPosition.Attributes.GroupIndex}="${position.groupIndex}"]`);
    return !group ? undefined : group;
}

export function handleGroupNavigation<T extends HTMLElement>(event: React.KeyboardEvent<T>): boolean {
    switch (event.key) {
        case 'ArrowRight': {
            const rightGroup = findRightGroup<HTMLElement>(event.currentTarget);
            if (rightGroup) {
                rightGroup.focus();
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
            break;
        }
        case 'ArrowLeft': {
            const leftGroup = findLeftGroup<HTMLElement>(event.currentTarget);
            if (leftGroup) {
                leftGroup?.focus?.();
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
            break;
        }
        case 'ArrowUp': {
            const upGroup = findUpGroup<HTMLElement>(event.currentTarget);
            if (upGroup) {
                upGroup?.focus?.();
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
            break;
        }
        case 'ArrowDown': {
            const downGroup = findDownGroup<HTMLElement>(event.currentTarget);
            if (downGroup) {
                downGroup?.focus?.();
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
            break;
        }
        case 'c': {
            if (event.ctrlKey) {
                handleCopy(event);
            }
            break;
        }
        case 'x': {
            if (event.ctrlKey) {
                handleCut(event);
            }
            break;
        }
    }
    return false;
}

export function getDefaultSearchContext(element: Element): Element | null {
    return element.closest('p-datatable-tbody');
}

export function findLeftGroup<T extends Element>(element: Element, searchContext = getDefaultSearchContext(element)): T | undefined {
    const position = getGroupPosition(element);
    if (!position) {
        return undefined;
    }
    if (position.columnIndex === 0 && position.groupIndex === 0) {
        // we are already most left
        return undefined;
    }
    if (position.groupIndex === 0) {
        // we need to jump to the end of the previous column
        // so we search for the first group which has the necessary information
        const firstGroup = findGroup<T>({ ...position, columnIndex: position.columnIndex - 1, groupIndex: 0 }, searchContext);
        if (firstGroup) {
            const firstGroupPosition = getGroupPosition(firstGroup);
            if (firstGroupPosition?.maxGroupIndex !== undefined && firstGroupPosition.maxGroupIndex !== position?.groupIndex) {
                return findGroup<T>({ ...position, columnIndex: position.columnIndex - 1, groupIndex: firstGroupPosition.maxGroupIndex }, searchContext);
            }
        }
        return firstGroup;
    } else {
        return findGroup<T>({ ...position, groupIndex: position.groupIndex - 1 }, searchContext);
    }
}

export function findRightGroup<T extends Element>(element: Element, searchContext = getDefaultSearchContext(element)): T | undefined {
    const position = getGroupPosition(element);
    if (!position) {
        return undefined;
    }
    const nextGroup = findGroup<T>({ ...position, groupIndex: position.groupIndex + 1 }, searchContext);
    if (nextGroup) {
        return nextGroup;
    }
    // we try to jump to the start of the next column
    return findGroup<T>({ ...position, columnIndex: position.columnIndex + 1, groupIndex: 0 }, searchContext);
}

export function findUpGroup<T extends Element>(element: Element, searchContext = getDefaultSearchContext(element)): T | undefined {
    const position = getGroupPosition(element);
    return position ? findGroup<T>({ ...position, rowIndex: position.rowIndex - 1 }, searchContext) : undefined;
}

export function findDownGroup<T extends Element>(element: Element, searchContext = getDefaultSearchContext(element)): T | undefined {
    const position = getGroupPosition(element);
    return position ? findGroup<T>({ ...position, rowIndex: position.rowIndex + 1 }, searchContext) : undefined;
}

export interface SelectionProps {
    createSelection<T extends HTMLElement>(event: React.MouseEvent<T> | React.KeyboardEvent<T>, position: GroupPosition): MemoryTableSelection | undefined;
    getSelection(): MemoryTableSelection | undefined;
    setSelection(selection?: MemoryTableSelection): void;
}

export function createDefaultSelection(event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>, position: GroupPosition,
    columnId: string, row: MemoryRowData): MemoryTableSelection {
    return {
        row,
        column: { columnIndex: position.columnIndex, id: columnId },
        group: { groupIndex: position.groupIndex },
        textContent: event.currentTarget.textContent ?? event.currentTarget.innerText
    };
}

function handleCopy(event: React.ClipboardEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>): void {
    event.preventDefault();
    const textSelection = window.getSelection()?.toString();
    if (textSelection) {
        navigator.clipboard.writeText(textSelection);
    } else if (event.currentTarget.textContent) {
        navigator.clipboard.writeText(event.currentTarget.textContent);
    } else {
        navigator.clipboard.writeText(event.currentTarget.innerText);
    }
};

function handleCut(event: React.ClipboardEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>): void {
    handleCopy(event);
}

export function handleGroupSelection<T extends HTMLElement>(event: React.KeyboardEvent<T> | React.MouseEvent<T>, props: SelectionProps): boolean {
    if (!('key' in event) || event.key === 'Enter') {
        // mouse event or ENTER key event
        return toggleSelection(event, props);
    }
    return false;
}

export function toggleSelection<T extends HTMLElement>(event: React.MouseEvent<T> | React.KeyboardEvent<T>, props: SelectionProps): boolean {
    const position = getGroupPosition(event.currentTarget);
    if (!position) {
        return false;
    }
    const currentSelection = props.getSelection();
    if (isGroupSelected(position, currentSelection)) {
        // group is already selected
        if (event.ctrlKey) {
            // deselect
            props.setSelection();
        }
    } else {
        props.setSelection(props.createSelection(event, position));
    }
    event.stopPropagation();
    event.preventDefault();
    return true;
};

