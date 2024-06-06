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

import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { Messenger } from 'vscode-messenger';
import { WebviewIdMessageParticipant } from 'vscode-messenger-common';
import { SetDataBreakpointsArguments, SetDataBreakpointsResult } from '../common/breakpoint';
import * as manifest from '../common/manifest';
import { VariableRange } from '../common/memory-range';
import {
    applyMemoryType,
    getVariablesType,
    getWebviewSelectionType,
    logMessageType,
    MemoryOptions,
    memoryWrittenType,
    notifyContinuedType,
    notifyStoppedType,
    ReadMemoryArguments,
    ReadMemoryResult,
    readMemoryType,
    readyType,
    resetMemoryViewSettingsType,
    SessionContext,
    sessionContextChangedType,
    setMemoryViewSettingsType,
    setOptionsType,
    setTitleType,
    setTrackedBreakpointType,
    showAdvancedOptionsType,
    StoreMemoryArguments,
    storeMemoryType,
    WebviewSelection,
    WriteMemoryArguments,
    WriteMemoryResult,
    writeMemoryType
} from '../common/messaging';
import { MemoryViewSettings, ScrollingBehavior } from '../common/webview-configuration';
import { getVisibleColumns, isWebviewGroupContext, isWebviewVariableContext, WebviewContext } from '../common/webview-context';
import { BreakpointProvider } from './breakpoints/breakpoint-provider';
import { BreakpointTracker } from './breakpoints/breakpoint-tracker';
import { isVariablesContext } from './external-views';
import { outputChannelLogger } from './logger';
import { MemoryProvider } from './memory-provider';
import { ApplyCommandType, StoreCommandType } from './memory-storage';
import { isSessionEvent, SessionEvent, SessionTracker } from './session-tracker';

const CONFIGURABLE_COLUMNS = [
    manifest.CONFIG_SHOW_ASCII_COLUMN,
    manifest.CONFIG_SHOW_VARIABLES_COLUMN,
];

export class MemoryWebview implements vscode.CustomReadonlyEditorProvider {
    public static ViewType = `${manifest.PACKAGE_NAME}.memory`;
    public static ShowCommandType = `${manifest.PACKAGE_NAME}.show`;
    public static VariableCommandType = `${manifest.PACKAGE_NAME}.show-variable`;
    public static GoToValueCommandType = `${manifest.PACKAGE_NAME}.go-to-value`;
    public static ToggleAsciiColumnCommandType = `${manifest.PACKAGE_NAME}.toggle-ascii-column`;
    public static ToggleVariablesColumnCommandType = `${manifest.PACKAGE_NAME}.toggle-variables-column`;
    public static ToggleRadixPrefixCommandType = `${manifest.PACKAGE_NAME}.toggle-radix-prefix`;
    public static ShowAdvancedDisplayConfigurationCommandType = `${manifest.PACKAGE_NAME}.show-advanced-display-options`;
    public static GetWebviewSelectionCommandType = `${manifest.PACKAGE_NAME}.get-webview-selection`;
    public static SetDataBreakpointReadCommandType = `${manifest.PACKAGE_NAME}.data-breakpoint.set.read`;
    public static SetDataBreakpointReadWriteCommandType = `${manifest.PACKAGE_NAME}.data-breakpoint.set.readWrite`;
    public static SetDataBreakpointWriteCommandType = `${manifest.PACKAGE_NAME}.data-breakpoint.set.write`;
    public static RemoveDataBreakpointCommandType = `${manifest.PACKAGE_NAME}.data-breakpoint.remove`;
    public static RemoveAllDataBreakpointCommandType = `${manifest.PACKAGE_NAME}.data-breakpoint.remove-all`;

    protected messenger: Messenger;

    protected panelIndices: number = 1;

    public constructor(
        protected extensionUri: vscode.Uri,
        protected memoryProvider: MemoryProvider,
        protected sessionTracker: SessionTracker,
        protected breakpointTracker: BreakpointTracker,
        protected breakpointProvider: BreakpointProvider) {
        this.messenger = new Messenger();
    }

