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

import * as vscode from 'vscode';
import * as manifest from '../manifest';
import Long from 'long';
import { MainService, MemoryOptions, MemoryReadRequest, MemoryReadResponse, MemoryWriteRequest, ViewService, WEBVIEW_RPC_CONTEXT } from './memory-webview-rpc';
import { RPCProtocolImpl } from '../rpc-protocol';
import { MemoryProvider } from '../memory-provider';
import { logger } from '../logger';

interface Variable {
    name: string;
    value: string;
    variablesReference: number;
    memoryReference: number;
}

const isMemoryVariable = (variable: any): variable is Variable => variable && !!(variable as Variable).memoryReference;

export class MemoryWebview implements MainService {
    public static ViewType = `${manifest.PACKAGE_NAME}.memory`;
    public static ShowCommandType = `${manifest.PACKAGE_NAME}.show`;
    public static VariableCommandType = `${manifest.PACKAGE_NAME}.show-variable`;

    protected proxy: ViewService | undefined;
    protected memoryOptions: MemoryOptions = {
        startAddress: 0,
        locationOffset: 0,
        readLength: 256
    };

    public constructor(protected extensionUri: vscode.Uri, protected memoryProvider: MemoryProvider) {
    }

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        context.subscriptions.push(
            vscode.commands.registerCommand(MemoryWebview.ShowCommandType, () => this.show()),
            vscode.commands.registerCommand(MemoryWebview.VariableCommandType, node => {
                const variable = node.variable;
                if (isMemoryVariable(variable)) {
                    this.show(variable.memoryReference);
                }
            })
        );
    };

    public async show(startAddress = 0): Promise<void> {
        const baseExtensionUriString = this.extensionUri.toString();
        const distPathUri = vscode.Uri.parse(`${baseExtensionUriString}/dist/views`, true /* strict */);
        const mediaPathUri = vscode.Uri.parse(`${baseExtensionUriString}/media`, true /* strict */);

        const options = {
            retainContextWhenHidden: true,
            enableScripts: true,                            // enable scripts in the webview
            localResourceRoots: [distPathUri, mediaPathUri] // restrict extension's local file access
        };

        const panel = vscode.window.createWebviewPanel(MemoryWebview.ViewType, 'Memory Inspector', vscode.ViewColumn.Three, options);

        // Set HTML content
        panel.webview.html = await this._getWebviewContent(panel.webview, this.extensionUri);

        // Sets up an event listener to listen for messages passed from the webview view context
        // and executes code based on the message that is recieved
        this._setWebviewMessageListener(panel.webview);

        this.memoryOptions.startAddress = startAddress;
    }

    private async _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): Promise<string> {
        const mainUri = webview.asWebviewUri(vscode.Uri.joinPath(
            extensionUri,
            'dist',
            'views',
            'memory.js'
        ));

        // webview.cspSource does not include all CSP sources for VS Code Web
        const webviewUri = webview.asWebviewUri(extensionUri);
        const baseSource = `${webviewUri.scheme}://${webviewUri.authority}`;
        const cspSrc = `${webview.cspSource} ${baseSource}`;

        return `
            <!DOCTYPE html>
            <html lang='en'>
                <head>
                    <meta charset='UTF-8'>
                    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                    <meta http-equiv='Content-Security-Policy' content="default-src 'none'; script-src ${cspSrc}; style-src ${cspSrc} 'unsafe-inline'; font-src ${cspSrc};">
                    <script type='module' src='${mainUri}'></script>
                </head>
                <body>
                    <div id='root'></div>
                </body>
            </html>
        `;
    }

    protected _setWebviewMessageListener(webview: vscode.Webview): void {
        const rpc = new RPCProtocolImpl(message => webview.postMessage(message));
        webview.onDidReceiveMessage(message => rpc.onMessage(message));
        this.proxy = rpc.getProxy(WEBVIEW_RPC_CONTEXT.VIEW);
        rpc.set(WEBVIEW_RPC_CONTEXT.MAIN, this);
    }

    protected async refresh(): Promise<void> {
        if (!this.proxy) {
            return;
        }

        this.proxy.$setOptions(this.memoryOptions);
    }

    public $ready(): void {
        this.refresh();
    }

    public $logMessage(message: string): void {
        logger.info(message);
    }

    public async $readMemory(request: MemoryReadRequest): Promise<MemoryReadResponse> {
        const result = await this.memoryProvider.readMemory(request);

        if (result?.data) {
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

        throw new Error('Received no data from debug adapter.');
    }

    public async $writeMemory(request: MemoryWriteRequest): Promise<number | undefined> {
        const result = await this.memoryProvider.writeMemory(request);
        return result.body?.bytesWritten;
    }
}
