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

import { ReadMemoryArguments, ReadMemoryResult } from './messaging';

export interface Memory {
    address: bigint;
    bytes: Uint8Array;
}

export function createMemoryFromRead(result: ReadMemoryResult, request?: ReadMemoryArguments): Memory {
    if (!result?.data) {
        const message = request ? `No memory provided for address ${request.memoryReference}`
            + `, offset ${request.offset} and count ${request.count}!` : 'No memory provided.';
        throw new Error(message);
    }
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
    return !isNaN(asNumber) && asNumber < 0 ? 'Value must be >= 0' : undefined;
}

export function validateOffset(offset: string): string | undefined {
    const asNumber = Number(offset);
    return isNaN(asNumber) ? 'Must be number' : undefined;
}

export function validateCount(count: string): string | undefined {
    const asNumber = Number(count);
    if (isNaN(asNumber)) {
        return 'Must be number';
    } else if (asNumber <= 0) {
        return 'Value must be > 0';
    }
}
