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

import { classNames } from 'primereact/utils';
import React, { ReactNode } from 'react';
import { getAddressString, getRadixMarker } from '../../common/memory-range';
import { BreakpointMetadata, BreakpointService, breakpointService } from '../breakpoints/breakpoint-service';
import { MemoryRowData } from '../components/memory-table';
import { ColumnContribution, ColumnFittingType, ColumnRenderProps } from './column-contribution-service';
import { createDefaultSelection, groupAttributes, SelectionProps } from './table-group';

export class AddressColumn implements ColumnContribution {
    static ID = 'address';
    static CLASS_NAME = 'column-address';

    readonly id = AddressColumn.ID;
    readonly className = AddressColumn.CLASS_NAME;
    readonly label = 'Address';
    readonly priority = 0;

    fittingType: ColumnFittingType = 'content-width';

    render(columnIndex: number, row: MemoryRowData, config: ColumnRenderProps): ReactNode {
        const selectionProps: SelectionProps = {
            createSelection: (event, position) => createDefaultSelection(event, position, AddressColumn.ID, row),
            getSelection: () => config.selection,
            setSelection: config.setSelection
        };

        const breakpointMetadata = breakpointService.inRange(row)
            .map(bp => breakpointService.metadata(bp))
            .filter((bp): bp is BreakpointMetadata => bp !== undefined);
        const statusClasses = BreakpointService.statusClasses(breakpointMetadata);

        const groupProps = groupAttributes({ columnIndex, rowIndex: row.rowIndex, groupIndex: 0, maxGroupIndex: 0 }, selectionProps);
        return <span className='memory-start-address hoverable' data-column='address' {...groupProps}>
            {statusClasses.length > 0 && <span className={classNames('address-status', statusClasses)}></span>}
            {config.tableConfig.showRadixPrefix && <span className='radix-prefix'>{getRadixMarker(config.tableConfig.addressRadix)}</span>}
            <span className='address'>{getAddressString(row.startAddress, config.tableConfig.addressRadix, config.tableConfig.effectiveAddressLength)}</span>
        </span>;
    }
}
