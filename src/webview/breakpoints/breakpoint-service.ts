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

import { DebugProtocol } from '@vscode/debugprotocol';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import { TrackedBreakpointType, TrackedDataBreakpoint, TrackedDataBreakpoints } from '../../common/breakpoint';
import { BigIntMemoryRange, BigIntVariableRange, doOverlap, isWithin } from '../../common/memory-range';
import { getVariablesType, notifyContinuedType, notifyStoppedType, setTrackedBreakpointType, StoppedEvent } from '../../common/messaging';
import { EventEmitter } from '../utils/events';
import { UpdateExecutor } from '../utils/view-types';
import { messenger } from '../view-messenger';

export interface BreakpointMetadata {
    id?: number;
    type: TrackedBreakpointType,
    isHit: boolean;
}

export class BreakpointService implements UpdateExecutor {
    protected _breakpoints: TrackedDataBreakpoints = { external: [], internal: [] };
    protected _stoppedEvent?: StoppedEvent;

    protected variables: BigIntVariableRange[] = [];

    protected _onDidChange = new EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    get breakpoints(): TrackedDataBreakpoints {
        return this._breakpoints;
    }

    get allBreakpoints(): TrackedDataBreakpoint[] {
        return [...this.breakpoints.external, ...this.breakpoints.internal];
    }

    get stoppedEvent(): StoppedEvent | undefined {
        return this._stoppedEvent;
    }

    activate(): void {
        messenger.onNotification(setTrackedBreakpointType, breakpoints => {
            this._breakpoints = breakpoints;
            this._onDidChange.fire();
        });
        messenger.onNotification(notifyStoppedType, event => {
            this._stoppedEvent = event;
            this._onDidChange.fire();
        });
        messenger.onNotification(notifyContinuedType, () => {
            this._stoppedEvent = undefined;
            this._onDidChange.fire();
        });
    }

    async fetchData(currentViewParameters: DebugProtocol.ReadMemoryArguments): Promise<void> {
        this.variables = (await messenger.sendRequest(getVariablesType, HOST_EXTENSION, currentViewParameters))
            .map<BigIntVariableRange>(transmissible => {
                const startAddress = BigInt(transmissible.startAddress);
                return {
                    ...transmissible,
                    startAddress,
                    endAddress: transmissible.endAddress ? BigInt(transmissible.endAddress) : startAddress + BigInt(1)
                };
            });
    }

    findByDataId(dataId: string): TrackedDataBreakpoint | undefined {
        return [...this.breakpoints.external, ...this.breakpoints.internal].find(bp => bp.breakpoint.dataId === dataId);
    }

    inRange(range: BigIntMemoryRange): TrackedDataBreakpoint[] {
        const variables = this.findVariablesInRange(range);
        return this.allBreakpoints.filter(bp => {
            let isInRange = false;
            try {
                const bigint = BigInt(bp.breakpoint.dataId);
                isInRange = isWithin(bigint, range);
            } catch (ex) {
                // Nothing to do
            }

            return isInRange || variables.some(v => v.name === bp.breakpoint.dataId);
        });
    }

    protected findVariablesInRange(range: BigIntMemoryRange): BigIntVariableRange[] {
        return this.variables.filter(v => doOverlap(v, range));
    }

    isHit(breakpointOrDataId: TrackedDataBreakpoint | string): boolean {
        if (this.stoppedEvent === undefined ||
            this.stoppedEvent.body.hitBreakpointIds === undefined ||
            this.stoppedEvent.body.hitBreakpointIds.length === 0) {
            return false;
        }

        const bp = typeof breakpointOrDataId === 'string' ? this.findByDataId(breakpointOrDataId) : breakpointOrDataId;
        return !!bp?.response.id && this.stoppedEvent.body.hitBreakpointIds.includes(bp.response.id);
    }

    metadata(breakpointOrDataId: TrackedDataBreakpoint | string): BreakpointMetadata | undefined {
        const bp = typeof breakpointOrDataId === 'string' ? this.findByDataId(breakpointOrDataId) : breakpointOrDataId;

        if (bp?.type === 'external') {
            return {
                id: bp.response.id,
                type: 'external',
                isHit: this.isHit(breakpointOrDataId)
            };
        } else if (bp?.type === 'internal') {
            return {
                id: bp.response.id,
                type: 'internal',
                isHit: this.isHit(breakpointOrDataId)
            };
        }

        return undefined;
    }
}

export namespace BreakpointService {
    export namespace style {
        export const dataBreakpoint = 'data-breakpoint';
        export const dataBreakpointExternal = 'data-breakpoint-external';
        export const debugHit = 'debug-hit';
    }

    export function inlineClasses(metadata?: BreakpointMetadata): string[] {
        const classes: string[] = [];

        if (metadata) {
            if (metadata.type === 'external') {
                classes.push(BreakpointService.style.dataBreakpoint, BreakpointService.style.dataBreakpointExternal);
            } else if (metadata.type === 'internal') {
                classes.push(BreakpointService.style.dataBreakpoint);
            }

            if (metadata.isHit) {
                classes.push(BreakpointService.style.debugHit);
            }
        }

        return classes;
    }

    export function statusClasses(metadata: BreakpointMetadata[]): string[] {
        const classes: string[] = [];

        if (metadata.length > 0) {
            classes.push('codicon', 'codicon-debug-breakpoint');
            if (metadata.some(m => m.isHit)) {
                classes.push('codicon-debug-stackframe');
            }
        }

        return classes;
    }
}

export const breakpointService = new BreakpointService();
