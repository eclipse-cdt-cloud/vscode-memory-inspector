/********************************************************************************
 * Copyright (C) 2023 Ericsson and others.
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
import * as manifest from '../../common/manifest';
import { outputChannelLogger } from '../logger';
import { VariableTracker } from './adapter-capabilities';
import { AdapterRegistry } from './adapter-registry';
import { CTracker } from './c-tracker';

export class CAdapter {
    protected disposable: vscode.Disposable | undefined;

    constructor(protected registry: AdapterRegistry) {
    }

    activate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.CONFIG_DEBUG_TYPES}`)) {
                    this.register(context);
                }
            })
        );

        this.register(context);
    }

    protected register(context: vscode.ExtensionContext): void {
        if (this.disposable) {
            this.disposable.dispose();
        }

        const debugTypes = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<string[]>(manifest.CONFIG_DEBUG_TYPES) || manifest.DEFAULT_DEBUG_TYPES;
        const tracker = new VariableTracker(CTracker, outputChannelLogger, ...debugTypes);

        const disposable = this.registry.registerAdapter(tracker, ...debugTypes);
        context.subscriptions.push(disposable);
        this.disposable = disposable;
    }
}