    public activate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.window.registerCustomEditorProvider(manifest.EDITOR_NAME, this),
            vscode.commands.registerCommand(MemoryWebview.ShowCommandType, () => this.show()),
            vscode.commands.registerCommand(MemoryWebview.VariableCommandType, async args => {
                if (isVariablesContext(args)) {
                    const memoryReference = args.variable.memoryReference ?? await this.memoryProvider.getAddressOfVariable(args.variable.name);
                    this.show({ memoryReference });
                }
            }),
            vscode.commands.registerCommand(MemoryWebview.GoToValueCommandType, async args => {
                if (isWebviewVariableContext(args) && args.variable.isPointer) {
                    this.show({ memoryReference: args.variable.value });
                }
            }),
            vscode.commands.registerCommand(MemoryWebview.ToggleVariablesColumnCommandType, (ctx: WebviewContext) => {
                this.toggleWebviewColumn(ctx, 'variables');
            }),
            vscode.commands.registerCommand(MemoryWebview.ToggleAsciiColumnCommandType, (ctx: WebviewContext) => {
                this.toggleWebviewColumn(ctx, 'ascii');
            }),
            vscode.commands.registerCommand(MemoryWebview.ToggleRadixPrefixCommandType, (ctx: WebviewContext) => {
                this.setMemoryViewSettings(ctx.messageParticipant, { showRadixPrefix: !ctx.showRadixPrefix });
            }),
            vscode.commands.registerCommand(MemoryWebview.ShowAdvancedDisplayConfigurationCommandType, async (ctx: WebviewContext) => {
                this.messenger.sendNotification(showAdvancedOptionsType, ctx.messageParticipant, undefined);
            }),
            vscode.commands.registerCommand(MemoryWebview.GetWebviewSelectionCommandType, (ctx: WebviewContext) => this.getWebviewSelection(ctx.messageParticipant)),
            vscode.commands.registerCommand(MemoryWebview.SetDataBreakpointReadCommandType, (ctx: WebviewContext) =>
                this.onSetDataBreakpointCommand(ctx, 'read')),
            vscode.commands.registerCommand(MemoryWebview.SetDataBreakpointWriteCommandType, (ctx: WebviewContext) =>
                this.onSetDataBreakpointCommand(ctx, 'write')),
            vscode.commands.registerCommand(MemoryWebview.SetDataBreakpointReadWriteCommandType, (ctx: WebviewContext) =>
                this.onSetDataBreakpointCommand(ctx, 'readWrite')),
            vscode.commands.registerCommand(MemoryWebview.RemoveDataBreakpointCommandType, (ctx: WebviewContext) => this.onRemoveDataBreakpointCommand(ctx)),
            vscode.commands.registerCommand(MemoryWebview.RemoveAllDataBreakpointCommandType, (ctx: WebviewContext) => this.onRemoveDataBreakpointCommand(ctx, true)),
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

