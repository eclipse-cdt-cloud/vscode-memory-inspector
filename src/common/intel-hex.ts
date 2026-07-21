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

import { URI, Utils } from 'vscode-uri';

const DATA_RECORD = 0x00;
const END_OF_FILE_RECORD = 0x01;
const EXTENDED_SEGMENT_ADDRESS_RECORD = 0x02;
const START_SEGMENT_ADDRESS_RECORD = 0x03;
const EXTENDED_LINEAR_ADDRESS_RECORD = 0x04;
const START_LINEAR_ADDRESS_RECORD = 0x05;

const MAX_INTEL_HEX_ADDRESS = 0xffff_ffffn;
const MAX_DATA_LENGTH = 0xff;
const DEFAULT_DATA_RECORD_LENGTH = 0x10;

interface MutableMemoryBlock {
    address: bigint;
    bytes: number[];
}

function encodeHexByte(value: number): string {
    return value.toString(16).toUpperCase().padStart(2, '0');
}

function parseHexByte(value: string, context: string): number {
    const parsed = Number.parseInt(value, 16);
    if (Number.isNaN(parsed)) {
        throw new Error(`Invalid ${context}: '${value}'`);
    }
    return parsed;
}

function createRecord(recordType: number, address: number, data: ArrayLike<number>): string {
    const bytes = [data.length, (address >> 8) & 0xff, address & 0xff, recordType, ...Array.from(data)];
    const checksum = (-bytes.reduce((sum, current) => sum + current, 0)) & 0xff;
    return `:${bytes.map(encodeHexByte).join('')}${encodeHexByte(checksum)}`;
}

function appendBytes(block: MutableMemoryBlock | undefined, address: bigint, data: number[]): MutableMemoryBlock {
    if (!block || block.address + BigInt(block.bytes.length) !== address) {
        return { address, bytes: [...data] };
    }

    block.bytes.push(...data);
    return block;
}

export namespace IntelHEX {
    export interface MemoryBlock {
        address: bigint;
        bytes: Uint8Array;
    }

    export namespace FileExtensions {
        export const All = [
            // General
            'hex', 'mcs', 'int', 'ihex', 'ihe', 'ihx',
            // Platform-specific
            'h80', 'h86', 'a43', 'a90',
            // Binary or Intel hex
            'obj', 'obl', 'obh', 'rom', 'eep'
        ];
        export const Default = 'hex';

        export function applyIfMissing(file: URI): URI {
            const extWithDot = Utils.extname(file);
            if (extWithDot.length === 0 || !IntelHEX.FileExtensions.All.includes(extWithDot.slice(1))) {
                return URI.file(file.fsPath + '.' + IntelHEX.FileExtensions.Default);
            }
            return file;
        };
    };
    export const DialogFilters = {
        'Intel HEX Files': IntelHEX.FileExtensions.All,
        'All Files': ['*']
    };

    export function encode(blocks: MemoryBlock | readonly MemoryBlock[]): string {
        const normalizedBlocks = Array.isArray(blocks) ? blocks : [blocks];
        const records: string[] = [];
        let currentUpperAddress: number | undefined;

        for (const block of normalizedBlocks) {
            if (block.address < 0n) {
                throw new Error('Intel HEX addresses must be non-negative');
            }
            if (block.address > MAX_INTEL_HEX_ADDRESS) {
                throw new Error(`Intel HEX addresses must fit in 32 bits: ${block.address}`);
            }
            if (block.bytes.length === 0) {
                continue;
            }

            const blockEnd = block.address + BigInt(block.bytes.length - 1);
            if (blockEnd > MAX_INTEL_HEX_ADDRESS) {
                throw new Error(`Intel HEX data exceeds 32-bit address space: ${blockEnd}`);
            }

            let offset = 0;
            while (offset < block.bytes.length) {
                const absoluteAddress = block.address + BigInt(offset);
                const upperAddress = Number((absoluteAddress >> 16n) & 0xffffn);
                if (currentUpperAddress !== upperAddress) {
                    records.push(createRecord(EXTENDED_LINEAR_ADDRESS_RECORD, 0, [upperAddress >> 8, upperAddress & 0xff]));
                    currentUpperAddress = upperAddress;
                }

                const lowerAddress = Number(absoluteAddress & 0xffffn);
                const remainingInSegment = 0x10000 - lowerAddress;
                const chunkLength = Math.min(DEFAULT_DATA_RECORD_LENGTH, remainingInSegment, block.bytes.length - offset, MAX_DATA_LENGTH);
                const chunk = block.bytes.slice(offset, offset + chunkLength);
                records.push(createRecord(DATA_RECORD, lowerAddress, chunk));
                offset += chunkLength;
            }
        }

        records.push(createRecord(END_OF_FILE_RECORD, 0, []));
        return `${records.join('\n')}\n`;
    }

