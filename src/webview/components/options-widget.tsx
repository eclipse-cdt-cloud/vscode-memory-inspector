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
import { MultiSelectWithLabel } from './multi-select-bar';
import { messenger } from '../view-messenger';
import { setMemoryDisplayConfigurationType } from '../../common/messaging';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import { TableRenderOptions } from '../columns/column-contribution-service';

export interface OptionsWidgetProps extends Omit<TableRenderOptions, 'scrollingBehavior'>, Required<DebugProtocol.ReadMemoryArguments> {
    updateRenderOptions: (options: Partial<SerializedTableRenderOptions>) => void;
    updateMemoryArguments: (memoryArguments: Partial<DebugProtocol.ReadMemoryArguments>) => void;
    refreshMemory: () => void;
    toggleColumn(id: string, active: boolean): void;
}

interface OptionsWidgetState {
    showRenderOptions: boolean;
}

const enum InputId {
    Address = 'address',
    Offset = 'offset',
    Length = 'length',
    WordsPerGroup = 'words-per-group',
    GroupsPerRow = 'groups-per-row',
}

export class OptionsWidget extends React.Component<OptionsWidgetProps, OptionsWidgetState> {
    constructor(props: OptionsWidgetProps) {
        super(props);
        this.state = { showRenderOptions: false };
    }

    override render(): React.ReactNode {
        return <div className='memory-options-widget' >
            <div className="options-widget-title">
                <div className="title"></div>
                <div className="advanced-options-toggle" role='button' tabIndex={0} onClick={this.toggleRenderOptions} >
                    <i className="codicon codicon-gear" />
                    {this.state.showRenderOptions ? 'Hide Settings' : 'Show Settings'}
                </div>
            </div>
            <div className="core-options" >
                <VSCodeTextField id={InputId.Address} onChange={this.handleInputChange} value={this.props.memoryReference}>Address</VSCodeTextField>
                <VSCodeTextField id={InputId.Offset} onChange={this.handleInputChange} value={this.props.offset.toString()}>Offset</VSCodeTextField>
                <VSCodeTextField id={InputId.Length} onChange={this.handleInputChange} value={this.props.count.toString()}>Length</VSCodeTextField>
                <VSCodeButton className='go-button' onClick={this.props.refreshMemory} >Go</VSCodeButton>
            </div>
            {
                this.state.showRenderOptions && <>
                    <VSCodeDivider />
                    <div className="advanced-options">
                        <label htmlFor={InputId.WordsPerGroup}>Bytes per Group</label>
                        <VSCodeDropdown id={InputId.WordsPerGroup} onChange={this.handleInputChange} value={this.props.wordsPerGroup.toString()}>
                            <VSCodeOption>1</VSCodeOption>
                            <VSCodeOption>2</VSCodeOption>
                            <VSCodeOption>4</VSCodeOption>
                            <VSCodeOption>8</VSCodeOption>
                            <VSCodeOption>16</VSCodeOption>
                        </VSCodeDropdown>
                        <label htmlFor={InputId.GroupsPerRow}>Groups per Row</label>
                        <VSCodeDropdown id={InputId.GroupsPerRow} onChange={this.handleInputChange} value={this.props.groupsPerRow.toString()}>
                            <VSCodeOption>1</VSCodeOption>
                            <VSCodeOption>2</VSCodeOption>
                            <VSCodeOption>4</VSCodeOption>
                            <VSCodeOption>8</VSCodeOption>
                            <VSCodeOption>16</VSCodeOption>
                            <VSCodeOption>32</VSCodeOption>
                        </VSCodeDropdown>
                        {!!this.props.columnOptions.length && <MultiSelectWithLabel
                            id='column-select'
                            label='Columns'
                            items={this.props.columnOptions
                                .filter(({ configurable }) => configurable)
                                .map(column => ({ id: column.contribution.id, label: column.contribution.label, checked: column.active }))}
                            onSelectionChanged={this.props.toggleColumn}
                        />}
                    </div>
                </>
            }
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
            case InputId.WordsPerGroup: return this.updateConfiguration({ id: 'wordsPerGroup', value: Number(event.currentTarget.value) });
            case InputId.GroupsPerRow: return this.updateConfiguration({ id: 'groupsPerRow', value: Number(event.currentTarget.value) });
        }
    }

    protected updateConfiguration(viewConfigurationChangeRequest: MemoryDisplayConfigurationChangeRequest): void {
        return messenger.sendNotification(setMemoryDisplayConfigurationType, HOST_EXTENSION, viewConfigurationChangeRequest);
    }

    protected toggleRenderOptions = () => this.doToggleRenderOptions();

    protected doToggleRenderOptions(): void {
        this.setState(prevState => ({ ...prevState, showRenderOptions: !prevState.showRenderOptions }));
    }
}
