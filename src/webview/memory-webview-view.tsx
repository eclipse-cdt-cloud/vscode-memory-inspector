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

import 'primeflex/primeflex.css';
import { PrimeReactProvider } from 'primereact/api';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HOST_EXTENSION, WebviewIdMessageParticipant } from 'vscode-messenger-common';
import { Memory, createMemoryFromRead } from '../common/memory';
import { BigIntMemoryRange, Endianness, WrittenMemory, doOverlap, getAddressLength, getAddressString } from '../common/memory-range';
import {
    MemoryOptions,
    ReadMemoryArguments,
    WebviewSelection,
    applyMemoryType,
    getWebviewSelectionType,
    logMessageType,
    memoryWrittenType,
    readMemoryType,
    readyType,
    resetMemoryViewSettingsType,
    setMemoryViewSettingsType,
    setOptionsType,
    setTitleType,
    showAdvancedOptionsType,
    storeMemoryType,
} from '../common/messaging';
import { AddressColumn } from './columns/address-column';
import { AsciiColumn } from './columns/ascii-column';
import { ColumnStatus, columnContributionService } from './columns/column-contribution-service';
import { DataColumn } from './columns/data-column';
import { MemoryWidget } from './components/memory-widget';
import { decorationService } from './decorations/decoration-service';
import { Decoration, MemoryDisplayConfiguration, MemoryState } from './utils/view-types';
import { variableDecorator } from './variables/variable-decorations';
import { messenger } from './view-messenger';
import { hoverService, HoverService } from './hovers/hover-service';
import { AddressHover } from './hovers/address-hover';
import { DataHover } from './hovers/data-hover';
import { VariableHover } from './hovers/variable-hover';

export interface MemoryAppState extends MemoryState, MemoryDisplayConfiguration {
    messageParticipant: WebviewIdMessageParticipant;
    title: string;
    effectiveAddressLength: number;
    decorations: Decoration[];
    hoverService: HoverService;
    columns: ColumnStatus[];
    isFrozen: boolean;
}

const MEMORY_DISPLAY_CONFIGURATION_DEFAULTS: MemoryDisplayConfiguration = {
    bytesPerWord: 1,
    wordsPerGroup: 1,
    groupsPerRow: 4,
    endianness: Endianness.Little,
    scrollingBehavior: 'Paginate',
    addressPadding: 'Min',
    addressRadix: 16,
    showRadixPrefix: true,
};
const DEFAULT_READ_ARGUMENTS: Required<ReadMemoryArguments> = {
    memoryReference: '',
    offset: 0,
    count: 256,
};

class App extends React.Component<{}, MemoryAppState> {
    protected memoryWidget = React.createRef<MemoryWidget>();

    public constructor(props: {}) {
        super(props);
        columnContributionService.register(new AddressColumn(), false);
        columnContributionService.register(new DataColumn(), false);
        columnContributionService.register(variableDecorator);
        columnContributionService.register(new AsciiColumn());
        decorationService.register(variableDecorator);
        hoverService.register(new AddressHover());
        hoverService.register(new DataHover());
        hoverService.register(new VariableHover());
        this.state = {
            messageParticipant: { type: 'webview', webviewId: '' },
            title: 'Memory',
            memory: undefined,
            effectiveAddressLength: 0,
            configuredReadArguments: DEFAULT_READ_ARGUMENTS,
            activeReadArguments: DEFAULT_READ_ARGUMENTS,
            decorations: [],
            hoverService: hoverService,
            columns: columnContributionService.getColumns(),
            isMemoryFetching: false,
            isFrozen: false,
            ...MEMORY_DISPLAY_CONFIGURATION_DEFAULTS
        };
    }

    public componentDidMount(): void {
        messenger.onRequest(setOptionsType, options => this.setOptions(options));
        messenger.onNotification(memoryWrittenType, writtenMemory => this.handleWrittenMemory(writtenMemory));
        messenger.onNotification(setMemoryViewSettingsType, config => {
            if (config.visibleColumns) {
                for (const column of columnContributionService.getColumns()) {
                    const id = column.contribution.id;
                    const configurable = column.configurable;
                    this.toggleColumn(id, !configurable || config.visibleColumns.includes(id));
                }
            }
            this.setState(prevState => ({ ...prevState, ...config, title: config.title ?? prevState.title, }));
        });
        messenger.onRequest(getWebviewSelectionType, () => this.getWebviewSelection());
        messenger.onNotification(showAdvancedOptionsType, () => this.showAdvancedOptions());
        messenger.sendNotification(readyType, HOST_EXTENSION, undefined);
    }

