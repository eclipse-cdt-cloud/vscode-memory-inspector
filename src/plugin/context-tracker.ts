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
import * as manifest from '../common/manifest';
import { isSessionEvent, SessionEvent, SessionTracker } from './session-tracker';

export class ContextTracker {
    public static ReadKey = `${manifest.PACKAGE_NAME}.canRead`;
    public static WriteKey = `${manifest.PACKAGE_NAME}.canWrite`;

    constructor(protected sessionTracker: SessionTracker) {
        this.sessionTracker.onSessionEvent(event => this.onSessionEvent(event));

        this.onConfigurationChange();
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(manifest.CONFIG_EXPERIMENTAL_DATA_BREAKPOINTS_PREFERENCE)) {
                this.onConfigurationChange();
            }
        });
    }

    onSessionEvent(event: SessionEvent): void {
        if (isSessionEvent('active', event)) {
            vscode.commands.executeCommand('setContext', ContextTracker.ReadKey, !!event.session?.debugCapabilities?.supportsReadMemoryRequest);
            vscode.commands.executeCommand('setContext', ContextTracker.WriteKey, !!event.session?.debugCapabilities?.supportsWriteMemoryRequest);
        }
    }

    onConfigurationChange(): void {
        const configuration = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME);
        const value = configuration.get<boolean>(manifest.CONFIG_EXPERIMENTAL_DATA_BREAKPOINTS);
        vscode.commands.executeCommand('setContext', manifest.CONFIG_EXPERIMENTAL_DATA_BREAKPOINTS_PREFERENCE, value);
    }
}
