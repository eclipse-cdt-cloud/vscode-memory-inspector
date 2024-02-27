/********************************************************************************
 * Copyright (C) 2022 Ericsson, Arm and others.
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

import React from 'react';
import { Endianness } from '../utils/view-types';
import { MemoryAppContext } from './memory-app-provider';
import { MemoryTable } from './memory-table';
import { OptionsWidget } from './options-widget';

interface MemoryWidgetState {
    endianness: Endianness;
}

const defaultOptions: MemoryWidgetState = {
    endianness: Endianness.Little,
};

export class MemoryWidget extends React.Component<{}, MemoryWidgetState> {
    static contextType = MemoryAppContext;
    declare context: MemoryAppContext;

    constructor(props: {}) {
        super(props);
        this.state = { ...defaultOptions };
    }

    override render(): React.ReactNode {
        return (<div className='flex flex-column h-full'>
            <OptionsWidget endianness={this.state.endianness} />
            <MemoryTable
                endianness={this.state.endianness}
                columnOptions={this.context.columns.filter(candidate => candidate.active)}
            />
        </div>);
    }

}
