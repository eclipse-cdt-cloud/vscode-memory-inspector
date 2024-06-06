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

import { classNames } from 'primereact/utils';
import { ReactNode } from 'react';
import * as React from 'react';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import { areVariablesEqual, BigIntMemoryRange, BigIntVariableRange, compareBigInt, doOverlap } from '../../common/memory-range';
import { getVariablesType, ReadMemoryArguments } from '../../common/messaging';
import { stringifyWithBigInts } from '../../common/typescript';
import { BreakpointService, breakpointService } from '../breakpoints/breakpoint-service';
import { ColumnContribution } from '../columns/column-contribution-service';
import { Decorator } from '../decorations/decoration-service';
import { EventEmitter, IEvent } from '../utils/events';
import { Decoration, MemoryState } from '../utils/view-types';
import { createVariableVscodeContext } from '../utils/vscode-contexts';
import { messenger } from '../view-messenger';

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
    readonly priority = 2;
    protected active = false;
    protected onDidChangeEmitter = new EventEmitter<Decoration[]>();
    /** We expect this to always be sorted from lowest to highest start address */
    protected currentVariables?: BigIntVariableRange[];

    get onDidChange(): IEvent<Decoration[]> { return this.onDidChangeEmitter.event; }

    async fetchData(currentViewParameters: ReadMemoryArguments): Promise<void> {
        if (!this.active || !currentViewParameters.memoryReference || !currentViewParameters.count) { return; }
        const visibleVariables = (await messenger.sendRequest(getVariablesType, HOST_EXTENSION, currentViewParameters))
            .map<BigIntVariableRange>(transmissible => {
                const startAddress = BigInt(transmissible.startAddress);
                return {
                    ...transmissible,
                    startAddress,
                    endAddress: transmissible.endAddress ? BigInt(transmissible.endAddress) : startAddress + BigInt(1)
                };
            });
        visibleVariables.sort((left, right) => compareBigInt(left.startAddress, right.startAddress));
        if (this.didVariableChange(visibleVariables)) {
            this.currentVariables = visibleVariables;
            this.onDidChangeEmitter.fire(this.toDecorations());
        }
    }

    async activate(memory: MemoryState): Promise<void> {
        this.active = true;
        if (memory.memory?.bytes.length) {
            await this.fetchData(memory.activeReadArguments);
        }
    }

    deactivate(): void {
        this.active = false;
        const currentVariablesPopulated = !!this.currentVariables?.length;
        if (currentVariablesPopulated) { this.onDidChangeEmitter.fire(this.currentVariables = []); }
    }

    render(range: BigIntMemoryRange): ReactNode {
        return this.getVariablesInRange(range)?.reduce<ReactNode[]>((result, current, index) => {
            if (index > 0) { result.push(', '); }
            const breakpointMetadata = breakpointService.metadata(current.variable.name);
            result.push(React.createElement('span', {
                style: { color: current.color },
                key: current.variable.name,
                className: classNames('hoverable', ...BreakpointService.inlineClasses(breakpointMetadata)),
                'data-column': 'variables',
                'data-variables': stringifyWithBigInts(current.variable),
                ...createVariableVscodeContext(current.variable, breakpointMetadata)
            }, current.variable.name));
            return result;
        }, []);
    }

    protected lastCall?: bigint;
    protected currentIndex = 0;
    /** Returns variables that start in the given range. */
    protected getVariablesInRange(range: BigIntMemoryRange): Array<{ variable: BigIntVariableRange, color: string }> | undefined {
        if (!this.currentVariables?.length) { return undefined; }
        if (this.currentIndex === this.currentVariables.length - 1 && this.currentVariables[this.currentIndex].startAddress < range.startAddress) { return undefined; }
        if (this.lastCall === undefined || range.startAddress < this.lastCall) { this.currentIndex = 0; }
        this.lastCall = range.startAddress;
        const result = [];
        while (this.currentIndex < this.currentVariables.length && this.currentVariables[this.currentIndex].startAddress < range.endAddress) {
            if (doOverlap(this.currentVariables[this.currentIndex], range)) {
                result.push({ color: NON_HC_COLORS[this.currentIndex % 5], variable: this.currentVariables[this.currentIndex] });
            }
            this.currentIndex++;
        }
        this.currentIndex = Math.min(this.currentVariables.length - 1, this.currentIndex);
        return result;
    }

    protected didVariableChange(visibleVariables: BigIntVariableRange[]): boolean {
        return visibleVariables.length !== this.currentVariables?.length
            || visibleVariables.some((item, index) => !areVariablesEqual(item, this.currentVariables![index]));
    }

    protected toDecorations(): Decoration[] {
        const decorations: Decoration[] = [];
        let colorIndex = 0;
        for (const variable of this.currentVariables ?? []) {
            if (variable.endAddress) {
                decorations.push({
                    range: {
                        startAddress: variable.startAddress,
                        endAddress: variable.endAddress
                    },
                    style: { color: NON_HC_COLORS[colorIndex++ % 5] }
                });
            }
        }
        return decorations;
    }

    dispose(): void {
        this.onDidChangeEmitter.dispose();
    }
}

export const variableDecorator = new VariableDecorator();