    public componentDidUpdate(_: {}, prevState: MemoryAppState): void {
        const addressPaddingNeedsUpdate =
            (this.state.addressPadding === 'Min' && this.state.memory !== prevState.memory)
            || this.state.addressPadding !== prevState.addressPadding;
        if (addressPaddingNeedsUpdate) {
            const effectiveAddressLength = this.getEffectiveAddressLength(this.state.memory);
            if (this.state.effectiveAddressLength !== effectiveAddressLength) {
                this.setState({ effectiveAddressLength });
            }
        }
        hoverService.setMemoryState(this.state);
    }

    protected handleWrittenMemory(writtenMemory: WrittenMemory): void {
        if (!this.state.memory) {
            return;
        }
        if (this.state.activeReadArguments.memoryReference === writtenMemory.memoryReference) {
            // catch simple case
            this.updateMemoryState();
            return;
        }
        try {
            // if we are dealing with numeric addresses (and not expressions) then we can determine the overlap
            const written: BigIntMemoryRange = {
                startAddress: BigInt(writtenMemory.memoryReference),
                endAddress: BigInt(writtenMemory.memoryReference) + BigInt(writtenMemory.count ?? 0)
            };
            const shown: BigIntMemoryRange = {
                startAddress: this.state.memory.address,
                endAddress: this.state.memory.address + BigInt(this.state.memory.bytes.length)
            };
            if (doOverlap(written, shown)) {
                this.updateMemoryState();
            }
        } catch (error) {
            // ignore and fall through
        }

        // we could try to convert any expression we may have to an address by sending an evaluation request to the DA
        // but for now we just go with a pessimistic approach: if we are unsure, we refresh the memory
        this.updateMemoryState();
    }

    public render(): React.ReactNode {
        return <PrimeReactProvider>
            <MemoryWidget
                ref={this.memoryWidget}
                messageParticipant={this.state.messageParticipant}
                configuredReadArguments={this.state.configuredReadArguments}
                activeReadArguments={this.state.activeReadArguments}
                memory={this.state.memory}
                decorations={this.state.decorations}
                hoverService={this.state.hoverService}
                columns={this.state.columns}
                title={this.state.title}
                effectiveAddressLength={this.state.effectiveAddressLength}
                updateMemoryState={this.updateMemoryState}
                updateMemoryDisplayConfiguration={this.updateMemoryDisplayConfiguration}
                resetMemoryDisplayConfiguration={this.resetMemoryDisplayConfiguration}
                updateTitle={this.updateTitle}
                toggleColumn={this.toggleColumn}
                toggleFrozen={this.toggleFrozen}
                isFrozen={this.state.isFrozen}
                fetchMemory={this.fetchMemory}
                isMemoryFetching={this.state.isMemoryFetching}
                bytesPerWord={this.state.bytesPerWord}
                groupsPerRow={this.state.groupsPerRow}
                endianness={this.state.endianness}
                wordsPerGroup={this.state.wordsPerGroup}
                scrollingBehavior={this.state.scrollingBehavior}
                addressPadding={this.state.addressPadding}
                addressRadix={this.state.addressRadix}
                showRadixPrefix={this.state.showRadixPrefix}
                triggerStoreMemory={this.requestStoreMemory}
                triggerApplyMemory={this.requestApplyMemory}
            />
        </PrimeReactProvider>;
    }

    protected updateMemoryState = (newState?: Partial<MemoryState>) => this.setState(prevState => ({ ...prevState, ...newState }));
    protected updateMemoryDisplayConfiguration = (newState: Partial<MemoryDisplayConfiguration>) => this.setState(prevState => ({ ...prevState, ...newState }));
    protected resetMemoryDisplayConfiguration = () => messenger.sendNotification(resetMemoryViewSettingsType, HOST_EXTENSION, undefined);
    protected updateTitle = (title: string) => {
        this.setState({ title });
        messenger.sendNotification(setTitleType, HOST_EXTENSION, title);
    };

