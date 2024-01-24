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
import { Decoration, Endianness, Memory, MemoryDisplayConfiguration } from '../utils/view-types';
import { messenger } from '../view-messenger';
import { memoryDisplayConfigurationChangedType } from '../../common/messaging';
import { ColumnStatus } from '../columns/column-contribution-service';

interface MemoryWidgetProps {
    memory?: Memory;
    decorations: Decoration[];
    columns: ColumnStatus[];
    memoryReference: string;
    offset: number;
    count: number;
    isMemoryFetching: boolean;
    refreshMemory: () => void;
    updateMemoryArguments: (memoryArguments: Partial<DebugProtocol.ReadMemoryArguments>) => void;
    toggleColumn(id: string, active: boolean): void;
    fetchMemory(partialOptions?: Partial<DebugProtocol.ReadMemoryArguments>): Promise<void>
}

interface MemoryWidgetState extends MemoryDisplayConfiguration {
    endianness: Endianness;
    wordSize: number;
}

const defaultOptions: MemoryWidgetState = {
    endianness: Endianness.Little,
    wordSize: 8,
    wordsPerGroup: 1,
    groupsPerRow: 4,
    scrollingBehavior: 'Paginate',
    loadingBehavior: 'Manual'
};

export class MemoryWidget extends React.Component<MemoryWidgetProps, MemoryWidgetState> {
    constructor(props: MemoryWidgetProps) {
        super(props);
        this.state = { ...defaultOptions };
    }

    public componentDidMount(): void {
        messenger.onNotification(memoryDisplayConfigurationChangedType, configuration => this.setState(configuration));
    }

    override render(): React.ReactNode {
        return (<div className='flex flex-column h-full'>
            <OptionsWidget
                columnOptions={this.props.columns}
                memoryReference={this.props.memoryReference}
                offset={this.props.offset}
                count={this.props.count}
                endianness={this.state.endianness}
                wordSize={this.state.wordSize}
                wordsPerGroup={this.state.wordsPerGroup}
                groupsPerRow={this.state.groupsPerRow}
                updateMemoryArguments={this.props.updateMemoryArguments}
                updateRenderOptions={this.updateRenderOptions}
                refreshMemory={this.props.refreshMemory}
                toggleColumn={this.props.toggleColumn}
            />
            <MemoryTable
                decorations={this.props.decorations}
                columnOptions={this.props.columns.filter(candidate => candidate.active)}
                memory={this.props.memory}
                endianness={this.state.endianness}
                wordSize={this.state.wordSize}
                wordsPerGroup={this.state.wordsPerGroup}
                groupsPerRow={this.state.groupsPerRow}
                offset={this.props.offset}
                count={this.props.count}
                fetchMemory={this.props.fetchMemory}
                isMemoryFetching={this.props.isMemoryFetching}
                scrollingBehavior={this.state.scrollingBehavior}
                loadingBehavior={this.state.loadingBehavior}
            />
        </div>);
    }

    protected updateRenderOptions = (newState: Partial<MemoryWidgetState>) => this.setState(prevState => ({ ...prevState, ...newState }));
}
