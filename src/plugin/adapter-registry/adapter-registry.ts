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
import { AdapterCapabilities } from './adapter-capabilities';

export class AdapterRegistry implements vscode.Disposable {
    protected handlers = new Map<string, AdapterCapabilities>();
    protected isDisposed = false;
    registerAdapter(debugType: string, handlerToRegister: AdapterCapabilities): vscode.Disposable {
        if (this.isDisposed) { return new vscode.Disposable(() => { }); }
        this.handlers.set(debugType, handlerToRegister);
        return new vscode.Disposable(() => {
            const currentlyRegisteredHandler = this.handlers.get(debugType);
            if (currentlyRegisteredHandler === handlerToRegister) {
                this.handlers.delete(debugType);
            }
        });
    };

    getHandlerForSession(session: vscode.DebugSession): AdapterCapabilities | undefined {
        return this.handlers.get(session.type);
    }

    dispose(): void {
        this.isDisposed = true;
        this.handlers.clear();
    }
}
