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
import { VSCodeButton, VSCodeDropdown, VSCodeOption, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

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

const enum InputId {
    Address = 'address',
    Offset = 'offset',
    Length = 'length',
    BytesPerGroup = 'bytes-per-group',
    GroupsPerRow = 'groups-per-row',
}

export class OptionsWidget extends React.Component<OptionsWidgetProps, {}> {
    override render(): React.ReactNode {
        return <div className='memory-options-widget'>
            <div className="core-options">
                <VSCodeTextField id={InputId.Address} onChange={this.handleInputChange} value={this.props.memoryReference}>Address</VSCodeTextField>
                <VSCodeTextField id={InputId.Offset} onChange={this.handleInputChange} value={this.props.offset.toString()}>Offset</VSCodeTextField>
                <VSCodeTextField id={InputId.Length} onChange={this.handleInputChange} value={this.props.count.toString()}>Length</VSCodeTextField>
                <VSCodeButton onClick={this.props.refreshMemory}>Go</VSCodeButton>
            </div>
            <div className="advanced-options">
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
        </div>;
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    handleInputChange: React.FormEventHandler<HTMLInputElement> & ((event: Event) => unknown) = e => this.doHandleChangeEvent(e as any);

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
}
