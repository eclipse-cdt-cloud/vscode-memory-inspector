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
import type { MemorySizeOptions } from '../components/memory-table';
import { elementInnerWidth, characterWidthInContainer } from '../utils/window';

export class DataColumn implements ColumnContribution {
    static CLASS_NAME = 'column-data';

    readonly id = 'data';
    readonly className = DataColumn.CLASS_NAME;
    readonly label = 'Data';
    readonly priority = 1;

    protected byteGroupStyle: React.CSSProperties = {
        marginRight: `${DataColumn.Styles.MARGIN_RIGHT_PX}px`
    };

    render(range: BigIntMemoryRange, memory: Memory, options: TableRenderOptions): React.ReactNode {
        return this.renderGroups(range, memory, options);
    }

    protected renderGroups(range: BigIntMemoryRange, memory: Memory, options: TableRenderOptions): React.ReactNode {
        const groups = [];
        let words = [];
        for (let i = range.startAddress; i < range.endAddress; i++) {
            words.push(this.renderWord(memory, options, i));
            if (words.length % options.wordsPerGroup === 0) {
                const isLast = i + 1n >= range.endAddress;
                const style: React.CSSProperties | undefined = isLast ? undefined : this.byteGroupStyle;

                groups.push(<span className='byte-group' style={style} key={i.toString(16)}>{words}</span>);
                words = [];
            }
        }
        if (words.length) { groups.push(<span className='byte-group' key={(range.endAddress - BigInt(words.length)).toString(16)}>{words}</span>); }
        return groups;
    }

    protected renderWord(memory: Memory, options: TableRenderOptions, currentAddress: bigint): React.ReactNode {
        const initialOffset = toOffset(memory.address, currentAddress, options.bytesPerWord * 8);
        const finalOffset = initialOffset + options.bytesPerWord;
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
