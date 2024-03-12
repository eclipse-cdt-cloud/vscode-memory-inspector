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
import { Radix } from '../../common/memory-range';
import { HoverContribution, MemoryDetails } from './hover-service';

export class AddressHover implements HoverContribution {
    readonly id = 'address-hover';
    priority = 0;
    async render({ columnId, textContent, addressRadix }: MemoryDetails): Promise<React.ReactNode> {
        if (columnId !== 'address') { return; }

        let binary = '';
        let octal = '';
        let decimal = '';
        let hexadecimal = '';
        let num = 0;
        let primaryRadix = '';

        switch (addressRadix) {
            case Radix.Binary:
                primaryRadix = 'binary';
                binary = textContent;
                num = parseInt(binary, 2);
                octal = num.toString(8);
                decimal = num.toString(10);
                hexadecimal = num.toString(16);
                break;
            case Radix.Octal:
                primaryRadix = 'octal';
                octal = textContent;
                num = parseInt(octal, 8);
                binary = num.toString(2);
                decimal = num.toString(10);
                hexadecimal = num.toString(16);
                break;
            case Radix.Decimal:
                primaryRadix = 'decimal';
                decimal = textContent;
                num = parseInt(decimal, 10);
                binary = num.toString(2);
                octal = num.toString(8);
                hexadecimal = num.toString(16);
                break;
            case Radix.Hexadecimal:
                primaryRadix = 'hexadecimal';
                hexadecimal = textContent;
                num = parseInt(hexadecimal, 16);
                binary = num.toString(2);
                octal = num.toString(8);
                decimal = num.toString(10);
                break;
            default: return;
        }

        const hexCodePoint = (parseInt(hexadecimal.slice(-6), 16) > 0x10FFFF)
            ? parseInt(hexadecimal.slice(-5), 16)
            : parseInt(hexadecimal.slice(-6), 16);
        const utf8 = String.fromCodePoint(hexCodePoint);

        const hoverItem = (
            <table className='address-hover'>
                {Object.entries({ binary, octal, decimal, hexadecimal, utf8 }).map(([label, value]) =>
                    value
                        ? <tr className={`label-value-pair ${label === primaryRadix ? 'primary' : ''}`}>
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
