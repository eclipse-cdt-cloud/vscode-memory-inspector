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

import { createProxyIdentifier, ProxyIdentifier } from '../rpc-protocol';

export interface MainService {
    $logMessage(message: string): void;
    $getMemory(address: string): Promise<string>;
}

export interface ViewService {
    $setState(state: string): void;
}

export const WEBVIEW_RPC_CONTEXT = {
    MAIN: createProxyIdentifier<MainService>('MainService') as ProxyIdentifier<MainService>,
    VIEW: createProxyIdentifier<ViewService>('ViewService') as ProxyIdentifier<ViewService>,
};
