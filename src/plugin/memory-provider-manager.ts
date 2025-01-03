/********************************************************************************
 * Copyright (C) 2025 Ericsson, Arm and others.
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
import { AdapterRegistry } from './adapter-registry/adapter-registry';
import { MemoryProvider } from './memory-provider';
import { SessionTracker } from './session-tracker';

export class MemoryProviderManager {

    protected memoryProviders = new Map<vscode.DebugSession, MemoryProvider>();

    constructor(protected adapterRegistry: AdapterRegistry, protected sessionTracker: SessionTracker) {
    }

    public activate(context: vscode.ExtensionContext): void {
        const createDebugAdapterTracker = (session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> => {
            const handlerForSession = this.adapterRegistry.getHandlerForSession(session.type);
            const contributedTracker = handlerForSession?.initializeAdapterTracker?.(session);
            return contributedTracker;
        };
        context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('*', { createDebugAdapterTracker }));
    }

    public getProvider(sessionId: string | undefined): MemoryProvider {
        const session = this.sessionTracker.assertSession(sessionId);

        if (!this.memoryProviders.has(session)) {
            this.memoryProviders.set(session, new MemoryProvider(session.id, this.adapterRegistry, this.sessionTracker));
        }

        return this.memoryProviders.get(session)!;
    }
}
