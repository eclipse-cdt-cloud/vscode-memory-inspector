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
import type { DebugProtocol } from '@vscode/debugprotocol';
import * as manifest from './manifest';
import { Messenger } from 'vscode-messenger';
import { MessageParticipant, WebviewIdMessageParticipant } from 'vscode-messenger-common';
import {
    readyType,
    logMessageType,
    setOptionsType,
    readMemoryType,
    writeMemoryType,
    MemoryReadResult,
    MemoryWriteResult,
    getVariables,
    memoryDisplayConfigurationChangedType,
    columnVisibilityType,
    setMemoryDisplayConfigurationType,
} from '../common/messaging';
import { MemoryProvider } from './memory-provider';
import { outputChannelLogger } from './logger';
import { VariableRange } from '../common/memory-range';
import { ColumnVisibilityStatus, LoadingBehavior, MemoryDisplayConfiguration as MemoryDisplayConfiguration, ScrollingBehavior } from '../webview/utils/view-types';

interface Variable {
    name: string;
    value: string;
    variablesReference: number;
    memoryReference: number;
}

enum RefreshEnum {
    off = 0,
    on = 1
}

const isMemoryVariable = (variable: Variable): variable is Variable => variable && !!(variable as Variable).memoryReference;
const columnConfigurations = [
    manifest.CONFIG_SHOW_ASCII_COLUMN,
    manifest.CONFIG_SHOW_VARIABLES_COLUMN,
];

export class MemoryWebview implements vscode.CustomReadonlyEditorProvider {
    public static ViewType = `${manifest.PACKAGE_NAME}.memory`;
    public static ShowCommandType = `${manifest.PACKAGE_NAME}.show`;
    public static VariableCommandType = `${manifest.PACKAGE_NAME}.show-variable`;

    protected messenger: Messenger;
    protected refreshOnStop: RefreshEnum;

