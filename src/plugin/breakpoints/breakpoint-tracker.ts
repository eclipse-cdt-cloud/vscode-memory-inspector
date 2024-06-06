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
import * as vscode from 'vscode';
import { SetDataBreakpointsResult, TrackedDataBreakpoint, TrackedDataBreakpoints } from '../../common/breakpoint';
import { isDebugRequest, isDebugResponse } from '../../common/debug-requests';
import { isSessionEvent, SessionContinuedEvent, SessionEvent, SessionRequest, SessionResponse, SessionStoppedEvent, SessionTracker } from '../session-tracker';

export class BreakpointTracker {
    protected _dataBreakpoints: TrackedDataBreakpoints = { external: [], internal: [] };
    protected _stoppedEvent?: SessionStoppedEvent;
    protected dataBreakpointsRequest: Record<number, DebugProtocol.SetDataBreakpointsRequest> = {};

    protected _onBreakpointsChanged = new vscode.EventEmitter<TrackedDataBreakpoints>();
    readonly onBreakpointChanged = this._onBreakpointsChanged.event;

    protected _onSetDataBreakpointResponse = new vscode.EventEmitter<DebugProtocol.SetDataBreakpointsResponse>();
    readonly onSetDataBreakpointResponse = this._onSetDataBreakpointResponse.event;

    protected _onStopped = new vscode.EventEmitter<SessionStoppedEvent>();
    readonly onStopped = this._onStopped.event;

    protected _onContinued = new vscode.EventEmitter<SessionContinuedEvent>();
    readonly onContinued = this._onContinued.event;

    notifySetDataBreakpointEnabled = true;

    get dataBreakpoints(): TrackedDataBreakpoints {
        return this._dataBreakpoints;
    }

    get internalDataBreakpoints(): TrackedDataBreakpoint[] {
        return this._dataBreakpoints.internal;
    }

    get externalDataBreakpoints(): TrackedDataBreakpoint[] {
        return this._dataBreakpoints.external;
    }

    get stoppedEvent(): SessionStoppedEvent | undefined {
        return this._stoppedEvent;
    }

    constructor(protected sessionTracker: SessionTracker) {
        this.sessionTracker.onSessionEvent(event => this.onSessionEvent(event));
        this.sessionTracker.onSessionRequest(event => this.onSessionRequest(event));
        this.sessionTracker.onSessionResponse(event => this.onSessionResponse(event));
    }

    setInternal(internalBreakpoints: SetDataBreakpointsResult['breakpoints']): void {
        this._dataBreakpoints.internal = [];

        const { external, internal } = this._dataBreakpoints;
        const ids = internalBreakpoints.map(bp => bp.id);
        for (let i = 0; i < external.length; i++) {
            const tbp = external[i];
            if (ids.includes(tbp.response.id)) {
                tbp.type = 'internal';
                internal.push(tbp);
            }
        }

        this._dataBreakpoints.external = external.filter(tbp => !ids.includes(tbp.response.id));
        this.fireDataBreakpoints();
    }

    protected onSessionEvent(event: SessionEvent): void {
        if (!this.sessionTracker.isActive) {
            return;
        }

        if (isSessionEvent('stopped', event)) {
            // TODO: Only for demo purposes
            // Reason: The debugger does not set the hitBreakpointIds property
            const demoEvent: SessionStoppedEvent = {
                ...event,
                data: {
                    ...event.data,
                    body: {
                        ...event.data.body,
                        hitBreakpointIds: this.externalDataBreakpoints.map(bp => bp.response.id ?? -1)
                    }
                }
            };
            this._stoppedEvent = demoEvent;
            this._onStopped.fire(demoEvent);
        } else if (isSessionEvent('continued', event)) {
            this._stoppedEvent = undefined;
            this._onContinued.fire(event);
        }
    }

    protected onSessionRequest(event: SessionRequest): void {
        if (!this.sessionTracker.isActive) {
            return;
        }

        const { request } = event;
        if (isDebugRequest('setDataBreakpoints', request)) {
            this.dataBreakpointsRequest[request.seq] = request;
        }
    }

    protected onSessionResponse(event: SessionResponse): void {
        if (!this.sessionTracker.isActive) {
            return;
        }

        const { response } = event;
        if (isDebugResponse('setDataBreakpoints', response)) {
            this._dataBreakpoints.external = [];

            const { external } = this._dataBreakpoints;

            const request = this.dataBreakpointsRequest[response.request_seq];
            if (request) {
                if (response.success) {
                    for (let i = 0; i < response.body.breakpoints.length; i++) {
                        const bpResponse = response.body.breakpoints[i];
                        if (bpResponse.verified) {
                            external.push({
                                type: 'external',
                                breakpoint: request.arguments.breakpoints[i],
                                response: bpResponse
                            });
                        }
                    }
                }

                delete this.dataBreakpointsRequest[request.seq];
            }

            if (this.notifySetDataBreakpointEnabled) {
                this._onSetDataBreakpointResponse.fire(response);
                this.fireDataBreakpoints();
            }
        }
    }

    protected fireDataBreakpoints(): void {
        this._onBreakpointsChanged.fire(this.dataBreakpoints);
    }
}
