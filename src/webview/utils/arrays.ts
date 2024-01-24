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

// https://www.30secondsofcode.org/js/s/split-array-into-chunks/
export function chunkIntoN<T>(arr: T[], n: number): T[][] {
    const size = Math.ceil(arr.length / n);
    return Array.from({ length: n }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );
}

export function resize<T>(arr: T[], newSize: number, defaultValue?: T): T[] {
    return [...arr, ...Array(Math.max(newSize - arr.length, 0)).fill(defaultValue)];
}
