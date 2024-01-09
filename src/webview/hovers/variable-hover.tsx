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

import * as React from 'react';
import { VariableRange } from '../../common/memory-range';
import { HoverContribution, MemoryDetails } from './hover-service';

export class VariableHover implements HoverContribution {
    readonly id = 'variable-hover';
    priority = 0;

    async render(
        { columnId, bytesPerWord, extraData }: MemoryDetails,
    ): Promise<React.ReactNode> {
        if (columnId !== 'variables') { return; }

        const { type, startAddress, endAddress, name } = extraData as VariableRange;
        const start = '0x' + parseInt(startAddress).toString(16);
        const end = '0x' + parseInt(endAddress || '0').toString(16);
        const words = (startAddress && endAddress) ? parseInt(endAddress) - parseInt(startAddress) : undefined;
        const bytes = words ? words * bytesPerWord : undefined;

        const hoverItem = (
            <table className='variable-hover'>
                <caption className='variable-hover-name'>{name}</caption>
                {Object.entries({ type, start, end, words, bytes }).map(([label, value]) =>
                    value
                        ? <tr className='label-value-pair'>
                            <td className={`label ${label}`}>{label}</td>
                            <td className={`value ${label}`}>{value}</td>
                        </tr>
                        : ''
                )}
            </table>
        );

        return hoverItem;
    }
}
