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

interface OptionsWidgetState extends DebugProtocol.ReadMemoryArguments, TableRenderOptions { }

interface OptionsWidgetProps {
    updateRenderOptions: (options: TableRenderOptions) => void;
    updateMemoryArguments: (memoryArguments: DebugProtocol.ReadMemoryArguments) => void;
}

const defaultOptions: OptionsWidgetState = {
    memoryReference: '',
    offset: 0,
    count: 256,
    columnOptions: [
        { label: 'Variables', doRender: true },
        { label: 'ASCII', doRender: false },
    ],
    endianness: Endianness.Little,
    byteSize: 8,
    bytesPerGroup: 1,
    groupsPerRow: 4,
};

export class OptionsWidget extends React.Component<OptionsWidgetProps, OptionsWidgetState> {
    constructor(props: OptionsWidgetProps) {
        super(props);
        this.state = { ...defaultOptions };
    }

    override render(): React.ReactNode {
        return <div>
            <div className="title-bar">
                <div className="title"></div>
                <div className="settings-toggle"></div>
            </div>
            <div className="core-options">
                <VSCodeTextField>Address</VSCodeTextField>
                <VSCodeTextField>Offset</VSCodeTextField>
                <VSCodeTextField>Length</VSCodeTextField>
                <VSCodeButton>Go</VSCodeButton>
            </div>
            <div className="advanced-options">
                <label htmlFor="bytes-per-group">Bytes per Group</label>
                <VSCodeDropdown id="bytes-per-group">
                    <VSCodeOption>1</VSCodeOption>
                    <VSCodeOption>2</VSCodeOption>
                    <VSCodeOption>4</VSCodeOption>
                    <VSCodeOption>8</VSCodeOption>
                    <VSCodeOption>16</VSCodeOption>
                </VSCodeDropdown>
                <label htmlFor="groups-per-row">Groups per Row</label>
                <VSCodeDropdown id="groups-per-row">
                    <VSCodeOption>1</VSCodeOption>
                    <VSCodeOption>2</VSCodeOption>
                    <VSCodeOption>4</VSCodeOption>
                    <VSCodeOption>8</VSCodeOption>
                    <VSCodeOption>16</VSCodeOption>
                    <VSCodeOption>32</VSCodeOption>
                </VSCodeDropdown>
                <label>Columns</label>
                <div className="multi-select-checkbox">
                    <input type="checkbox" id="variables" />
                    <label htmlFor="variables">Variables</label>
                </div>
                <div className="multi-select-checkbox">
                    <input type="checkbox" id="ascii" />
                    <label htmlFor="ascii">ASCII</label>
                </div>
            </div>
        </div>;
    }
}
