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

import type { DebugProtocol } from '@vscode/debugprotocol';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import type { LongVariableRange } from '../../plugin/adapter-registry/adapter-capabilities';
import { getVariables } from '../../common/messaging';
import { messenger } from '../view-messenger';
import { Decoration } from '../utils/view-types';
import { EventEmitter, IEvent } from '../utils/events';
import Long from 'long';
import { ColumnContribution } from '../columns/column-contribution-service';
import { Decorator } from '../decorations/decoration-service';

const NON_HC_COLORS = [
    'var(--vscode-terminal-ansiBlue)',
    'var(--vscode-terminal-ansiGreen)',
    'var(--vscode-terminal-ansiRed)',
    'var(--vscode-terminal-ansiYellow)',
    'var(--vscode-terminal-ansiMagenta)',
] as const;

export class VariableDecorator implements ColumnContribution, Decorator {
    private onDidChangeEmitter = new EventEmitter<Decoration[]>();
    /** We expect this to always be sorted from lowest to highest start address */
    private currentVariables?: LongVariableRange[];

    get onDidChange(): IEvent<Decoration[]> { return this.onDidChangeEmitter.event.bind(this.onDidChangeEmitter); }

    async fetchData(currentViewParameters: DebugProtocol.ReadMemoryArguments): Promise<void> {
        const visibleVariables = (await messenger.sendRequest(getVariables, HOST_EXTENSION, currentViewParameters))
            .map<LongVariableRange>(transmissible => ({
                ...transmissible,
                startAddress: Long.fromString(transmissible.startAddress),
                endAddress: transmissible.endAddress ? Long.fromString(transmissible.endAddress) : undefined
            }));
        visibleVariables.sort((left, right) => left.startAddress.compare(right.startAddress));
        if (this.didVariableChange(visibleVariables)) {
            this.currentVariables = visibleVariables;
            this.onDidChangeEmitter.fire(this.toDecorations());
        }
    }

    private didVariableChange(visibleVariables: LongVariableRange[]): boolean {
        return visibleVariables.length !== this.currentVariables?.length
            || visibleVariables.some((item, index) => !this.areEqual(item, this.currentVariables![index]));
    }

    private areEqual(one: LongVariableRange, other: LongVariableRange): boolean {
        return one.startAddress.equals(other.startAddress)
            && one.name === other.name
            && one.type === other.type
            && one.value === other.value
            && this.compareUndefinedOrLong(one.endAddress, other.endAddress);
    }

    private compareUndefinedOrLong(one: Long | undefined, other: Long | undefined): boolean {
        return one === other || (one !== undefined && other !== undefined && one?.equals(other));
    }

    private toDecorations(): Decoration[] {
        const decorations: Decoration[] = [];
        let colorIndex = 0;
        for (const variable of this.currentVariables ?? []) {
            if (variable.endAddress) {
                decorations.push({
                    range: {
                        startAddress: variable.startAddress,
                        endAddress: variable.endAddress
                    },
                    style: { color: NON_HC_COLORS[colorIndex++] }
                });
            }
        }
        return decorations;
    }

    dispose(): void {
        this.onDidChangeEmitter.dispose();
    }
}