    public async show(initialMemory?: MemoryOptions, panel?: vscode.WebviewPanel): Promise<void> {
        const distPathUri = vscode.Uri.joinPath(this.extensionUri, 'dist', 'views');
        const mediaPathUri = vscode.Uri.joinPath(this.extensionUri, 'media');
        const codiconPathUri = vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist');

        const options = {
            retainContextWhenHidden: true,
            enableScripts: true,                            // enable scripts in the webview
            localResourceRoots: [distPathUri, mediaPathUri, codiconPathUri] // restrict extension's local file access
        };

        if (!panel) {
            panel = vscode.window.createWebviewPanel(MemoryWebview.ViewType, `Memory ${this.panelIndices++}`, vscode.ViewColumn.Active, options);
        } else {
            panel.webview.options = options;
        }

        // Set HTML content
        await this.getWebviewContent(panel);

        // Sets up an event listener to listen for messages passed from the webview view context
        // and executes code based on the message that is received
        this.setWebviewMessageListener(panel, initialMemory);
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

    protected setWebviewMessageListener(panel: vscode.WebviewPanel, options?: MemoryOptions): void {
        const participant = this.messenger.registerWebviewPanel(panel);
        const disposables = [
            this.messenger.onNotification(readyType, () => this.initialize(participant, panel, options), { sender: participant }),
            this.messenger.onRequest(setOptionsType, newOptions => { options = { ...options, ...newOptions }; }, { sender: participant }),
            this.messenger.onRequest(logMessageType, message => outputChannelLogger.info('[webview]:', message), { sender: participant }),
            this.messenger.onRequest(readMemoryType, request => this.readMemory(request), { sender: participant }),
            this.messenger.onRequest(writeMemoryType, request => this.writeMemory(request), { sender: participant }),
            this.messenger.onRequest(getVariablesType, request => this.getVariables(request), { sender: participant }),
            this.messenger.onNotification(resetMemoryViewSettingsType, () => this.setInitialSettings(participant, panel.title), { sender: participant }),
            this.messenger.onNotification(setTitleType, title => { panel.title = title; }, { sender: participant }),
            this.messenger.onRequest(storeMemoryType, args => this.storeMemory(args), { sender: participant }),
            this.messenger.onRequest(applyMemoryType, () => this.applyMemory(), { sender: participant }),
            this.breakpointTracker.onBreakpointChanged(breakpoints => this.messenger.sendNotification(setTrackedBreakpointType, participant, breakpoints)),
            this.breakpointTracker.onStopped(event => this.messenger.sendNotification(notifyStoppedType, participant, event.data)),
            this.breakpointTracker.onContinued(event => this.messenger.sendNotification(notifyContinuedType, participant, event.data)),
            this.sessionTracker.onSessionEvent(event => this.handleSessionEvent(participant, event)),
            panel.onDidChangeViewState(view => {
                if (view.webviewPanel.visible) {
                    this.setBreakpoints(participant);
                }
            }),
        ];
        panel.onDidDispose(() => disposables.forEach(disposable => disposable.dispose()));
    }

    protected async initialize(participant: WebviewIdMessageParticipant, panel: vscode.WebviewPanel, options?: MemoryOptions): Promise<void> {
        this.setSessionContext(participant, this.createContext());
        this.setInitialSettings(participant, panel.title);
        this.setBreakpoints(participant);
        this.refresh(participant, options);
    }

    protected async refresh(participant: WebviewIdMessageParticipant, options: MemoryOptions = {}): Promise<void> {
        this.messenger.sendRequest(setOptionsType, participant, options);
    }

    protected setInitialSettings(webviewParticipant: WebviewIdMessageParticipant, title: string): void {
        this.setMemoryViewSettings(webviewParticipant, this.getMemoryViewSettings(webviewParticipant, title));
    }

    protected setMemoryViewSettings(webviewParticipant: WebviewIdMessageParticipant, settings: Partial<MemoryViewSettings>): void {
        this.messenger.sendNotification(setMemoryViewSettingsType, webviewParticipant, settings);
    }

    protected setSessionContext(webviewParticipant: WebviewIdMessageParticipant, context: SessionContext): void {
        this.messenger.sendNotification(sessionContextChangedType, webviewParticipant, context);
    }

    protected setBreakpoints(webviewParticipant: WebviewIdMessageParticipant): void {
        this.messenger.sendNotification(setTrackedBreakpointType, webviewParticipant, this.breakpointTracker.dataBreakpoints);
        if (this.breakpointTracker.stoppedEvent) {
            this.messenger.sendNotification(notifyStoppedType, webviewParticipant, this.breakpointTracker.stoppedEvent.data);
        }
    }

    protected getMemoryViewSettings(messageParticipant: WebviewIdMessageParticipant, title: string): MemoryViewSettings {
        const memoryInspectorConfiguration = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME);
        const bytesPerMau = memoryInspectorConfiguration.get<number>(manifest.CONFIG_BYTES_PER_MAU, manifest.DEFAULT_BYTES_PER_MAU);
        const mausPerGroup = memoryInspectorConfiguration.get<number>(manifest.CONFIG_MAUS_PER_GROUP, manifest.DEFAULT_MAUS_PER_GROUP);
        const groupsPerRow = memoryInspectorConfiguration.get<manifest.GroupsPerRowOption>(manifest.CONFIG_GROUPS_PER_ROW, manifest.DEFAULT_GROUPS_PER_ROW);
        const endianness = memoryInspectorConfiguration.get<manifest.Endianness>(manifest.CONFIG_ENDIANNESS, manifest.DEFAULT_ENDIANNESS);
        const scrollingBehavior = memoryInspectorConfiguration.get<ScrollingBehavior>(manifest.CONFIG_SCROLLING_BEHAVIOR, manifest.DEFAULT_SCROLLING_BEHAVIOR);
        const visibleColumns = CONFIGURABLE_COLUMNS
            .filter(column => vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<boolean>(column, false))
            .map(columnId => columnId.replace('columns.', ''));
        const addressPadding = memoryInspectorConfiguration.get(manifest.CONFIG_ADDRESS_PADDING, manifest.DEFAULT_ADDRESS_PADDING);
        const addressRadix = memoryInspectorConfiguration.get<number>(manifest.CONFIG_ADDRESS_RADIX, manifest.DEFAULT_ADDRESS_RADIX);
        const showRadixPrefix = memoryInspectorConfiguration.get<boolean>(manifest.CONFIG_SHOW_RADIX_PREFIX, manifest.DEFAULT_SHOW_RADIX_PREFIX);
        const refreshOnStop = memoryInspectorConfiguration.get<manifest.RefreshOnStop>(manifest.CONFIG_REFRESH_ON_STOP, manifest.DEFAULT_REFRESH_ON_STOP);
        const periodicRefresh = memoryInspectorConfiguration.get<manifest.PeriodicRefresh>(manifest.CONFIG_PERIODIC_REFRESH, manifest.DEFAULT_PERIODIC_REFRESH);
        const periodicRefreshInterval = memoryInspectorConfiguration.get<number>(manifest.CONFIG_PERIODIC_REFRESH_INTERVAL, manifest.DEFAULT_PERIODIC_REFRESH_INTERVAL);
        return {
            messageParticipant, title, bytesPerMau, mausPerGroup, groupsPerRow,
            endianness, scrollingBehavior, visibleColumns, addressPadding, addressRadix, showRadixPrefix,
            refreshOnStop, periodicRefresh, periodicRefreshInterval
        };
    }

