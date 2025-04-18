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
import * as manifest from '../../common/manifest';
import { Memory } from '../../common/memory';
import { Session, WebviewSelection } from '../../common/messaging';
import { MemoryOptions, ReadMemoryArguments, SessionContext } from '../../common/messaging';
import { MemoryDataDisplaySettings } from '../../common/webview-configuration';
import { ColumnStatus } from '../columns/column-contribution-service';
import { HoverService } from '../hovers/hover-service';
import { Decoration, MemoryState } from '../utils/view-types';
import { createAppVscodeContext, VscodeContext } from '../vscode-context/vscode-contexts';
import { MemoryTable } from './memory-table';
import { OptionsWidget } from './options-widget';

interface MemoryWidgetProps extends MemoryDataDisplaySettings {
    messageParticipant: WebviewIdMessageParticipant;
    sessions: Session[];
    updateSession: (sessionId: string) => void;
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
    hasDebuggerDefaults?: boolean;
    settingsContributionMessage?: string;
    updateMemoryState: (state: Partial<MemoryState>) => void;
    toggleColumn(id: string, active: boolean): void;
    isFrozen: boolean;
    toggleFrozen: () => void;
    updateMemoryDisplaySettings: (memoryArguments: Partial<MemoryDataDisplaySettings>) => void;
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
        const { messageParticipant, showRadixPrefix, endianness, bytesPerMau, activeReadArguments, hasDebuggerDefaults } = this.props;
        return createAppVscodeContext({
            messageParticipant,
            showRadixPrefix,
            showAsciiColumn: visibleColumns.includes(manifest.CONFIG_SHOW_ASCII_COLUMN),
            showVariablesColumn: visibleColumns.includes(manifest.CONFIG_SHOW_VARIABLES_COLUMN),
            activeReadArguments,
            hasDebuggerDefaults,
            endianness,
            bytesPerMau,
        });

    }

    override render(): React.ReactNode {
        return (<div className='flex flex-column h-full' {...this.createVscodeContext()}>
            <OptionsWidget
                ref={this.optionsWidget}
                sessions={this.props.sessions}
                updateSession={this.props.updateSession}
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
                updateRenderOptions={this.props.updateMemoryDisplaySettings}
                addressPadding={this.props.addressPadding}
                addressRadix={this.props.addressRadix}
                showRadixPrefix={this.props.showRadixPrefix}
                settingsContributionMessage={this.props.settingsContributionMessage}
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
