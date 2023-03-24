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

export interface MemoryRange {
    /** String representation of the address at which the range begins. May exceed maximum safe JS integer. */
    startAddress: string;
    /**
     * String representation of the address at which the range ends, exclusive. I.e. this should be the first address not included in the range.
     * May exceed maximum safe JS integer.
     *
     * If absent, the UI will indicate the first address at which the variable can be found but not its extent.
     */
    endAddress?: string;
}

export interface VariableRange extends MemoryRange {
    name: string;
    type?: string;
    /** If applicable, a string representation of the variable's value */
    value?: string;
}

/** Represents capabilities that may be achieved with particular debug adapters but are not part of the DAP */
export interface AdapterCapabilities {
    /** Resolve variables known to the adapter to their locations. Fallback if {@link getResidents} is not present */
    getVariables?(session: vscode.DebugSession): Promise<VariableRange[]>;
    /** Resolve symbols resident in the memory at the specified range. Will be preferred to {@link getVariables} if present. */
    getResidents?(session: vscode.DebugSession, range: MemoryRange): Promise<VariableRange[]>;
    initializeAdapterTracker?(session: vscode.DebugSession): vscode.DebugAdapterTracker | undefined;
}
