/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
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
import { WebviewIdMessageParticipant } from 'vscode-messenger-common';
import { Endianness, GroupsPerRowOption, PeriodicRefresh, RefreshOnStop } from './manifest';
import { Radix } from './memory-range';

/** Specifies the settings for displaying memory addresses in the memory data table. */
export interface MemoryAddressDisplaySettings {
    addressPadding: AddressPadding;
    addressRadix: Radix;
    showRadixPrefix: boolean;
}

export type AddressPadding = 'Min' | 0 | 32 | 64;

/** Specifies the settings for displaying memory data in the memory data table, including the memory addresses. */
export interface MemoryDataDisplaySettings extends MemoryAddressDisplaySettings {
    bytesPerMau: number;
    mausPerGroup: number;
    groupsPerRow: GroupsPerRowOption;
    endianness: Endianness;
    scrollingBehavior: ScrollingBehavior;
    refreshOnStop: RefreshOnStop;
    periodicRefresh: PeriodicRefresh;
    periodicRefreshInterval: number;
}

export type ScrollingBehavior = 'Paginate' | 'Grow' | 'Auto-Append';

/** Specifies the display settings of the memory data table, including the memory data and addresses. */
export interface MemoryDisplaySettings extends MemoryDataDisplaySettings {
    visibleColumns: string[];
}

/** An extender's contribution to the `MemoryDisplaySettings` via the `AdapterCapabilities`. */
export interface MemoryDisplaySettingsContribution {
    message?: string;
    settings?: Partial<MemoryDisplaySettings>;
}

/** All settings related to memory view that can be specified for the webview from the extension "main". */
export interface MemoryViewSettings extends MemoryDisplaySettings {
    title: string
    messageParticipant: WebviewIdMessageParticipant;
    hasDebuggerDefaults?: boolean;
    contributionMessage?: string;
}
