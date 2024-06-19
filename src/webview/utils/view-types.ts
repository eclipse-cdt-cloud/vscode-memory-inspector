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

import deepequal from 'fast-deep-equal';
import type * as React from 'react';
import { Memory } from '../../common/memory';
import { areRangesEqual, BigIntMemoryRange } from '../../common/memory-range';
import { ReadMemoryArguments } from '../../common/messaging';
import { MemoryDataDisplaySettings } from '../../common/webview-configuration';

export interface SerializedTableRenderOptions extends MemoryDataDisplaySettings {
    columnOptions: Array<{ label: string, doRender: boolean }>;
    effectiveAddressLength: number;
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

export interface MemoryState {
    /**
     * The user configured memory read arguments
     */
    configuredReadArguments: Required<ReadMemoryArguments>;
    /**
     * The active memory read arguments used to load the memory
     */
    activeReadArguments: Required<ReadMemoryArguments>;
    memory?: Memory;
    isMemoryFetching: boolean;
}

export const DEFAULT_READ_ARGUMENTS: Required<ReadMemoryArguments> = {
    memoryReference: '',
    offset: 0,
    count: 256,
};

export interface UpdateExecutor {
    fetchData(currentViewParameters: ReadMemoryArguments): Promise<void>;
}

export interface StylableNodeAttributes {
    className?: string;
    style?: React.CSSProperties;
    title?: string;
}

export interface FullNodeAttributes extends StylableNodeAttributes {
    content: string;
}

export const AddressPaddingOptions = {
    'Minimal': 'Min',
    'Unpadded': 0,
    '32bit': 32,
    '64bit': 64,
} as const;

export type ReactInteraction<E extends Element = Element> = React.MouseEvent<E> | React.KeyboardEvent<E>;

export function isTrigger(event: ReactInteraction): boolean {
    return !('code' in event) || event.code === 'Enter' || event.code === 'Space';
}

