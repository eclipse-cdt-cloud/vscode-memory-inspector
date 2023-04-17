/********************************************************************************
 * Copyright (C) 2023 Ericsson, Arm and others.
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

import type { DebugProtocol } from '@vscode/debugprotocol';
import type * as React from 'react';
import { areRangesEqual, BigIntMemoryRange } from '../../common/memory-range';
import deepequal from 'fast-deep-equal';

export enum Endianness {
    Little = 'Little Endian',
    Big = 'Big Endian'
}

export interface Memory {
    address: bigint;
    bytes: Uint8Array;
}

export interface TableRenderOptions {
    columnOptions: Array<{ label: string, doRender: boolean }>;
    endianness: Endianness;
    bytesPerGroup: number;
    groupsPerRow: number;
    byteSize: number;
}

export interface Event<T> {
    (handler: (event: T) => unknown): Disposable;
}

export interface Disposable { dispose(): unknown };
export function dispose(disposable: { dispose(): unknown }): void {
    disposable.dispose();
}

export interface Decoration {
    range: BigIntMemoryRange;
    style: React.CSSProperties;
}

export function areDecorationsEqual(one: Decoration, other: Decoration): boolean {
    return areRangesEqual(one.range, other.range) && deepequal(one.style, other.style);
}

export interface MemoryState extends DebugProtocol.ReadMemoryArguments {
    memory?: Memory;
}

export interface UpdateExecutor {
    fetchData(currentViewParameters: DebugProtocol.ReadMemoryArguments): Promise<void>;
}
