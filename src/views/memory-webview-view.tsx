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
import { MemoryTable } from './components/memory-table';
import { RPCProtocolImpl } from '../rpc-protocol';
import {
    MainService,
    MemoryOptions,
    MemoryReadResponse,
    ViewService,
    WEBVIEW_RPC_CONTEXT
} from './memory-webview-rpc';

export interface Memory {
    address: Long;
    bytes: Uint8Array;
}

interface MemoryState {
    memory?: Memory
}

class App extends React.Component<{}, MemoryState> implements ViewService {
    private _rpc: RPCProtocolImpl | undefined;
    protected get rpc(): RPCProtocolImpl {
        if (!this._rpc) {
            const vscodeApi = acquireVsCodeApi();
            const rpc = new RPCProtocolImpl(message => vscodeApi.postMessage(message));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            window.addEventListener('message', (message: any) => rpc.onMessage(message.data));
            this._rpc = rpc;
        }

        return this._rpc;
    }

    protected get proxy(): MainService {
        return this.rpc.getProxy(WEBVIEW_RPC_CONTEXT.MAIN);
    }

    public constructor(props: {}) {
        super(props);
        this.state = { memory: undefined };
    }

    public componentDidMount(): void {
        this.rpc.set(WEBVIEW_RPC_CONTEXT.VIEW, this);
        this.proxy.$ready();
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

    public async $setOptions(options: MemoryOptions): Promise<void> {
        this.proxy.$logMessage(JSON.stringify(options));

        const response = await this.proxy.$readMemory({
            memoryReference: `${options.startAddress}`,
            count: options.readLength,
            offset: options.locationOffset
        });

        this.setState({
            memory: this.convert(response)
        });
    }

    protected convert(result: MemoryReadResponse): Memory {
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
