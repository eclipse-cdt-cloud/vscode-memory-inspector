/********************************************************************************
 * Copyright (C) 2023 Ericsson, Arm and others.
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
import type { DebugProtocol } from '@vscode/debugprotocol';
import { MemoryDisplayConfigurationChangeRequest, SerializedTableRenderOptions } from '../utils/view-types';
import { VSCodeButton, VSCodeDivider, VSCodeDropdown, VSCodeOption, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { messenger } from '../view-messenger';
import { setMemoryDisplayConfigurationType } from '../../common/messaging';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import { TableRenderOptions } from '../columns/column-contribution-service';
import { MultiSelectWithLabel } from './multi-select';

export interface OptionsWidgetProps extends Omit<TableRenderOptions, 'scrollingBehavior'>, Required<DebugProtocol.ReadMemoryArguments> {
    updateRenderOptions: (options: Partial<SerializedTableRenderOptions>) => void;
    updateMemoryArguments: (memoryArguments: Partial<DebugProtocol.ReadMemoryArguments>) => void;
    refreshMemory: () => void;
    toggleColumn(id: string, active: boolean): void;
}

const enum InputId {
    Address = 'address',
    Offset = 'offset',
    Length = 'length',
    WordsPerGroup = 'words-per-group',
    GroupsPerRow = 'groups-per-row',
}

export class OptionsWidget extends React.Component<OptionsWidgetProps, {}> {
    constructor(props: OptionsWidgetProps) {
        super(props);
    }

    override render(): React.ReactNode {

        return <div className='memory-options-widget' >
            <div className="options-widget-title">
                <div className="title"></div>
            </div>
            <div className="core-options" >
                <VSCodeTextField
                    id={InputId.Address}
                    className='options-texfield-long'
                    onChange={this.handleInputChange}
                    value={this.props.memoryReference}>
                    Address
                </VSCodeTextField>
                <VSCodeTextField id={InputId.Offset} className='options-textfield' onChange={this.handleInputChange} value={this.props.offset.toString()}>Offset</VSCodeTextField>
                <VSCodeTextField id={InputId.Length} className='options-textfield' onChange={this.handleInputChange} value={this.props.count.toString()}>Length</VSCodeTextField>
                <VSCodeButton className='go-button' onClick={this.props.refreshMemory} >Go</VSCodeButton>
                <VSCodeButton className='advanced-options-toggle' appearance='icon' title='Show all data' aria-label='Show all data'>
                    <div className='codicon codicon-gear'></div>
                    <div className="advanced-options-content">
                        {!!this.props.columnOptions.length && <MultiSelectWithLabel
                            id='column-select'
                            label='Columns'
                            items={this.props.columnOptions
                                .filter(({ configurable }) => configurable)
                                .map(column => ({ id: column.contribution.id, label: column.contribution.label, checked: column.active }))}
                            onSelectionChanged={this.props.toggleColumn}
                        />}
                        <label htmlFor={InputId.WordsPerGroup} className='options-label'>Bytes per Group</label>
                        <VSCodeDropdown id={InputId.WordsPerGroup} className='options-dropdown' onChange={this.handleInputChange} value={this.props.wordsPerGroup.toString()}>
                            <VSCodeOption>1</VSCodeOption>
                            <VSCodeOption>2</VSCodeOption>
                            <VSCodeOption>4</VSCodeOption>
                            <VSCodeOption>8</VSCodeOption>
                            <VSCodeOption>16</VSCodeOption>
                        </VSCodeDropdown>
                        <label htmlFor={InputId.GroupsPerRow} className='options-label'>Groups per Row</label>
                        <VSCodeDropdown id={InputId.GroupsPerRow} className='options-dropdown' onChange={this.handleInputChange} value={this.props.groupsPerRow.toString()}>
                            <VSCodeOption>1</VSCodeOption>
                            <VSCodeOption>2</VSCodeOption>
                            <VSCodeOption>4</VSCodeOption>
                            <VSCodeOption>8</VSCodeOption>
                            <VSCodeOption>16</VSCodeOption>
                            <VSCodeOption>32</VSCodeOption>
                        </VSCodeDropdown>
                    </div>
                </VSCodeButton>
            </div>
            <VSCodeDivider />
        </div>;
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */ // The types from the VSCode components are hard to reconcile with plain React types.
    protected handleInputChange: React.FormEventHandler<HTMLInputElement> & ((event: Event) => unknown) = e => this.doHandleChangeEvent(e as any);

    protected doHandleChangeEvent(event: React.FormEvent<HTMLInputElement>): unknown {
        const id = event.currentTarget.id as InputId;
        switch (id) {
            case InputId.Address: return this.props.updateMemoryArguments({ memoryReference: event.currentTarget.value });
            case InputId.Offset: return !Number.isNaN(event.currentTarget.value) && this.props.updateMemoryArguments({ offset: Number(event.currentTarget.value) });
            case InputId.Length: return !Number.isNaN(event.currentTarget.value) && this.props.updateMemoryArguments({ count: Number(event.currentTarget.value) });
            case InputId.WordsPerGroup: return this.updateConfiguration({ id: 'groupings.wordsPerGroup', value: Number(event.currentTarget.value) });
            case InputId.GroupsPerRow: return this.updateConfiguration({ id: 'groupings.groupsPerRow', value: Number(event.currentTarget.value) });
        }
    }

    protected updateConfiguration(viewConfigurationChangeRequest: MemoryDisplayConfigurationChangeRequest): void {
        return messenger.sendNotification(setMemoryDisplayConfigurationType, HOST_EXTENSION, viewConfigurationChangeRequest);
    }
}
