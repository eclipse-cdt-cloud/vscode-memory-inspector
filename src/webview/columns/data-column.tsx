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
import { BigIntMemoryRange, toOffset } from '../../common/memory-range';
import { FullNodeAttributes, Memory } from '../utils/view-types';
import { ColumnContribution, TableRenderOptions } from './column-contribution-service';
import { decorationService } from '../decorations/decoration-service';

export class DataColumn implements ColumnContribution {
    readonly id = 'data';
    readonly label = 'Data';
    readonly priority = 1;

    render(range: BigIntMemoryRange, memory: Memory, options: TableRenderOptions): React.ReactNode {
        return this.renderGroups(range, memory, options);
    }

    protected renderGroups(range: BigIntMemoryRange, memory: Memory, options: TableRenderOptions): React.ReactNode {
        const groups = [];
        let words = [];
        for (let i = range.startAddress; i < range.endAddress; i++) {
            words.push(this.renderWord(memory, options, i));
            if (words.length % options.wordsPerGroup === 0) {
                groups.push(<span className='byte-group' key={i.toString(16)}>{words}</span>);
                words = [];
            }
        }
        if (words.length) { groups.push(<span className='byte-group' key={(range.endAddress - BigInt(words.length)).toString(16)}>{words}</span>); }
        return (
            <div className="flex flex-column">
                {groups}
            </div>
        );
    }

    protected renderWord(memory: Memory, options: TableRenderOptions, currentAddress: bigint): React.ReactNode {
        const itemsPerByte = options.wordSize / 8;
        const initialOffset = toOffset(memory.address, currentAddress, options.wordSize);
        const finalOffset = initialOffset + itemsPerByte;
        const bytes = [];
        for (let i = initialOffset; i < finalOffset; i++) {
            bytes.push(this.renderEightBits(memory, currentAddress, i));
        }
        return <span className='single-word' key={currentAddress.toString(16)}>{bytes}</span>;
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
}
