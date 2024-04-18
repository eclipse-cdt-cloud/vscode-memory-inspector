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
import { AutoRefresh, Endianness, GroupsPerRowOption } from './manifest';
import { Radix } from './memory-range';

/** The memory display configuration that can be specified for the memory widget. */
export interface MemoryDisplayConfiguration {
    bytesPerMau: number;
    mausPerGroup: number;
    groupsPerRow: GroupsPerRowOption;
    endianness: Endianness;
    scrollingBehavior: ScrollingBehavior;
    addressPadding: AddressPadding;
    addressRadix: Radix;
    showRadixPrefix: boolean;
    autoRefresh: AutoRefresh;
    autoRefreshDelay: number;
}

export type ScrollingBehavior = 'Paginate' | 'Grow' | 'Auto-Append';

export type AddressPadding = 'Minimal' | number;

export interface ColumnVisibilityStatus {
    visibleColumns: string[];
}

/** All settings related to memory view that can be specified for the webview from the extension "main". */
export interface MemoryViewSettings extends ColumnVisibilityStatus, MemoryDisplayConfiguration {
    title: string
    messageParticipant: WebviewIdMessageParticipant;
}
