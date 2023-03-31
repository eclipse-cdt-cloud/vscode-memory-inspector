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

/** Suitable for transmission as JSON */
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

/** Suitable for arithemetic */
export interface LongMemoryRange {
    startAddress: bigint;
    endAddress: bigint;
}

export function isWithin(candidate: bigint, container: LongMemoryRange): boolean {
    return container.startAddress <= candidate && container.endAddress > candidate;
}

export function doOverlap(one: LongMemoryRange, other: LongMemoryRange): boolean {
    // If they overlap, they either start in the same place, or one starts in the other.
    return isWithin(one.startAddress, other) || isWithin(other.startAddress, one);
}

export function areRangesEqual(one: LongMemoryRange, other: LongMemoryRange): boolean {
    return one.startAddress === other.startAddress && one.endAddress === other.endAddress;
}

export function compareBigInt(left: bigint, right: bigint): number {
    const difference = left - right;
    return difference === BigInt(0) ? 0 : difference > 0 ? 1 : -1;
}

export enum RangeRelationship {
    Before,
    Within,
    Past,
    None,
}

export function determineRelationship(candidate: bigint, range?: LongMemoryRange): RangeRelationship {
    if (range === undefined) { return RangeRelationship.None; }
    if (candidate < range.startAddress) { return RangeRelationship.Before; }
    if (candidate >= range.endAddress) { return RangeRelationship.Past; }
    return RangeRelationship.Within;
}

export function toHexStringWithRadixMarker(target: bigint): string {
    return `0x${target.toString(16)}`;
}

export interface VariableMetadata {
    name: string;
    type?: string;
    /** If applicable, a string representation of the variable's value */
    value?: string;
}

/** Suitable for transmission as JSON */
export interface VariableRange extends MemoryRange, VariableMetadata { }
/** Suitable for arithemetic */
export interface LongVariableRange extends LongMemoryRange, VariableMetadata { }

export function areVariablesEqual(one: LongVariableRange, other: LongVariableRange): boolean {
    return areRangesEqual(one, other)
        && one.name === other.name
        && one.type === other.type
        && one.value === other.value;
}
