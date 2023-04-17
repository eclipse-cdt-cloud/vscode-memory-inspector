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
import { GdbCapabilities } from '../../plugin/adapter-registry/gdb-capabilities';
import { MemoryProvider } from '../../plugin/memory-provider';
import { MemoryWebview } from '../../plugin/memory-webview-main';

export const activate = async (context: vscode.ExtensionContext): Promise<AdapterRegistry> => {
    const memoryProvider = new MemoryProvider();
    const memoryView = new MemoryWebview(context.extensionUri, memoryProvider);
    const registry = new AdapterRegistry();
    registry.activate(context);
    memoryProvider.activate(context, registry);
    memoryView.activate(context);
    context.subscriptions.push(registry.registerAdapter('gdb', new GdbCapabilities));
    return registry;
};

export const deactivate = async (): Promise<void> => {
    // Do nothing for now
};
