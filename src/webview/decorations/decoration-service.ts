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

import { EventEmitter, IEvent } from '../utils/events';
import { Decoration, Disposable, UpdateExecutor } from '../utils/view-types';

export interface Decorator extends Partial<UpdateExecutor> {
    readonly id: string;
    readonly onDidChange: IEvent<Decoration[]>;
}

class DecorationService {
    private onDidChangeEmitter = new EventEmitter();
    private decorations = new Map<string, Decoration[]>();
    private decorators = new Map<string, Decorator>();
    /** Represents the aggregation of all contributed decorations */
    private currentDecorations = new Array<Decoration>();
    register(contribution: Decorator): Disposable {
        this.decorators.set(contribution.id, contribution);
        const changeListener = contribution.onDidChange(newDecorations => {
            const oldDecorations = this.decorations.get(contribution.id);
            this.reconcileDecorations(contribution.id, oldDecorations, newDecorations);
        });
        return {
            dispose: () => {
                changeListener.dispose();
                this.decorators.delete(contribution.id);
                const currentDecorations = this.decorations.get(contribution.id);
                this.decorations.delete(contribution.id);
                this.reconcileDecorations(contribution.id, currentDecorations, []);
            }
        };
    }

    private reconcileDecorations(affectedDecorator: string, oldDecorations: Decoration[] | undefined, newDecorations: Decoration[]): void {

    }

    getUpdateExecutors(): UpdateExecutor[] {
        return Array.from(this.decorators.values()).filter((candidate): candidate is Decorator & UpdateExecutor => candidate.fetchData !== undefined);
    }
}

export const decorationService = new DecorationService();
