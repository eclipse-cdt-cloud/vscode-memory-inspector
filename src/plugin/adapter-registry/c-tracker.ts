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

import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { sendRequest } from '../../common/debug-requests';
import { toHexStringWithRadixMarker, VariableRange } from '../../common/memory-range';
import { AdapterVariableTracker, decimalAddress, extractAddress, hexAddress, notADigit, WithChildren } from './adapter-capabilities';

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
    protected override async variableToVariableRange(
        variable: DebugProtocol.Variable,
        session: vscode.DebugSession,
        parent: WithChildren<DebugProtocol.Scope | DebugProtocol.Variable>): Promise<VariableRange | undefined> {
        if (this.currentFrame === undefined || !variable.name) {
            this.logger.debug('Unable to resolve', variable.name,
                { noName: !variable.name, noFrame: this.currentFrame === undefined });
            return undefined;
        }
        let variableAddress = extractAddress(variable.memoryReference);
        let variableSize: bigint | undefined = undefined;
        try {
            const evaluateName = variable.evaluateName ?? variable.name;
            [variableAddress, variableSize] = await Promise.all([
                variableAddress ?? this.getAddressOfVariable(evaluateName, session),
                this.getSizeOfVariable(evaluateName, session),
            ]);
        } catch (err) {
            this.logger.warn('Unable to resolve location and size of', variable.name + (err instanceof Error ? ':\n\t' + err.message : ''));
            // fall through as we may still have a valid variable address that we can use
        }
        if (!variableAddress) {
            return undefined;
        }
        this.logger.debug('Resolved', variable.name, { start: variableAddress, size: variableSize });
        const address = BigInt(variableAddress);
        const startAddress = toHexStringWithRadixMarker(address);
        const isPointer = this.isMaybePointer(variable, startAddress);
        const variableRange: VariableRange = {
            name: variable.name,
            startAddress,
            endAddress: variableSize === undefined ? undefined : toHexStringWithRadixMarker(address + variableSize),
            value: variable.value,
            type: variable.type,
            parentVariablesReference: parent.variablesReference,
            isPointer,
        };
        return variableRange;
    }

    async getAddressOfVariable(variableName: string, session: vscode.DebugSession): Promise<string | undefined> {
        const response = await sendRequest(session, 'evaluate', { expression: CEvaluateExpression.addressOf(variableName), context: 'watch', frameId: this.currentFrame });
        return extractAddress(response.result);
    }

    async getSizeOfVariable(variableName: string, session: vscode.DebugSession): Promise<bigint | undefined> {
        const response = await sendRequest(session, 'evaluate', { expression: CEvaluateExpression.sizeOf(variableName), context: 'watch', frameId: this.currentFrame });
        return notADigit.test(response.result) ? undefined : BigInt(response.result);
    }

    protected isMaybePointer({ value, type }: DebugProtocol.Variable, startAddress: string): boolean {
        if (type?.endsWith('*')) { return true; } // Definitely a pointer

        // Might reasonably get cast as a pointer
        return (value !== startAddress) && (hexAddress.test(value) || decimalAddress.test(value));
    }
}
