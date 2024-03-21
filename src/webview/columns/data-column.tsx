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
import { Memory } from '../../common/memory';
import { BigIntMemoryRange, Endianness, toOffset } from '../../common/memory-range';
import type { MemorySizeOptions } from '../components/memory-table';
import { decorationService } from '../decorations/decoration-service';
import { FullNodeAttributes } from '../utils/view-types';
import { characterWidthInContainer, elementInnerWidth } from '../utils/window';
import { ColumnContribution, TableRenderOptions } from './column-contribution-service';

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
        let maus: React.ReactNode[] = [];
        for (let address = range.startAddress; address < range.endAddress; address++) {
            maus.push(this.renderMau(memory, options, address));
            if (maus.length % options.mausPerGroup === 0) {
                this.applyEndianness(maus, options);
                const isLast = address + 1n >= range.endAddress;
                const style: React.CSSProperties | undefined = isLast ? undefined : this.byteGroupStyle;
                groups.push(<span className='byte-group hoverable' data-column='data' style={style} key={address.toString(16)}>{maus}</span>);
                maus = [];
            }
        }
        if (maus.length) { groups.push(<span className='byte-group hoverable' data-column='data' key={(range.endAddress - BigInt(maus.length)).toString(16)}>{maus}</span>); }
        return groups;
    }

    protected renderMau(memory: Memory, options: TableRenderOptions, currentAddress: bigint): React.ReactNode {
        const initialOffset = toOffset(memory.address, currentAddress, options.bytesPerMau * 8);
        const finalOffset = initialOffset + options.bytesPerMau;
        const bytes: React.ReactNode[] = [];
        for (let i = initialOffset; i < finalOffset; i++) {
            bytes.push(this.renderEightBits(memory, currentAddress, i));
        }
        this.applyEndianness(bytes, options);
        return <span className='single-mau' key={currentAddress.toString(16)}>{bytes}</span>;
    }

    protected applyEndianness<T>(group: T[], options: TableRenderOptions): T[] {
        // Assume data from the DAP comes in Big Endian so we need to revert the order if we use Little Endian
        return options.endianness === Endianness.Big ? group : group.reverse();
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
            * options.bytesPerMau
            * options.mausPerGroup
            + Styles.MARGIN_RIGHT_PX;
        // Accommodate the non-existent margin of the final element.
        const maxGroups = Math.max((columnWidth + Styles.MARGIN_RIGHT_PX) / groupWidth, 1);

        return Math.floor(maxGroups);
    }
}