    protected handleSessionEvent(participant: WebviewIdMessageParticipant, event: SessionEvent): void {
        if (isSessionEvent('active', event)) {
            this.setSessionContext(participant, this.createContext(event.session?.raw));
            return;
        }
        // we are only interested in the events of the active session
        if (!event.session?.active) {
            return;
        }
        if (isSessionEvent('memory-written', event)) {
            this.messenger.sendNotification(memoryWrittenType, participant, event.data);
        } else {
            this.setSessionContext(participant, this.createContext(event.session.raw));
        }
    }

    protected createContext(session = this.sessionTracker.activeSession): SessionContext {
        const sessionId = session?.id;
        return {
            sessionId,
            canRead: !!this.sessionTracker.hasDebugCapability(session, 'supportsReadMemoryRequest'),
            canWrite: !!this.sessionTracker.hasDebugCapability(session, 'supportsWriteMemoryRequest'),
            stopped: this.sessionTracker.isStopped(session)
        };
    }

    protected async readMemory(request: ReadMemoryArguments): Promise<ReadMemoryResult> {
        try {
            return await this.memoryProvider.readMemory(request);
        } catch (err) {
            this.logError('Error fetching memory', err);
        }
    }

    protected async writeMemory(request: WriteMemoryArguments): Promise<WriteMemoryResult> {
        try {
            return await this.memoryProvider.writeMemory(request);
        } catch (err) {
            this.logError('Error writing memory', err);
        }
    }

    protected async getVariables(request: ReadMemoryArguments): Promise<VariableRange[]> {
        try {
            return await this.memoryProvider.getVariables(request);
        } catch (err) {
            this.logError('Error fetching variables', err);
            return [];
        }
    }

