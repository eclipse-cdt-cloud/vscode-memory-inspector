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
import { ReactNode } from 'react';
import { BigIntMemoryRange, toOffset } from '../../common/memory-range';
import { ColumnContribution, TableRenderOptions } from './column-contribution-service';
import { Memory } from '../utils/view-types';
import { chunkIntoN } from '../utils/arrays';

function isPrintableAsAscii(input: number): boolean {
    return input >= 32 && input < (128 - 1);
};

function getASCIIForSingleByte(byte: number | undefined): string {
    return typeof byte === 'undefined'
        ? ' ' : isPrintableAsAscii(byte) ? String.fromCharCode(byte) : '.';
}

export class AsciiColumn implements ColumnContribution {
    readonly id = 'ascii';
    readonly label = 'ASCII';
    readonly priority = 3;

    render(range: BigIntMemoryRange, memory: Memory, options: TableRenderOptions): ReactNode {
        const startOffset = toOffset(memory.address, range.startAddress, options.wordSize);
        const endOffset = toOffset(memory.address, range.endAddress, options.wordSize);

        const indices = Array.from({ length: endOffset - startOffset }, (_, a) => a + startOffset);
        const chunks = chunkIntoN(indices, options.groupsPerRow);
        const groups: ReactNode[] = [];

        for (const chunk of chunks) {
            let result = '';
            for (const i of chunk) {
                result += getASCIIForSingleByte(memory.bytes[i]);
            }

            groups.push(<span key={`ascii_${chunk[0]}-${chunk[chunk.length - 1]}`}>{result}</span>);
        }

        return (
            <div className='flex flex-column'>
                {groups}
            </div>
        );
    }
}
