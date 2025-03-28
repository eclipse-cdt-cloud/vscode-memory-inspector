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

import { compareBigInt, determineRelationship, isWithin, RangeRelationship } from '../../common/memory-range';
import { EventEmitter, IEvent } from '../utils/events';
import { areDecorationsEqual, Decoration, Disposable, LocatedDecoration, UpdateExecutor } from '../utils/view-types';

export interface Decorator extends Partial<UpdateExecutor> {
    readonly id: string;
    readonly onDidChange: IEvent<Decoration[]>;

    decorateFor?(location: string, context: unknown): LocatedDecoration | undefined;
}

class DecorationService {
    protected onDidChangeEmitter = new EventEmitter();
    protected contributedDecorations = new Map<string, Decoration[]>();
    protected decorators = new Map<string, Decorator>();
    /** Represents the aggregation of all contributed decorations */
    protected currentDecorations = new Array<Decoration>();
    get decorations(): Decoration[] {
        return this.currentDecorations;
    }
    register(contribution: Decorator): Disposable {
        this.decorators.set(contribution.id, contribution);
        const changeListener = contribution.onDidChange(newDecorations => {
            const oldDecorations = this.contributedDecorations.get(contribution.id);
            this.reconcileDecorations(contribution.id, oldDecorations, newDecorations);
        });
        return {
            dispose: () => {
                changeListener.dispose();
                this.decorators.delete(contribution.id);
                const currentDecorations = this.contributedDecorations.get(contribution.id);
                this.contributedDecorations.delete(contribution.id);
                this.reconcileDecorations(contribution.id, currentDecorations, []);
            }
        };
    }

    protected reconcileDecorations(affectedDecorator: string, oldDecorations: Decoration[] | undefined, newDecorations: Decoration[]): void {
        if (oldDecorations?.length === newDecorations.length && oldDecorations.every((old, index) => areDecorationsEqual(old, newDecorations[index]))) { return; }
        // TODO: Could be more surgical and figure out the changed ranges. For now, we just rebuild everything.
        if (newDecorations.length) {
            this.contributedDecorations.set(affectedDecorator, newDecorations);
        } else { this.contributedDecorations.delete(affectedDecorator); }
        if (this.decorators.size < 2) {
            this.currentDecorations = newDecorations;
        } else {
            const termini = new Set<bigint>();
            for (const decorationContributions of this.contributedDecorations.values()) {
                decorationContributions.forEach(decoration => {
                    termini.add(decoration.range.startAddress);
                    termini.add(decoration.range.endAddress);
                });
            }
            const decorations = new Array<Decoration>();
            const contributions = Array.from(this.contributedDecorations.values(), array => array.values());
            const currentSubDecorations = contributions.map<Decoration | undefined>(contribution => contribution.next().value);
            const terminiInOrder = Array.from(termini).sort(compareBigInt);
            terminiInOrder.forEach((terminus, index) => {
                if (index === terminiInOrder.length - 1) { return; }
                const decoration: Decoration = {
                    range: { startAddress: terminus, endAddress: terminiInOrder[index + 1] },
                    style: {},
                    classNames: []
                };
                decorations.push(decoration);
                currentSubDecorations.forEach((subDecoration, subDecorationIndex) => {
                    switch (determineRelationship(terminus, subDecoration?.range)) {
                        case RangeRelationship.Within: {
                            Object.assign(decoration.style, subDecoration?.style);
                            Object.assign(decoration.classNames, subDecoration?.classNames);
                        }
                            break;
                        case RangeRelationship.Past: {
                            const newSubDecoration = currentSubDecorations[subDecorationIndex] = contributions[subDecorationIndex].next().value;
                            if (determineRelationship(terminus, newSubDecoration.range) === RangeRelationship.Within) {
                                Object.assign(decoration.style, newSubDecoration.style);
                                Object.assign(decoration.classNames, subDecoration?.classNames);
                            }
                        }
                    }
                });
            });
            this.currentDecorations = decorations;
        }
        this.onDidChangeEmitter.fire(this.currentDecorations);
    }

    protected currentDecorationIndex = 0;
    protected lastCall?: bigint;

    getDecoration(address: bigint): Decoration | undefined {
        if (this.currentDecorations.length === 0) { return undefined; }
        if (this.lastCall === undefined || address < this.lastCall) { this.currentDecorationIndex = 0; }
        this.lastCall = address;
        if (address < this.currentDecorations[this.currentDecorationIndex].range.startAddress) { return undefined; }
        while (this.currentDecorationIndex < this.currentDecorations.length
            && address >= this.currentDecorations[this.currentDecorationIndex].range.endAddress) { this.currentDecorationIndex++; }
        this.currentDecorationIndex = Math.min(this.currentDecorationIndex, this.currentDecorations.length - 1);
        return isWithin(address, this.currentDecorations[this.currentDecorationIndex].range) ? this.currentDecorations[this.currentDecorationIndex] : undefined;
    }

    getDecorationFor(location: string, context: unknown): LocatedDecoration | undefined {
        return Array.from(this.decorators.values())
            .map(contribution => contribution.decorateFor?.(location, context))
            .reduce((previous, current) => {
                if (previous && current) {
                    previous.classNames.push(...current.classNames);
                }

                return previous;
            }, {
                classNames: []
            } as LocatedDecoration);
    }

    getUpdateExecutors(): UpdateExecutor[] {
        return Array.from(this.decorators.values()).filter((candidate): candidate is Decorator & UpdateExecutor => candidate.fetchData !== undefined);
    }
}

export const decorationService = new DecorationService();
