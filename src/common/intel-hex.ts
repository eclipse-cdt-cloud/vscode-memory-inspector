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

export namespace IntelHEX {
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
};