    protected async setDataBreakpoint(request: SetDataBreakpointsArguments): Promise<SetDataBreakpointsResult> {
        try {
            const result = await this.breakpointProvider.setMemoryInspectorDataBreakpoint(request);
            return result;
        } catch (err) {
            return {
                breakpoints: []
            };
        }
    }

    protected async onSetDataBreakpointCommand(ctx: WebviewContext, accessType: DebugProtocol.DataBreakpointAccessType): Promise<SetDataBreakpointsResult | undefined> {
        let dataId: string | undefined = undefined;
        if (isWebviewGroupContext(ctx)) {
            dataId = ctx.memoryData.group.startAddress;
        } else if (isWebviewVariableContext(ctx)) {
            const info = await this.breakpointProvider.dataBreakpointInfo({
                name: ctx.variable.name,
                variablesReference: ctx.variable.parentVariablesReference
            });
            if (!info.dataId) {
                throw new Error(`DataBreakpointInfo returned for variable ${ctx.variable} an invalid info.`);
            }
            dataId = info.dataId;
        } else {
            throw new Error(`WebviewContext needs to be a Group or Variable context. It was: ${JSON.stringify(ctx, undefined, 2)}`);
        }

        // Don't remove already existing breakpoints
        const breakpoints = this.breakpointTracker.internalDataBreakpoints.map(bp => bp.breakpoint);

        return this.setDataBreakpoint({
            breakpoints: [
                ...breakpoints,
                {
                    dataId,
                    accessType,
                }
            ]
        });
    }

    protected async onRemoveDataBreakpointCommand(ctx: WebviewContext, removeAll: boolean = false): Promise<SetDataBreakpointsResult | undefined> {
        if (removeAll) {
            return this.setDataBreakpoint({ breakpoints: [] });
        }

        let dataId: string | undefined = undefined;
        if (isWebviewGroupContext(ctx)) {
            dataId = ctx.memoryData.group.startAddress;
        } else if (isWebviewVariableContext(ctx)) {
            dataId = ctx.variable.name;
        } else {
            throw new Error(`WebviewContext needs to be a Group or Variable context. It was: ${JSON.stringify(ctx, undefined, 2)}`);
        }

        const breakpoints = this.breakpointTracker.internalDataBreakpoints
            .filter(bp => bp.breakpoint.dataId !== dataId)
            .map(bp => bp.breakpoint);

        return this.setDataBreakpoint({
            breakpoints
        });
    }

    protected getWebviewSelection(webviewParticipant: WebviewIdMessageParticipant): Promise<WebviewSelection> {
        return this.messenger.sendRequest(getWebviewSelectionType, webviewParticipant, undefined);
    }

    protected toggleWebviewColumn(ctx: WebviewContext, column: string): void {
        const visibleColumns = getVisibleColumns(ctx);
        const index = visibleColumns.indexOf(column);
        if (index === -1) {
            visibleColumns.push(column);
        } else {
            visibleColumns.splice(index, 1);
        }

        this.setMemoryViewSettings(ctx.messageParticipant, { visibleColumns });
    }

    protected async storeMemory(storeArguments: StoreMemoryArguments): Promise<void> {
        // Even if we disable the command in VS Code through enablement or when condition, programmatic execution is still possible.
        // However, we want to fail early in case the user tries to execute a disabled command
        this.sessionTracker.assertDebugCapability(this.sessionTracker.activeSession, 'supportsReadMemoryRequest', 'store memory');
        return vscode.commands.executeCommand(StoreCommandType, storeArguments);
    }

    protected async applyMemory(): Promise<MemoryOptions> {
        // Even if we disable the command in VS Code through enablement or when condition, programmatic execution is still possible.
        // However, we want to fail early in case the user tries to execute a disabled command
        this.sessionTracker.assertDebugCapability(this.sessionTracker.activeSession, 'supportsWriteMemoryRequest', 'apply memory');
        return vscode.commands.executeCommand(ApplyCommandType);
    }

    protected logError(msg: string, err: unknown): void {
        outputChannelLogger.error(msg, err instanceof Error ? `: ${err.message}\n${err.stack}` : '');
    }
}
