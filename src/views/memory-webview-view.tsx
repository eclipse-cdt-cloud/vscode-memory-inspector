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

import Long from 'long';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Messenger } from 'vscode-messenger-webview';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import { MemoryTable } from './components/memory-table';
import {
    MemoryOptions,
    MemoryReadResponse,
    readyType,
    logMessageType,
    setOptionsType,
    readMemoryType
} from './memory-webview-common';

export interface Memory {
    address: Long;
    bytes: Uint8Array;
}

interface MemoryState {
    memory?: Memory
}

class App extends React.Component<{}, MemoryState> {

    private _messenger: Messenger | undefined;
    protected get messenger(): Messenger {
        if (!this._messenger) {
            const vscode = acquireVsCodeApi();
            this._messenger = new Messenger(vscode, {debugLog: true});
            this._messenger.start();
        }

        return this._messenger;
    }

    public constructor(props: {}) {
        super(props);
        this.state = { memory: undefined };
    }

    public componentDidMount(): void {
        this.messenger.onRequest(setOptionsType, options => this.setOptions(options));
        this.messenger.sendNotification(readyType, HOST_EXTENSION, undefined);
    }

    public render(): React.ReactNode {
        const { memory } = this.state;
        return (
            <div>
                <MemoryTable memory={memory}>
                </MemoryTable>
            </div>
        );
    }

    protected async setOptions(options: MemoryOptions): Promise<void> {
        this.messenger.sendRequest(logMessageType, HOST_EXTENSION, JSON.stringify(options));

        const response = await this.messenger.sendRequest(readMemoryType, HOST_EXTENSION, {
            memoryReference: `${options.startAddress}`,
            count: options.readLength,
            offset: options.locationOffset
        });

        this.setState({
            memory: this.convertMemory(response)
        });
    }

    protected convertMemory(result: MemoryReadResponse): Memory {
        if (result.address.startsWith('0x')) {
            // Assume hex
            const bytes = Uint8Array.from(Buffer.from(result.data, 'hex'));
            const address = Long.fromString(result.address, true, 16);
            return { bytes, address };
        } else {
            // Assume base64
            const bytes = Uint8Array.from(Buffer.from(result.data, 'base64'));
            const address = Long.fromString(result.address, true, 10);
            return { bytes, address };
        }
    }
}

const container = document.getElementById('root') as Element;
createRoot(container).render(<App />);
