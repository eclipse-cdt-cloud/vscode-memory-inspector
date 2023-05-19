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
import { AdapterRegistry } from '../../plugin/adapter-registry/adapter-registry';
import { MemoryProvider } from '../../plugin/memory-provider';
import { MemoryWebview } from '../../plugin/memory-webview-main';
import { CAdapter } from '../../plugin/adapter-registry/c-adapter';

export const activate = async (context: vscode.ExtensionContext): Promise<AdapterRegistry> => {
    const registry = new AdapterRegistry();
    const memoryProvider = new MemoryProvider(registry);
    const memoryView = new MemoryWebview(context.extensionUri, memoryProvider);
    const cAdapter = new CAdapter(registry);

    memoryProvider.activate(context);
    registry.activate(context);
    memoryView.activate(context);
    cAdapter.activate(context);

    return registry;
};

export const deactivate = async (): Promise<void> => {
    // Do nothing for now
};
