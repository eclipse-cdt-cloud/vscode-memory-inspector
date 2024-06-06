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

import { DataBreakpointInfoArguments, DataBreakpointInfoResult, SetDataBreakpointsArguments, SetDataBreakpointsResult } from '../../common/breakpoint';
import { sendRequest } from '../../common/debug-requests';
import { SessionTracker } from '../session-tracker';
import { BreakpointTracker } from './breakpoint-tracker';

export class BreakpointProvider {

    constructor(protected readonly sessionTracker: SessionTracker, protected readonly breakpointTracker: BreakpointTracker) {
        this.breakpointTracker.onSetDataBreakpointResponse(() => {
            this.setMemoryInspectorDataBreakpoint({
                breakpoints: this.breakpointTracker.internalDataBreakpoints.map(bp => bp.breakpoint)
            });
        });
    }

    async setMemoryInspectorDataBreakpoint(args: SetDataBreakpointsArguments): Promise<SetDataBreakpointsResult> {
        const session = this.sessionTracker.assertDebugCapability(this.sessionTracker.activeSession, 'supportsDataBreakpoints', 'set data breakpoint');
        this.breakpointTracker.notifySetDataBreakpointEnabled = false;
        const breakpoints = [
            ...this.breakpointTracker.externalDataBreakpoints.map(bp => bp.breakpoint),
            ...args.breakpoints];
        return sendRequest(session, 'setDataBreakpoints', { breakpoints })
            .then(response => {
                const indexOfInternal = response.breakpoints.length - args.breakpoints.length;
                this.breakpointTracker.setInternal(response.breakpoints.slice(indexOfInternal));
                return response;
            }).finally(() => {
                this.breakpointTracker.notifySetDataBreakpointEnabled = true;
            });
    }

    async dataBreakpointInfo(args: DataBreakpointInfoArguments): Promise<DataBreakpointInfoResult> {
        const session = this.sessionTracker.assertDebugCapability(this.sessionTracker.activeSession, 'supportsDataBreakpoints', 'data breakpoint info');
        return sendRequest(session, 'dataBreakpointInfo', args);
    }
}
