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
import { Endianness, TableRenderOptions } from './view-types';
import { VSCodeButton, VSCodeDivider, VSCodeDropdown, VSCodeOption, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

interface OptionsWidgetProps {
    updateRenderOptions: (options: Partial<TableRenderOptions>) => void;
    updateMemoryArguments: (memoryArguments: Partial<DebugProtocol.ReadMemoryArguments>) => void;
    refreshMemory: () => void;
    memoryReference: string;
    offset: number;
    count: number;
    endianness: Endianness;
    byteSize: number;
    bytesPerGroup: number;
    groupsPerRow: number;
}

interface OptionsWidgetState {
    showRenderOptions: boolean;
}

const enum InputId {
    Address = 'address',
    Offset = 'offset',
    Length = 'length',
    BytesPerGroup = 'bytes-per-group',
    GroupsPerRow = 'groups-per-row',
}

const TitleBarStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'row nowrap',
    justifyContent: 'space-between',
};

const RenderOptionsToggleStyle: React.CSSProperties = {
    cursor: 'pointer',
    display: 'flex',
    flexFlow: 'row nowrap',
    alignItems: 'center',
};

const CoreOptionsStyle: React.CSSProperties = {
    display: 'grid',
    columnGap: '6px',
    gridTemplateColumns: '4fr 4fr 2fr 1fr',
    margin: '6px 0'
};

const GoButtonStyle: React.CSSProperties = {
    height: 'calc(var(--input-height) * 1px)', // Match height of inputs;
    alignSelf: 'end',
};

const AdvancedOptionsStyle: React.CSSProperties = {
    display: 'grid',
    columnGap: '6px',
    rowGap: '3px',
    gridTemplateColumns: 'max-content 1fr',
    alignItems: 'center',
    margin: '6px 0',
};

export class OptionsWidget extends React.Component<OptionsWidgetProps, OptionsWidgetState> {
    constructor(props: OptionsWidgetProps) {
        super(props);
        this.state = { showRenderOptions: false };
    }

    override render(): React.ReactNode {
        return <div className='memory-options-widget' style={{ marginBottom: '8px' }}>
            <div className="options-widget-title" style={TitleBarStyle}>
                <div className="title"></div>
                <div className="advanced-options-toggle" role='button' tabIndex={0} onClick={this.toggleRenderOptions} style={RenderOptionsToggleStyle}>
                    <i className="codicon codicon-gear" style={{ paddingRight: '3px' }} />
                    {this.state.showRenderOptions ? 'Hide Settings' : 'Show Settings'}
                </div>
            </div>
            <div className="core-options" style={CoreOptionsStyle}>
                <VSCodeTextField id={InputId.Address} onChange={this.handleInputChange} value={this.props.memoryReference}>Address</VSCodeTextField>
                <VSCodeTextField id={InputId.Offset} onChange={this.handleInputChange} value={this.props.offset.toString()}>Offset</VSCodeTextField>
                <VSCodeTextField id={InputId.Length} onChange={this.handleInputChange} value={this.props.count.toString()}>Length</VSCodeTextField>
                <VSCodeButton onClick={this.props.refreshMemory} style={GoButtonStyle}>Go</VSCodeButton>
            </div>
            {
                this.state.showRenderOptions && <>
                    <VSCodeDivider />
                    <div className="advanced-options" style={AdvancedOptionsStyle}>
                        <label htmlFor={InputId.BytesPerGroup}>Bytes per Group</label>
                        <VSCodeDropdown id={InputId.BytesPerGroup} onChange={this.handleInputChange} value={this.props.bytesPerGroup.toString()}>
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
            case InputId.BytesPerGroup: return this.props.updateRenderOptions({ bytesPerGroup: Number(event.currentTarget.value) });
            case InputId.GroupsPerRow: return this.props.updateRenderOptions({ groupsPerRow: Number(event.currentTarget.value) });
        }
    }

    protected toggleRenderOptions = () => this.doToggleRenderOptions();

    protected doToggleRenderOptions(): void {
        this.setState(prevState => ({ ...prevState, showRenderOptions: !prevState.showRenderOptions }));
    }
}
