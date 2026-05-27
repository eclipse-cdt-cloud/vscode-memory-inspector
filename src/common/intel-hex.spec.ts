/********************************************************************************
 * Copyright (C) 2026 EclipseSource.
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

import 'mocha';
import { expect } from 'chai';
import { IntelHEX } from './intel-hex';

describe('intel-hex', () => {
    it('round-trips memory above 0x80000000', () => {
        const block: IntelHEX.MemoryBlock = {
            address: 0x800B5DC0n,
            bytes: Uint8Array.from({ length: 20 }, (_, index) => index)
        };

        const encoded = IntelHEX.encode(block);
        const decoded = IntelHEX.decode(encoded);

        expect(decoded).to.have.length(1);
        expect(decoded[0].address).to.equal(block.address);
        expect(Array.from(decoded[0].bytes)).to.deep.equal(Array.from(block.bytes));
    });

    it('splits records when data crosses a 64 KiB boundary', () => {
        const block: IntelHEX.MemoryBlock = {
            address: 0x0000FFF8n,
            bytes: Uint8Array.from({ length: 32 }, (_, index) => index)
        };

        const encoded = IntelHEX.encode(block);
        const decoded = IntelHEX.decode(encoded);

        expect(decoded).to.have.length(2);
        expect(decoded[0].address).to.equal(0x0000FFF8n);
        expect(decoded[0].bytes).to.have.length(8);
        expect(decoded[1].address).to.equal(0x00010000n);
        expect(decoded[1].bytes).to.have.length(24);
    });

    it('rejects invalid checksums', () => {
        expect(() => IntelHEX.decode(':020000040001F8\n:00000001FF\n')).to.throw('Invalid Intel HEX checksum');
    });
});
