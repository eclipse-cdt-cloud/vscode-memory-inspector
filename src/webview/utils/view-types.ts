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
import deepequal from 'fast-deep-equal';
import type * as React from 'react';
import { areRangesEqual, BigIntMemoryRange, Radix } from '../../common/memory-range';

export enum Endianness {
    Little = 'Little Endian',
    Big = 'Big Endian'
}

export interface Memory {
    address: bigint;
    bytes: Uint8Array;
}

export interface SerializedTableRenderOptions extends MemoryDisplayConfiguration {
    columnOptions: Array<{ label: string, doRender: boolean }>;
    endianness: Endianness;
    wordSize: number;
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
    isMemoryFetching: boolean;
}

export interface UpdateExecutor {
    fetchData(currentViewParameters: DebugProtocol.ReadMemoryArguments): Promise<void>;
}

export interface StylableNodeAttributes {
    className?: string;
    style?: React.CSSProperties;
    title?: string;
}

export interface FullNodeAttributes extends StylableNodeAttributes {
    content: string;
}

/** All settings related to memory view that can be specified for the webview from the extension "main". */
export interface MemoryViewSettings extends ColumnVisibilityStatus, MemoryDisplayConfiguration { }

/** The memory display configuration that can be specified for the memory widget. */
export interface MemoryDisplayConfiguration {
    wordsPerGroup: number;
    groupsPerRow: number;
    scrollingBehavior: ScrollingBehavior;
    addressRadix: Radix;
    showRadixPrefix: boolean;
}
export type ScrollingBehavior = 'Paginate' | 'Infinite';

export interface ColumnVisibilityStatus {
    visibleColumns: string[];
}

export type ReactInteraction<E extends Element = Element> = React.MouseEvent<E> | React.KeyboardEvent<E>;

export function isTrigger(event: ReactInteraction): boolean {
    return !('code' in event) || event.code === 'Enter' || event.code === 'Space';
}
