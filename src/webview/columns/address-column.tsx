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
import { BigIntMemoryRange, getAddressString, getRadixMarker } from '../../common/memory-range';
import { ColumnContribution, ColumnFittingType, TableRenderOptions } from './column-contribution-service';
import { Memory } from '../../common/memory';

export class AddressColumn implements ColumnContribution {
    static ID = 'address';

    readonly id = AddressColumn.ID;
    readonly label = 'Address';
    readonly priority = 0;

    fittingType: ColumnFittingType = 'content-width';

    render(range: BigIntMemoryRange, _: Memory, options: TableRenderOptions): ReactNode {
        return <span className='memory-start-address hoverable' data-column='address'>
            {options.showRadixPrefix && <span className='radix-prefix'>{getRadixMarker(options.addressRadix)}</span>}
            <span className='address'>{getAddressString(range.startAddress, options.addressRadix, options.effectiveAddressLength)}</span>
        </span>;
    }
}
