/********************************************************************************
 * Copyright (C) 2026 Renesas Electronics Corporation and others.
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

import { expect } from 'chai';
import 'mocha';

import { bytesToStringMemory, hexStringToBytes, stringToBytesMemory } from './memory';

describe('memory base64 and hex helpers', () => {
    // The extension host of the browser version has no Node.js `Buffer`. These helpers must not use it.
    let originalBuffer: unknown;
    beforeEach(() => {
        originalBuffer = (globalThis as { Buffer?: unknown }).Buffer;
        delete (globalThis as { Buffer?: unknown }).Buffer;
    });
    afterEach(() => {
        (globalThis as { Buffer?: unknown }).Buffer = originalBuffer;
    });

    describe('without a global Buffer', () => {
        it('has no Buffer to rely on', () => {
            expect(typeof (globalThis as { Buffer?: unknown }).Buffer).to.equal('undefined');
        });

        it('encodes bytes to base64', () => {
            expect(bytesToStringMemory(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]))).to.equal('3q2+7w==');
        });

        it('decodes base64 to bytes', () => {
            expect(Array.from(stringToBytesMemory('3q2+7w=='))).to.deep.equal([0xde, 0xad, 0xbe, 0xef]);
        });

        it('converts hexadecimal text to bytes', () => {
            expect(Array.from(hexStringToBytes('A8'))).to.deep.equal([0xa8]);
        });
    });

    describe('bytesToStringMemory and stringToBytesMemory', () => {
        it('handle empty data', () => {
            expect(bytesToStringMemory(new Uint8Array())).to.equal('');
            expect(stringToBytesMemory('').length).to.equal(0);
        });

        it('round-trip every byte value', () => {
            const all = Uint8Array.from({ length: 256 }, (_, i) => i);
            expect(Array.from(stringToBytesMemory(bytesToStringMemory(all)))).to.deep.equal(Array.from(all));
        });

        it('round-trip data larger than one conversion chunk', () => {
            const big = Uint8Array.from({ length: 0x8000 * 3 + 5 }, (_, i) => (i * 7) & 0xff);
            const encoded = bytesToStringMemory(big);
            const decoded = stringToBytesMemory(encoded);
            expect(decoded.length).to.equal(big.length);
            expect(decoded.every((byte, i) => byte === big[i])).to.equal(true);
        });

        it('produce the same base64 as Node.js Buffer, for every padding length', () => {
            // Buffer is restored for the comparison only
            const NodeBuffer = originalBuffer as typeof Buffer;
            for (const length of [0, 1, 2, 3, 4, 5, 255, 256, 1000]) {
                const bytes = Uint8Array.from({ length }, (_, i) => (i * 31 + 7) & 0xff);
                expect(bytesToStringMemory(bytes), `length ${length}`).to.equal(NodeBuffer.from(bytes).toString('base64'));
                expect(Array.from(stringToBytesMemory(NodeBuffer.from(bytes).toString('base64'))), `length ${length}`)
                    .to.deep.equal(Array.from(bytes));
            }
        });

        it('rejects text that is not base64', () => {
            expect(() => stringToBytesMemory('***')).to.throw();
        });
    });

    describe('hexStringToBytes', () => {
        it('converts upper and lower case digits', () => {
            expect(Array.from(hexStringToBytes('00ffA8b2'))).to.deep.equal([0x00, 0xff, 0xa8, 0xb2]);
        });

        it('returns no bytes for an empty string', () => {
            expect(hexStringToBytes('').length).to.equal(0);
        });

        it('ignores a trailing single digit, as Buffer does', () => {
            expect(Array.from(hexStringToBytes('a8f'))).to.deep.equal([0xa8]);
        });

        it('stops at the first invalid pair, as Buffer does', () => {
            expect(Array.from(hexStringToBytes('a8zz11'))).to.deep.equal([0xa8]);
        });

        it('matches Node.js Buffer.from(hex)', () => {
            const NodeBuffer = originalBuffer as typeof Buffer;
            for (const hex of ['', 'a', 'ab', 'abc', '00ff', 'DEADBEEF', 'a8zz11', 'xyz', '0g']) {
                expect(Array.from(hexStringToBytes(hex)), hex).to.deep.equal(Array.from(NodeBuffer.from(hex, 'hex')));
            }
        });
    });
});

describe('memory base64 helpers when Buffer is available', () => {
    // Old VS Code versions run on a Node.js that has Buffer but no atob and btoa (before Node.js 16).
    interface Globals { atob?: unknown, btoa?: unknown }
    let originalAtob: unknown;
    let originalBtoa: unknown;
    beforeEach(() => {
        originalAtob = (globalThis as Globals).atob;
        originalBtoa = (globalThis as Globals).btoa;
    });
    afterEach(() => {
        (globalThis as Globals).atob = originalAtob;
        (globalThis as Globals).btoa = originalBtoa;
    });

    it('works on a Node.js without atob and btoa', () => {
        delete (globalThis as Globals).atob;
        delete (globalThis as Globals).btoa;
        expect(typeof (globalThis as Globals).atob).to.equal('undefined');

        const bytes = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x01]);
        const encoded = bytesToStringMemory(bytes);
        expect(encoded).to.equal('3q2+7wE=');
        expect(Array.from(stringToBytesMemory(encoded))).to.deep.equal(Array.from(bytes));
    });

    it('uses Buffer when it exists', () => {
        const nativeFrom = Buffer.from;
        let calls = 0;
        (Buffer as { from: unknown }).from = (...args: unknown[]) => {
            calls++;
            return (nativeFrom as (...a: unknown[]) => Buffer).apply(Buffer, args);
        };
        try {
            bytesToStringMemory(Uint8Array.from([1, 2, 3]));
            stringToBytesMemory('AQID');
        } finally {
            (Buffer as { from: unknown }).from = nativeFrom;
        }
        expect(calls).to.equal(2);
    });
});
