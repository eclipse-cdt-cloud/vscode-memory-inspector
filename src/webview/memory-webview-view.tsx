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
import { createRoot } from 'react-dom/client';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import {
    readyType,
    logMessageType,
    setOptionsType,
    readMemoryType,
    columnVisibilityType,
} from '../common/messaging';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { ColumnVisibilityStatus, Decoration, Memory, MemoryState } from './utils/view-types';
import { MemoryWidget } from './components/memory-widget';
import { messenger } from './view-messenger';
import { ColumnStatus, columnContributionService } from './columns/column-contribution-service';
import { decorationService } from './decorations/decoration-service';
import { variableDecorator } from './variables/variable-decorations';
import { AsciiColumn } from './columns/ascii-column';
import { AddressColumn } from './columns/address-column';
import { DataColumn } from './columns/data-column';
import { PrimeReactProvider } from 'primereact/api';
import '../../media/primereact-theme/themes/vscode/theme.scss';
import 'primeflex/primeflex.scss';

export interface MemoryAppState extends MemoryState {
    decorations: Decoration[];
    columns: ColumnStatus[];
}

export const DEFAULT_WORDS_PER_GROUP = 1;
export const DEFAULT_GROUPS_PER_ROW = 4;

class App extends React.Component<{}, MemoryAppState> {

    public constructor(props: {}) {
        super(props);
        columnContributionService.register(new AddressColumn(), false);
        columnContributionService.register(new DataColumn(), false);
        columnContributionService.register(variableDecorator);
        columnContributionService.register(new AsciiColumn());
        decorationService.register(variableDecorator);
        this.state = {
            memory: undefined,
            memoryReference: '',
            offset: 0,
            count: 256,
            decorations: [],
            columns: columnContributionService.getColumns(),
            isMemoryFetching: false
        };
    }

    public componentDidMount(): void {
        messenger.onRequest(setOptionsType, options => this.setOptions(options));
        messenger.sendNotification(readyType, HOST_EXTENSION, undefined);
        messenger.onNotification(columnVisibilityType, request => this.handleColumnVisibilityChanged(request));
    }

    public render(): React.ReactNode {
        return <PrimeReactProvider>
            <MemoryWidget
                memory={this.state.memory}
                decorations={this.state.decorations}
                columns={this.state.columns}
                memoryReference={this.state.memoryReference}
                offset={this.state.offset ?? 0}
                count={this.state.count}
                updateMemoryArguments={this.updateMemoryState}
                refreshMemory={this.refreshMemory}
                toggleColumn={this.toggleColumn}
                fetchMemory={this.fetchMemory}
                isMemoryFetching={this.state.isMemoryFetching}
            />
        </PrimeReactProvider>;
    }

    protected async handleColumnVisibilityChanged(request: ColumnVisibilityStatus): Promise<void> {
        const { active, id } = request;
        const columns = active ? await columnContributionService.show(id, this.state) : columnContributionService.hide(id);
        this.setState({ columns });
    }

    protected updateMemoryState = (newState: Partial<MemoryState>) => this.setState(prevState => ({ ...prevState, ...newState }));

    protected async setOptions(options?: Partial<DebugProtocol.ReadMemoryArguments>): Promise<void> {
        messenger.sendRequest(logMessageType, HOST_EXTENSION, `Setting options: ${JSON.stringify(options)}`);
        this.setState(prevState => ({ ...prevState, ...options }));
        return this.fetchMemory(options);
    }

    protected refreshMemory = () => { this.fetchMemory(); };

    protected fetchMemory = async (partialOptions?: Partial<DebugProtocol.ReadMemoryArguments>): Promise<void> => this.doFetchMemory(partialOptions);
    protected async doFetchMemory(partialOptions?: Partial<DebugProtocol.ReadMemoryArguments>): Promise<void> {
        this.setState(prev => ({ ...prev, isMemoryFetching: true }));
        const completeOptions = {
            memoryReference: partialOptions?.memoryReference || this.state.memoryReference,
            offset: partialOptions?.offset ?? this.state.offset,
            count: partialOptions?.count ?? this.state.count
        };

        const response = await messenger.sendRequest(readMemoryType, HOST_EXTENSION, completeOptions);
        await Promise.all(Array.from(
            new Set(columnContributionService.getUpdateExecutors().concat(decorationService.getUpdateExecutors())),
            executor => executor.fetchData(completeOptions)
        ));

        this.setState({
            decorations: decorationService.decorations,
            memory: this.convertMemory(response),
            memoryReference: completeOptions.memoryReference,
            offset: completeOptions.offset,
            count: completeOptions.count,
            isMemoryFetching: false
        });
        messenger.sendRequest(setOptionsType, HOST_EXTENSION, completeOptions);

    }

    protected convertMemory(result: DebugProtocol.ReadMemoryResponse['body']): Memory {
        if (!result?.data) { throw new Error('No memory provided!'); }
        const address = BigInt(result.address);
        const bytes = Uint8Array.from(Buffer.from(result.data, 'base64'));
        return { bytes, address };
    }

    protected toggleColumn = (id: string, active: boolean): void => { this.doToggleColumn(id, active); };

    protected doToggleColumn(id: string, active: boolean): void {
        messenger.sendNotification(columnVisibilityType, HOST_EXTENSION, { id, active });
    }
}

const container = document.getElementById('root') as Element;
createRoot(container).render(<App />);
