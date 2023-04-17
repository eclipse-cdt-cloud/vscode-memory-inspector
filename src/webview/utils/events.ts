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

import { Disposable, dispose } from './view-types';

export class EventEmitter<T> {
    protected emitter = new EventTarget();
    protected toDispose = new Array<Disposable>();

    event(externalHandler: (event: T) => unknown): Disposable {
        const internalHandler = (event: Event) => {
            const handlerEvent = event as Event & { data: T };
            externalHandler(handlerEvent.data);
        };
        this.emitter.addEventListener('fire', internalHandler);
        let disposed = false;
        const toDispose = () => {
            if (!disposed) {
                disposed = true;
                this.emitter.removeEventListener('fire', internalHandler);
            }
        };
        const result = {
            dispose: () => {
                if (!disposed) {
                    toDispose();
                    const locationInArray = this.toDispose.findIndex(disposable => disposable.dispose === toDispose);
                    if (locationInArray !== -1) { this.toDispose.splice(locationInArray, 1); }
                }
            }
        };
        this.toDispose.push({ dispose: toDispose });
        return result;
    }

    fire(event: T): void {
        const domEvent = new Event('fire') as Event & { data: T };
        domEvent.data = event;
        this.emitter.dispatchEvent(domEvent);
    }

    dispose(): void {
        this.toDispose.forEach(dispose);
        this.toDispose.length = 0;
    }
}

export interface IEvent<T> {
    (handler: (event: T) => unknown): Disposable;
}
