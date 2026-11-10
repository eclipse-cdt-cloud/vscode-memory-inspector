/********************************************************************************
 * Copyright (C) 2024 EclipseSource.
 * Copyright (C) 2026 Arm and others.
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

/**
 * Number of bytes passed to one `String.fromCharCode` call when converting to base64 without `Buffer`.
 * Spreading a whole memory range into one call can exceed the engine's limit on the number of arguments
 * and throw a `RangeError`. 32 KiB stays well below the limits of current JavaScript engines.
 */
const BASE64_CHUNK_SIZE = 0x8000;

export interface Memory {
    address: bigint;
    bytes: Uint8Array;
}

/**
 * Returns whether two memory snapshots describe the same address and bytes.
 */
export function compareMemories(first: Memory | undefined, second: Memory | undefined): boolean {
    if (first === second) {
        return true;
    }
    if (!first || !second || first.address !== second.address || first.bytes.length !== second.bytes.length) {
        return false;
    }
    return first.bytes.every((byte, index) => byte === second.bytes[index]);
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

/*
 * The base64 helpers below use the Node.js global `Buffer` when it exists, and `atob`/`btoa` otherwise.
 *
 * `Buffer` does not exist in the browser extension host (web worker), for example in VS Code for the Web, and the
 * `webworker` bundle does not polyfill it. `atob` and `btoa` exist there and in webviews. `Buffer` stays the
 * first choice, so desktop behaves as before, including VS Code versions whose Node.js (older than 16) has no
 * global `atob`/`btoa`.
 *
 * Adding a `buffer` polyfill to the `webworker` target in `webpack.config.js` (`ProvidePlugin` and
 * `resolve.fallback`, as for the webview bundle) would also work, but adds to the bundle size. It remains an
 * alternative if this approach shows problems.
 */
export function stringToBytesMemory(data: string): Uint8Array {
    if (typeof Buffer !== 'undefined') {
        return Uint8Array.from(Buffer.from(data, 'base64'));
    }
    // Fallback for the browser extension host (for example VS Code for the Web), which has no `Buffer`
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function bytesToStringMemory(data: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(data).toString('base64');
    }
    // Fallback for the browser extension host (for example VS Code for the Web), which has no `Buffer`.
    // Convert in chunks of BASE64_CHUNK_SIZE bytes to stay within the argument limit of String.fromCharCode.
    let binary = '';
    for (let i = 0; i < data.length; i += BASE64_CHUNK_SIZE) {
        binary += String.fromCharCode(...data.subarray(i, i + BASE64_CHUNK_SIZE));
    }
    return btoa(binary);
}

/**
 * Converts a string of hexadecimal digits, two per byte, to bytes. Like the Node.js `Buffer.from(hex, 'hex')` it
 * replaces, it stops at the first pair that is not a hexadecimal byte and ignores a trailing single digit.
 */
export function hexStringToBytes(hex: string): Uint8Array {
    const bytes: number[] = [];
    for (let i = 0; i + 1 < hex.length; i += 2) {
        const pair = hex.substring(i, i + 2);
        if (!/^[0-9a-fA-F]{2}$/.test(pair)) {
            break;
        }
        bytes.push(parseInt(pair, 16));
    }
    return Uint8Array.from(bytes);
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
