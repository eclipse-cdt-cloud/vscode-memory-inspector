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

import React, { ReactNode } from 'react';
import * as manifest from '../../common/manifest';
import { toOffset } from '../../common/memory-range';
import { MemoryRowData } from '../components/memory-table';
import { ColumnContribution, ColumnRenderProps } from './column-contribution-service';
import { createDefaultSelection, groupAttributes, SelectionProps } from './table-group';

function isPrintableAsAscii(input: number): boolean {
    return input >= 32 && input < (128 - 1);
};

function getASCIIForSingleByte(byte: number | undefined): string {
    return typeof byte === 'undefined'
        ? ' ' : isPrintableAsAscii(byte) ? String.fromCharCode(byte) : '.';
}

export class AsciiColumn implements ColumnContribution {
    static ID = manifest.CONFIG_SHOW_ASCII_COLUMN;
    readonly id = AsciiColumn.ID;
    readonly label = 'ASCII';
    readonly priority = 3;

    render(columnIndex: number, row: MemoryRowData, config: ColumnRenderProps): ReactNode {
        const selectionProps: SelectionProps = {
            createSelection: (event, position) => createDefaultSelection(event, position, AsciiColumn.ID, row),
            getSelection: () => config.selection,
            setSelection: config.setSelection
        };
        const groupProps = groupAttributes({ columnIndex, rowIndex: row.rowIndex, groupIndex: 0, maxGroupIndex: 0 }, selectionProps);
        const mauSize = config.tableConfig.bytesPerMau * 8;
        const startOffset = toOffset(config.memory.address, row.startAddress, mauSize);
        const endOffset = toOffset(config.memory.address, row.endAddress, mauSize);
        let result = '';
        for (let i = startOffset; i < endOffset; i++) {
            result += getASCIIForSingleByte(config.memory.bytes[i]);
        }
        return <span data-column='ascii' className='ascii' {...groupProps}>{result}</span>;
    }
}
