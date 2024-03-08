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
import { DebugProtocol } from '@vscode/debugprotocol';
import { AdapterVariableTracker, hexAddress, notADigit } from './adapter-capabilities';
import { toHexStringWithRadixMarker, VariableRange } from '../../common/memory-range';
import { sendRequest } from '../../common/debug-requests';

export namespace CEvaluateExpression {
    export function sizeOf(expression: string): string {
        return `sizeof(${expression})`;
    }
    export function addressOf(expression: string): string {
        return `&(${expression})`;
    }
};

export class CTracker extends AdapterVariableTracker {

    /**
     * Resolves memory location and size using evaluate requests for `$(variable.name)` and `sizeof(variable.name)`
     * Ignores the presence or absence of variable.memoryReference.
     */
    protected override async variableToVariableRange(variable: DebugProtocol.Variable, session: vscode.DebugSession): Promise<VariableRange | undefined> {
        if (this.currentFrame === undefined || !variable.name) {
            this.logger.debug('Unable to resolve', variable.name,
                { noName: !variable.name, noFrame: this.currentFrame === undefined });
            return undefined;
        }
        try {
            const variableAddress = await this.getAddressOfVariable(variable.name, session);
            if (!variableAddress) { return undefined; }
            const variableSize = await this.getSizeOfVariable(variable.name, session);
            if (!variableSize) { return undefined; }

            const startAddress = BigInt(variableAddress);
            const endAddress = BigInt(variableAddress) + variableSize;
            this.logger.debug('Resolved', variable.name, { start: variableAddress, size: variableSize });
            return {
                name: variable.name,
                startAddress: toHexStringWithRadixMarker(startAddress),
                endAddress: endAddress === undefined ? undefined : toHexStringWithRadixMarker(endAddress),
                value: variable.value,
                type: variable.type,
            };
        } catch (err) {
            this.logger.warn('Unable to resolve location and size of', variable.name + (err instanceof Error ? ':\n\t' + err.message : ''));
            return undefined;
        }
    }

    async getAddressOfVariable(variableName: string, session: vscode.DebugSession): Promise<string | undefined> {
        const response = await sendRequest(session, 'evaluate', { expression: CEvaluateExpression.addressOf(variableName), context: 'watch', frameId: this.currentFrame });
        const addressPart = hexAddress.exec(response.result);
        return addressPart ? addressPart[0] : undefined;
    }

    async getSizeOfVariable(variableName: string, session: vscode.DebugSession): Promise<bigint | undefined> {
        const response = await sendRequest(session, 'evaluate', { expression: CEvaluateExpression.sizeOf(variableName), context: 'watch', frameId: this.currentFrame });
        return notADigit.test(response.result) ? undefined : BigInt(response.result);
    }
}