    public constructor(protected extensionUri: vscode.Uri, protected memoryProvider: MemoryProvider) {
        this.messenger = new Messenger();

        this.refreshOnStop = this.getRefresh();
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.CONFIG_REFRESH_ON_STOP}`)) {
                this.refreshOnStop = this.getRefresh();
            }
        });
    }

    public activate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.window.registerCustomEditorProvider(manifest.EDITOR_NAME, this),
            vscode.commands.registerCommand(MemoryWebview.ShowCommandType, () => this.show()),
            vscode.commands.registerCommand(MemoryWebview.VariableCommandType, node => {
                const variable = node.variable;
                if (isMemoryVariable(variable)) {
                    this.show({ memoryReference: variable.memoryReference.toString() });
                }
            })
        );
    };

    public openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
        return {
            uri,
            dispose: () => { }
        };
    }

    public async resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        /*
            memoryReference = debugprotocol.variable.memoryReference
            displayName = 'memory'
            DEBUG_MEMORY_SCHEME = 'vscode-debug-memory'
            sessionId = <debug session ID>
            range = undefined

            document.uri is:

            scheme: DEBUG_MEMORY_SCHEME,
            authority: sessionId,
            path: '/' + encodeURIComponent(memoryReference) + `/${encodeURIComponent(displayName)}.bin`,
            query: range ? `?range=${range.fromOffset}:${range.toOffset}` : undefined,
        */

        const memoryReference = decodeURIComponent(document.uri.path.split('/')[1]);
        await this.show({ memoryReference }, webviewPanel);
    }

    public async show(initialMemory?: Partial<DebugProtocol.ReadMemoryArguments>, panel?: vscode.WebviewPanel): Promise<void> {
        const distPathUri = vscode.Uri.joinPath(this.extensionUri, 'dist', 'views');
        const mediaPathUri = vscode.Uri.joinPath(this.extensionUri, 'media');
        const codiconPathUri = vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist');

        const options = {
            retainContextWhenHidden: true,
            enableScripts: true,                            // enable scripts in the webview
            localResourceRoots: [distPathUri, mediaPathUri, codiconPathUri] // restrict extension's local file access
        };

        if (!panel) {
            panel = vscode.window.createWebviewPanel(MemoryWebview.ViewType, 'Memory Inspector', vscode.ViewColumn.Active, options);
        } else {
            panel.webview.options = options;
        }

        // Set HTML content
        await this.getWebviewContent(panel);

        // Sets up an event listener to listen for messages passed from the webview view context
        // and executes code based on the message that is recieved
        this.setWebviewMessageListener(panel, initialMemory);
    }

    protected getRefresh(): RefreshEnum {
        const config = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<string>(manifest.CONFIG_REFRESH_ON_STOP) || manifest.DEFAULT_REFRESH_ON_STOP;
        return RefreshEnum[config as keyof typeof RefreshEnum];
    }

    protected async getWebviewContent(panel: vscode.WebviewPanel): Promise<void> {
        const mainUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(
            this.extensionUri,
            'dist',
            'views',
            'memory.js'
        ));

        const cspSrc = panel.webview.cspSource;
        const codiconsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
        const memoryInspectorCSS = panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'index.css'));

        panel.webview.html = `
            <!DOCTYPE html>
            <html lang='en'>
                <head>
                    <meta charset='UTF-8'>
                    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                    <meta http-equiv='Content-Security-Policy' content="default-src 'none'; font-src ${cspSrc}; style-src ${cspSrc} 'unsafe-inline'; script-src ${cspSrc};">
                    <script type='module' src='${mainUri}'></script>
                    <link href="${codiconsUri}" rel="stylesheet" />
                    <link href="${memoryInspectorCSS}" rel="stylesheet" />
                </head>
                <body>
                    <div id='root'></div>
                </body>
            </html>
        `;
    }

    protected setWebviewMessageListener(panel: vscode.WebviewPanel, options?: Partial<DebugProtocol.ReadMemoryArguments>): void {
        const participant = this.messenger.registerWebviewPanel(panel);

        const disposables = [
            this.messenger.onNotification(readyType, () => {
                this.refresh(participant, options);
            }, { sender: participant }),
            this.messenger.onRequest(setOptionsType, o => {
                options = { ...options, ...o };
            }, { sender: participant }),
            this.messenger.onRequest(logMessageType, message => outputChannelLogger.info('[webview]:', message), { sender: participant }),
            this.messenger.onRequest(readMemoryType, request => this.readMemory(request), { sender: participant }),
            this.messenger.onRequest(writeMemoryType, request => this.writeMemory(request), { sender: participant }),
            this.messenger.onRequest(getVariables, request => this.getVariables(request), { sender: participant }),
            this.messenger.onNotification(setMemoryDisplayConfigurationType, request => this.setConfiguration(request), { sender: participant }),
            this.messenger.onNotification(columnVisibilityType, request => this.handleColumnToggled(request), { sender: participant }),

            this.memoryProvider.onDidStopDebug(() => {
                if (this.refreshOnStop === RefreshEnum.on) {
                    this.refresh(participant);
                }
            }),
            this.onMemoryDisplayConfigurationChanged(participant),
            this.onColumnVisibilityConfigurationChanged(participant),
        ];
        panel.onDidChangeViewState(newState => {
            if (newState.webviewPanel.visible) {
                this.refresh(participant, options);
            }
        });
        panel.onDidDispose(() => disposables.forEach(disposible => disposible.dispose()));
    }

    protected handleColumnToggled(request: ColumnVisibilityStatus): void {
        const { id, active: visible } = request;
        vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).update(`columns.${id}`, visible, vscode.ConfigurationTarget.Global);
    }

    protected setConfiguration(request: { id: string, value: unknown }): void {
        const { id, value } = request;
        vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).update(id, value, vscode.ConfigurationTarget.Global);
    }

    protected async refresh(participant: WebviewIdMessageParticipant, options?: Partial<DebugProtocol.ReadMemoryArguments>): Promise<void> {
        this.messenger.sendRequest(setOptionsType, participant, options);
        const memoryDisplayConfiguration = this.getMemoryDisplayConfiguration();
        this.messenger.sendNotification(memoryDisplayConfigurationChangedType, participant, memoryDisplayConfiguration);
        columnConfigurations.forEach(columnConfiguration => {
            const [, id] = columnConfiguration.split('.');
            const active = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<boolean>(columnConfiguration) ?? true;
            this.messenger.sendNotification(columnVisibilityType, participant, { id, active });
        });
    }

    protected getMemoryDisplayConfiguration(): MemoryDisplayConfiguration {
        const memoryInspectorConfiguration = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME);
        const wordsPerGroup = memoryInspectorConfiguration.get<number>(manifest.CONFIG_WORDS_PER_GROUP) || manifest.DEFAULT_WORDS_PER_GROUP;
        const groupsPerRow = memoryInspectorConfiguration.get<number>(manifest.CONFIG_GROUPS_PER_ROW) || manifest.DEFAULT_GROUPS_PER_ROW;
        const scrollingBehavior = memoryInspectorConfiguration.get<ScrollingBehavior>(manifest.CONFIG_SCROLLING_BEHAVIOR) || manifest.DEFAULT_SCROLLING_BEHAVIOR;
        const loadingBehavior = memoryInspectorConfiguration.get<LoadingBehavior>(manifest.CONFIG_LOADING_BEHAVIOR) || manifest.DEFAULT_LOADING_BEHAVIOR;
        return { wordsPerGroup, groupsPerRow, scrollingBehavior, loadingBehavior };
    }

    protected onMemoryDisplayConfigurationChanged(participant: MessageParticipant): vscode.Disposable {
        const memoryDisplayConfigurations = [
            manifest.CONFIG_WORDS_PER_GROUP,
            manifest.CONFIG_GROUPS_PER_ROW,
            manifest.CONFIG_SCROLLING_BEHAVIOR,
        ];
        return vscode.workspace.onDidChangeConfiguration(e => {
            if (memoryDisplayConfigurations.some(configurationOption => e.affectsConfiguration(`${manifest.PACKAGE_NAME}.${configurationOption}`))) {
                const configuration = this.getMemoryDisplayConfiguration();
                this.messenger.sendNotification(memoryDisplayConfigurationChangedType, participant, configuration);
            }
        });
    }

    protected onColumnVisibilityConfigurationChanged(participant: MessageParticipant): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            columnConfigurations.forEach(configuration => {
                if (e.affectsConfiguration(`${manifest.PACKAGE_NAME}.${configuration}`)) {
                    const [, id] = configuration.split('.');
                    const active = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<boolean>(configuration) ?? true;
                    this.messenger.sendNotification(columnVisibilityType, participant, { id, active });
                }
            });
        });
    }

    protected async readMemory(request: DebugProtocol.ReadMemoryArguments): Promise<MemoryReadResult> {
        try {
            return await this.memoryProvider.readMemory(request);
        } catch (err) {
            outputChannelLogger.error('Error fetching memory', err instanceof Error ? `: ${err.message}\n${err.stack}` : '');
        }
    }

    protected async writeMemory(request: DebugProtocol.WriteMemoryArguments): Promise<MemoryWriteResult> {
        try {
            return await this.memoryProvider.writeMemory(request);
        } catch (err) {
            outputChannelLogger.error('Error writing memory', err instanceof Error ? `: ${err.message}\n${err.stack}` : '');
        }
    }

    protected async getVariables(request: DebugProtocol.ReadMemoryArguments): Promise<VariableRange[]> {
        try {
            return await this.memoryProvider.getVariables(request);
        } catch (err) {
            outputChannelLogger.error('Error fetching variables', err instanceof Error ? `: ${err.message}\n${err.stack}` : '');
            return [];
        }
    }
}