    protected async setOptions(options?: MemoryOptions): Promise<void> {
        messenger.sendRequest(logMessageType, HOST_EXTENSION, `Setting options: ${JSON.stringify(options)}`);
        if (this.state.configuredReadArguments.memoryReference === '') {
            // Only update if we have no user configured read arguments
            this.setState(prevState => ({ ...prevState, configuredReadArguments: { ...this.state.configuredReadArguments, ...options } }));
        }

        return this.fetchMemory(options);
    }

    protected fetchMemory = async (partialOptions?: MemoryOptions): Promise<void> => this.doFetchMemory(partialOptions);
    protected async doFetchMemory(partialOptions?: MemoryOptions): Promise<void> {
        if (this.state.isFrozen) {
            return;
        }
        this.setState(prev => ({ ...prev, isMemoryFetching: true }));
        const completeOptions = {
            memoryReference: partialOptions?.memoryReference || this.state.activeReadArguments.memoryReference,
            offset: partialOptions?.offset ?? this.state.activeReadArguments.offset,
            count: partialOptions?.count ?? this.state.activeReadArguments.count
        };

        try {
            const response = await messenger.sendRequest(readMemoryType, HOST_EXTENSION, completeOptions);
            await Promise.all(Array.from(
                new Set(columnContributionService.getUpdateExecutors().concat(decorationService.getUpdateExecutors())),
                executor => executor.fetchData(completeOptions)
            ));

            const memory = createMemoryFromRead(response);

            this.setState(prev => ({
                ...prev,
                decorations: decorationService.decorations,
                memory,
                activeReadArguments: completeOptions,
                isMemoryFetching: false
            }));

            messenger.sendRequest(setOptionsType, HOST_EXTENSION, completeOptions);
        } catch (ex) {
            // Do not show old results if the current search provided no memory
            this.setState(prev => ({
                ...prev,
                memory: undefined,
                activeReadArguments: completeOptions,
            }));

            if (ex instanceof Error) {
                console.error(ex);
            }
        } finally {
            this.setState(prev => ({ ...prev, isMemoryFetching: false }));
        }

    }

    protected getEffectiveAddressLength(memory?: Memory): number {
        const { addressRadix, addressPadding } = this.state;
        return addressPadding === 'Min' ? this.getLastAddressLength(memory) : getAddressLength(addressPadding, addressRadix);
    }

    protected getLastAddressLength(memory?: Memory): number {
        if (memory === undefined || this.state.groupsPerRow === 'Autofit') {
            return 0;
        }
        const rowLength = this.state.bytesPerWord * this.state.wordsPerGroup * this.state.groupsPerRow;
        const rows = Math.ceil(memory.bytes.length / rowLength);
        const finalAddress = memory.address + BigInt(((rows - 1) * rowLength));
        return getAddressString(finalAddress, this.state.addressRadix).length;
    }

    protected toggleColumn = (id: string, active: boolean): void => { this.doToggleColumn(id, active); };
    protected async doToggleColumn(id: string, isVisible: boolean): Promise<void> {
        const columns = isVisible ? await columnContributionService.show(id, this.state) : columnContributionService.hide(id);
        this.setState(prevState => ({ ...prevState, columns }));
    }

    protected toggleFrozen = (): void => { this.doToggleFrozen(); };
    protected doToggleFrozen(): void {
        this.setState(prevState => ({ ...prevState, isFrozen: !prevState.isFrozen }));
    }

    protected showAdvancedOptions(): void {
        this.memoryWidget.current?.showAdvancedOptions();
    }

    protected getWebviewSelection(): WebviewSelection {
        return this.memoryWidget.current?.getWebviewSelection() ?? {};
    }

    protected requestStoreMemory = (): void => {
        messenger.sendRequest(storeMemoryType, HOST_EXTENSION, { ...this.state.activeReadArguments });
    };

    protected requestApplyMemory = async (): Promise<void> => {
        await messenger.sendRequest(applyMemoryType, HOST_EXTENSION, undefined);
    };
}

const container = document.getElementById('root') as Element;
createRoot(container).render(<App />);