    export function decode(content: string): MemoryBlock[] {
        const blocks: MutableMemoryBlock[] = [];
        let currentBlock: MutableMemoryBlock | undefined;
        let baseAddress = 0n;
        let sawEof = false;

        const lines = content.split(/\r?\n/);
        lines.forEach((rawLine, index) => {
            const line = rawLine.trim();
            if (line.length === 0) {
                return;
            }
            if (sawEof) {
                throw new Error(`Unexpected data after EOF record on line ${index + 1}`);
            }
            if (!line.startsWith(':')) {
                throw new Error(`Invalid Intel HEX record on line ${index + 1}: missing ':' prefix`);
            }
            if (line.length < 11 || (line.length - 1) % 2 !== 0) {
                throw new Error(`Invalid Intel HEX record length on line ${index + 1}`);
            }

            const bytes: number[] = [];
            for (let cursor = 1; cursor < line.length; cursor += 2) {
                bytes.push(parseHexByte(line.slice(cursor, cursor + 2), `hex byte on line ${index + 1}`));
            }

            const recordLength = bytes[0];
            const expectedLength = recordLength + 5;
            if (bytes.length !== expectedLength) {
                throw new Error(`Invalid Intel HEX byte count on line ${index + 1}`);
            }

            const checksum = bytes.reduce((sum, value) => sum + value, 0) & 0xff;
            if (checksum !== 0) {
                throw new Error(`Invalid Intel HEX checksum on line ${index + 1}`);
            }

            const recordAddress = (bytes[1] << 8) | bytes[2];
            const recordType = bytes[3];
            const data = bytes.slice(4, bytes.length - 1);

            switch (recordType) {
                case DATA_RECORD: {
                    const absoluteAddress = baseAddress + BigInt(recordAddress);
                    currentBlock = appendBytes(currentBlock, absoluteAddress, data);
                    if (!blocks.includes(currentBlock)) {
                        blocks.push(currentBlock);
                    }
                    break;
                }
                case END_OF_FILE_RECORD:
                    if (recordLength !== 0 || recordAddress !== 0) {
                        throw new Error(`Invalid EOF record on line ${index + 1}`);
                    }
                    sawEof = true;
                    break;
                case EXTENDED_SEGMENT_ADDRESS_RECORD:
                    if (recordLength !== 2 || recordAddress !== 0) {
                        throw new Error(`Invalid extended segment address record on line ${index + 1}`);
                    }
                    baseAddress = (BigInt((data[0] << 8) | data[1])) << 4n;
                    currentBlock = undefined;
                    break;
                case EXTENDED_LINEAR_ADDRESS_RECORD:
                    if (recordLength !== 2 || recordAddress !== 0) {
                        throw new Error(`Invalid extended linear address record on line ${index + 1}`);
                    }
                    baseAddress = (BigInt((data[0] << 8) | data[1])) << 16n;
                    currentBlock = undefined;
                    break;
                case START_SEGMENT_ADDRESS_RECORD:
                case START_LINEAR_ADDRESS_RECORD:
                    currentBlock = undefined;
                    break;
                default:
                    throw new Error(`Unsupported Intel HEX record type 0x${recordType.toString(16).toUpperCase().padStart(2, '0')} on line ${index + 1}`);
            }
        });

        if (!sawEof) {
            throw new Error('Invalid Intel HEX file: missing EOF record');
        }

        return blocks.map(block => ({ address: block.address, bytes: Uint8Array.from(block.bytes) }));
    }
};
