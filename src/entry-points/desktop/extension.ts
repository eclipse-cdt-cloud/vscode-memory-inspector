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
import { CAdapter } from '../../plugin/adapter-registry/c-adapter';
import { BreakpointProvider } from '../../plugin/breakpoints/breakpoint-provider';
import { BreakpointTracker } from '../../plugin/breakpoints/breakpoint-tracker';
import { ContextTracker } from '../../plugin/context-tracker';
import { MemoryProvider } from '../../plugin/memory-provider';
import { MemoryStorage } from '../../plugin/memory-storage';
import { MemoryWebview } from '../../plugin/memory-webview-main';
import { SessionTracker } from '../../plugin/session-tracker';

export const activate = async (context: vscode.ExtensionContext): Promise<AdapterRegistry> => {
    const registry = new AdapterRegistry();
    const sessionTracker = new SessionTracker();
    new ContextTracker(sessionTracker);
    const breakpointTracker = new BreakpointTracker(sessionTracker);
    const breakpointProvider = new BreakpointProvider(sessionTracker, breakpointTracker);
    const memoryProvider = new MemoryProvider(registry, sessionTracker);
    const memoryView = new MemoryWebview(context.extensionUri, memoryProvider, sessionTracker, breakpointTracker, breakpointProvider);
    const memoryStorage = new MemoryStorage(memoryProvider);
    const cAdapter = new CAdapter(registry);

    registry.activate(context);
    sessionTracker.activate(context);
    memoryProvider.activate(context);
    memoryView.activate(context);
    memoryStorage.activate(context);
    cAdapter.activate(context);

    return registry;
};

export const deactivate = async (): Promise<void> => {
    // Do nothing for now
};
