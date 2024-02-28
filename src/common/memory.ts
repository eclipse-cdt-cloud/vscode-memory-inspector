/********************************************************************************
 * Copyright (C) 2024 EclipseSource.
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
import { ReadMemoryResult } from './messaging';

export interface Memory {
    address: bigint;
    bytes: Uint8Array;
}

export function createMemoryFromRead(result: ReadMemoryResult): Memory {
    if (!result?.data) { throw new Error('No memory provided!'); }
    const address = BigInt(result.address);
    const bytes = stringToBytesMemory(result.data);
    return { bytes, address };
}

export function stringToBytesMemory(data: string): Uint8Array {
    return Uint8Array.from(Buffer.from(data, 'base64'));
}

export function bytesToStringMemory(data: Uint8Array): string {
    return Buffer.from(data).toString('base64');
}

export function validateMemoryReference(reference: string): string | undefined {
    const asNumber = Number(reference);
    // we allow an address that is not a number, e.g., an expression, but if it is a number it must be >= 0
    return !isNaN(asNumber) && asNumber < 0 ? 'Value needs to be >= 0' : undefined;
}

export function validateOffset(offset: string): string | undefined {
    const asNumber = Number(offset);
    return isNaN(asNumber) ? 'No number provided' : undefined;
}

export function validateCount(count: string): string | undefined {
    const asNumber = Number(count);
    if (isNaN(asNumber)) {
        return 'No number provided';
    } else if (asNumber <= 0) {
        return 'Value needs to be > 0';
    }
}

export interface MemoryVariable extends DebugProtocol.Variable {
    memoryReference: string;
}

export const isMemoryVariable = (variable: unknown): variable is MemoryVariable => !!variable && !!(variable as MemoryVariable).memoryReference;

export interface MemoryVariableNode {
    variable: MemoryVariable;
    sessionId: string;
}

export const isMemoryVariableNode = (node: unknown): node is MemoryVariableNode =>
    !!node
    && isMemoryVariable((node as MemoryVariableNode).variable)
    && typeof (node as MemoryVariableNode).sessionId === 'string';
