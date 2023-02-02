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

import { DebugProtocol } from '@vscode/debugprotocol';
import React from 'react';
import { MemoryTable } from './memory-table';
import { OptionsWidget } from './options-widget';
import { Endianness, Memory } from './view-types';

interface MemoryWidgetProps {
    memory?: Memory;
    memoryReference: string;
    offset: number;
    count: number;
    refreshMemory: () => void;
    updateMemoryArguments: (memoryArguments: Partial<DebugProtocol.ReadMemoryArguments>) => void;
}

interface MemoryWidgetState {
    endianness: Endianness;
    byteSize: number;
    bytesPerGroup: number;
    groupsPerRow: number;
}

const defaultOptions: MemoryWidgetState = {
    // columnOptions: [
    //     { label: 'Variables', doRender: true },
    //     { label: 'ASCII', doRender: false },
    // ],
    endianness: Endianness.Little,
    byteSize: 8,
    bytesPerGroup: 1,
    groupsPerRow: 4,
};

export class MemoryWidget extends React.Component<MemoryWidgetProps, MemoryWidgetState> {
    constructor(props: MemoryWidgetProps) {
        super(props);
        this.state = { ...defaultOptions };
    }

    override render(): React.ReactNode {
        return <>
            <OptionsWidget
                memoryReference={this.props.memoryReference}
                offset={this.props.offset}
                count={this.props.count}
                endianness={this.state.endianness}
                byteSize={this.state.byteSize}
                bytesPerGroup={this.state.bytesPerGroup}
                groupsPerRow={this.state.groupsPerRow}
                updateMemoryArguments={this.props.updateMemoryArguments}
                updateRenderOptions={this.justSetState}
                refreshMemory={this.props.refreshMemory}
            />
            <MemoryTable
                memory={this.props.memory}
                endianness={this.state.endianness}
                byteSize={this.state.byteSize}
                bytesPerGroup={this.state.bytesPerGroup}
                groupsPerRow={this.state.groupsPerRow}
            />
        </>;
    }

    protected justSetState = (newState: Partial<MemoryWidgetState>) => this.setState(prevState => ({ ...prevState, ...newState }));
}
