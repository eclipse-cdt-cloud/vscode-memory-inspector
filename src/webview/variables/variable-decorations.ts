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
import { getVariables } from '../../common/messaging';
import { messenger } from '../view-messenger';
import { Decoration } from '../utils/view-types';
import { EventEmitter, IEvent } from '../utils/events';
import { ColumnContribution } from '../columns/column-contribution-service';
import { Decorator } from '../decorations/decoration-service';
import { ReactNode } from 'react';
import { areVariablesEqual, doOverlap, LongMemoryRange, LongVariableRange } from '../../common/memory-range';

const NON_HC_COLORS = [
    'var(--vscode-terminal-ansiBlue)',
    'var(--vscode-terminal-ansiGreen)',
    'var(--vscode-terminal-ansiRed)',
    'var(--vscode-terminal-ansiYellow)',
    'var(--vscode-terminal-ansiMagenta)',
] as const;

export class VariableDecorator implements ColumnContribution, Decorator {
    readonly id = 'variables';
    readonly label = 'Variables';
    private onDidChangeEmitter = new EventEmitter<Decoration[]>();
    /** We expect this to always be sorted from lowest to highest start address */
    private currentVariables?: LongVariableRange[];

    get onDidChange(): IEvent<Decoration[]> { return this.onDidChangeEmitter.event.bind(this.onDidChangeEmitter); }

    async fetchData(currentViewParameters: DebugProtocol.ReadMemoryArguments): Promise<void> {
        const visibleVariables = (await messenger.sendRequest(getVariables, HOST_EXTENSION, currentViewParameters))
            .map<LongVariableRange>(transmissible => ({
                ...transmissible,
                startAddress: BigInt(transmissible.startAddress),
                endAddress: transmissible.endAddress ? BigInt(transmissible.endAddress) : undefined
            }));
        visibleVariables.sort((left, right) => {
            const difference = left.startAddress - right.startAddress;
            return difference === BigInt(0) ? 0 : difference > 0 ? 1 : -1;
        });
        if (this.didVariableChange(visibleVariables)) {
            this.currentVariables = visibleVariables;
            this.onDidChangeEmitter.fire(this.toDecorations());
        }
    }

    render(range: LongMemoryRange): ReactNode {
        return this.currentVariables?.filter(candidate => doOverlap(candidate, range)).map(variables => variables.name).join(', ');
    }

    private didVariableChange(visibleVariables: LongVariableRange[]): boolean {
        return visibleVariables.length !== this.currentVariables?.length
            || visibleVariables.some((item, index) => !areVariablesEqual(item, this.currentVariables![index]));
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

