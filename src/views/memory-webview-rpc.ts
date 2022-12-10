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

import Long from 'long';
import { createProxyIdentifier, ProxyIdentifier } from '../rpc-protocol';

export interface MemoryOptions {
    startAddress: number;
    locationOffset: number;
    readLength: number;
}

export interface MemoryReadRequest {
    memoryReference: string;
    count: number;
    offset?: number;
}

export interface MemoryReadResponse {
    address: Long;
    bytes: Uint8Array;
}

export interface MemoryWriteRequest {
    memoryReference: string;
    data: string;
    offset: number;
}

export interface MainService {
    $ready(): void;
    $logMessage(message: string): void;
    $readMemory(request: MemoryReadRequest): Promise<MemoryReadResponse>;
    $writeMemory(request: MemoryWriteRequest): Promise<number | undefined>;
}

export interface ViewService {
    $setOptions(options: MemoryOptions): void;
}

export const WEBVIEW_RPC_CONTEXT = {
    MAIN: createProxyIdentifier<MainService>('MainService') as ProxyIdentifier<MainService>,
    VIEW: createProxyIdentifier<ViewService>('ViewService') as ProxyIdentifier<ViewService>,
};
