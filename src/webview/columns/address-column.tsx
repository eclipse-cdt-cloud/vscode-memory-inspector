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
import { ColumnContribution } from './column-contribution-service';
import { Memory, MemoryDisplayConfiguration } from '../utils/view-types';

export class AddressColumn implements ColumnContribution {
    static ID = 'address';

    readonly id = AddressColumn.ID;
    readonly label = 'Address';
    readonly priority = 0;

    render(range: BigIntMemoryRange, _: Memory, options: MemoryDisplayConfiguration): ReactNode {
        return <span className='memory-start-address'>
            {options.showRadixPrefix && <span className='radix-prefix'>{getRadixMarker(options.addressRadix)}</span>}
            <span className='address'>{getAddressString(range.startAddress, options.addressRadix)}</span>
        </span>;
    }
}
