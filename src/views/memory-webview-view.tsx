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
import ReactDOM from 'react-dom';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { RPCProtocolImpl } from '../rpc-protocol';
import { MainService, MemoryOptions, ViewService, WEBVIEW_RPC_CONTEXT } from './memory-webview-rpc';

class App extends React.Component implements ViewService {
    private _proxy: MainService | undefined;
    protected get proxy(): MainService {
        if (!this._proxy) {
            const vscodeApi = acquireVsCodeApi();
            const rpc = new RPCProtocolImpl(message => vscodeApi.postMessage(message));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            window.addEventListener('message', (message: any) => rpc.onMessage(message.data));
            this._proxy = rpc.getProxy(WEBVIEW_RPC_CONTEXT.MAIN);

            rpc.set(WEBVIEW_RPC_CONTEXT.VIEW, this);
        }

        return this._proxy;
    }

    public render(): React.ReactNode {
        return (
            <div>
                <VSCodeButton
                    id='hello-button'
                    title='Hello'
                    aria-label='Hello'
                    onClick={() => this.proxy.$logMessage('hello')}>
                    Hello
                </VSCodeButton>
            </div>
        );
    }

    public $setOptions(options: MemoryOptions): void {
        this.proxy.$logMessage(JSON.stringify(options));
    }
}

ReactDOM.render(<App />, document.getElementById('root'));
