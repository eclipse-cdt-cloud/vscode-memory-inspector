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
import { WebviewIdMessageParticipant } from 'vscode-messenger-common';
import { Memory } from '../../common/memory';
import { MemoryOptions, ReadMemoryArguments, SessionContext, WebviewSelection } from '../../common/messaging';
import { MemoryDisplayConfiguration } from '../../common/webview-configuration';
import { ColumnStatus } from '../columns/column-contribution-service';
import { HoverService } from '../hovers/hover-service';
import { Decoration, MemoryState } from '../utils/view-types';
import { createAppVscodeContext, VscodeContext } from '../utils/vscode-contexts';
import { MemoryTable } from './memory-table';
import { OptionsWidget } from './options-widget';

interface MemoryWidgetProps extends MemoryDisplayConfiguration {
    messageParticipant: WebviewIdMessageParticipant;
    sessionContext: SessionContext;
    configuredReadArguments: Required<ReadMemoryArguments>;
    activeReadArguments: Required<ReadMemoryArguments>;
    memory?: Memory;
    title: string;
    decorations: Decoration[];
    hoverService: HoverService;
    columns: ColumnStatus[];
    effectiveAddressLength: number;
    isMemoryFetching: boolean;
    isFrozen: boolean;
    updateMemoryState: (state: Partial<MemoryState>) => void;
    toggleColumn(id: string, active: boolean): void;
    toggleFrozen: () => void;
    updateMemoryDisplayConfiguration: (memoryArguments: Partial<MemoryDisplayConfiguration>) => void;
    resetMemoryDisplayConfiguration: () => void;
    updateTitle: (title: string) => void;
    fetchMemory(partialOptions?: MemoryOptions): Promise<void>;
    storeMemory(): void;
    applyMemory(): void;
}

interface MemoryWidgetState {
}

const defaultOptions: MemoryWidgetState = {
};

export class MemoryWidget extends React.Component<MemoryWidgetProps, MemoryWidgetState> {
    protected optionsWidget = React.createRef<OptionsWidget>();
    protected memoryTable = React.createRef<MemoryTable>();
    constructor(props: MemoryWidgetProps) {
        super(props);
        this.state = { ...defaultOptions };
    }

    protected createVscodeContext(): VscodeContext {
        const visibleColumns = this.props.columns.filter(candidate => candidate.active).map(column => column.contribution.id);
        const { messageParticipant, showRadixPrefix, endianness, bytesPerMau, activeReadArguments } = this.props;
        return createAppVscodeContext({
            messageParticipant,
            showRadixPrefix,
            showAsciiColumn: visibleColumns.includes('ascii'),
            showVariablesColumn: visibleColumns.includes('variables'),
            endianness,
            bytesPerMau,
            activeReadArguments
        });

    }

    override render(): React.ReactNode {
        return (<div className='flex flex-column h-full' {...this.createVscodeContext()}>
            <OptionsWidget
                ref={this.optionsWidget}
                sessionContext={this.props.sessionContext}
                title={this.props.title}
                updateTitle={this.props.updateTitle}
                columnOptions={this.props.columns}
                configuredReadArguments={this.props.configuredReadArguments}
                activeReadArguments={this.props.activeReadArguments}
                endianness={this.props.endianness}
                bytesPerMau={this.props.bytesPerMau}
                mausPerGroup={this.props.mausPerGroup}
                groupsPerRow={this.props.groupsPerRow}
                refreshOnStop={this.props.refreshOnStop}
                periodicRefresh={this.props.periodicRefresh}
                periodicRefreshInterval={this.props.periodicRefreshInterval}
                updateMemoryState={this.props.updateMemoryState}
                updateRenderOptions={this.props.updateMemoryDisplayConfiguration}
                resetRenderOptions={this.props.resetMemoryDisplayConfiguration}
                addressPadding={this.props.addressPadding}
                addressRadix={this.props.addressRadix}
                showRadixPrefix={this.props.showRadixPrefix}
                fetchMemory={this.props.fetchMemory}
                toggleColumn={this.props.toggleColumn}
                toggleFrozen={this.props.toggleFrozen}
                isFrozen={this.props.isFrozen}
                storeMemory={this.props.storeMemory}
                applyMemory={this.props.applyMemory}
            />
            <MemoryTable
                ref={this.memoryTable}
                configuredReadArguments={this.props.configuredReadArguments}
                activeReadArguments={this.props.activeReadArguments}
                decorations={this.props.decorations}
                hoverService={this.props.hoverService}
                columnOptions={this.props.columns.filter(candidate => candidate.active)}
                memory={this.props.memory}
                endianness={this.props.endianness}
                bytesPerMau={this.props.bytesPerMau}
                mausPerGroup={this.props.mausPerGroup}
                groupsPerRow={this.props.groupsPerRow}
                refreshOnStop={this.props.refreshOnStop}
                periodicRefresh={this.props.periodicRefresh}
                periodicRefreshInterval={this.props.periodicRefreshInterval}
                effectiveAddressLength={this.props.effectiveAddressLength}
                fetchMemory={this.props.fetchMemory}
                isMemoryFetching={this.props.isMemoryFetching}
                scrollingBehavior={this.props.scrollingBehavior}
                addressPadding={this.props.addressPadding}
                addressRadix={this.props.addressRadix}
                showRadixPrefix={this.props.showRadixPrefix}
                isFrozen={this.props.isFrozen}
            />
        </div>);
    }

    public showAdvancedOptions(): void {
        this.optionsWidget.current?.showAdvancedOptions();
    }

    public getWebviewSelection(): WebviewSelection {
        return this.memoryTable.current?.getWebviewSelection() ?? {};
    }

}
