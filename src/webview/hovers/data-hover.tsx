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
import { HoverContribution, MemoryDetails } from './hover-service';

export class DataHover implements HoverContribution {
    readonly id = 'data-hover';
    priority = 0;
    async render({ columnId, textContent }: MemoryDetails): Promise<React.ReactNode> {
        if (columnId !== 'data') { return; }

        const hexadecimal = textContent;
        const num = parseInt(hexadecimal, 16);
        const binary = num.toString(2);
        const octal = num.toString(8);
        const decimal = num.toString(10);

        const hexCodePoint = (parseInt(hexadecimal.slice(-6), 16) > 0x10FFFF)
            ? parseInt(hexadecimal.slice(-5), 16)
            : parseInt(hexadecimal.slice(-6), 16);
        const utf8 = String.fromCodePoint(hexCodePoint);

        const hoverItem = (
            <table className='data-hover'>
                {Object.entries({ binary, octal, decimal, hexadecimal, utf8 }).map(([label, value]) =>
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
