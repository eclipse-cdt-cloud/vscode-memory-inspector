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
import { BigIntMemoryRange } from '../../common/memory-range';
import { FullNodeAttributes, Memory } from '../utils/view-types';
import { ColumnContribution } from './column-contribution-service';
import { decorationService } from '../decorations/decoration-service';

export class DataColumn implements ColumnContribution {
    readonly id = 'data';
    readonly label = 'Data';

    render(range: BigIntMemoryRange, memory: Memory): React.ReactNode {
        return this.renderGroups(range, memory);
    }

    protected renderGroups(range: BigIntMemoryRange, memory: Memory): React.ReactNode {
        const groups = [];
        const words = [];
        for (let i = range.startAddress; i < range.endAddress; i++) {
            words.push(this.renderWord(memory, i));
            /* TODO: SHOULD BE WORDS PER GROUP */
            if (words.length % 4 === 0) {
                groups.push(<span className='byte-group' key={i.toString(16)}>{words}</span>);
                words.length = 0;
            }
        }
        if (words.length) { groups.push(<span className='byte-group' key={(range.endAddress - BigInt(words.length)).toString(16)}>{words}</span>); }
        return groups;
    }

    private renderWord(memory: Memory, currentAddress: bigint): React.ReactNode {
        const itemsPerByte = memory.wordSize / 8;
        const initialOffset = Number(currentAddress - memory.address) * itemsPerByte;
        const finalOffset = initialOffset + itemsPerByte;
        const bytes = [];
        for (let i = initialOffset; i < finalOffset; i++) {
            bytes.push(this.renderEightBits(memory, currentAddress, i));
        }
        return <span className='single-word' key={currentAddress.toString(16)}>{bytes}</span>;
    }

    private renderEightBits(memory: Memory, currentAddress: bigint, offset: number): React.ReactNode {
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

    private getBitAttributes(memory: Memory, currentAdress: bigint, offset: number): FullNodeAttributes {
        return {
            className: 'eight-bits',
            style: decorationService.getDecoration(currentAdress)?.style,
            content: (memory.bytes[offset] ?? 0).toString(16).padStart(2, '0')
        };
    }
}
