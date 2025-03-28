/********************************************************************************
 * Copyright (C) 2025 EclipseSource.
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

import { BigIntVariableRange, toHexStringWithRadixMarker } from '../../common/memory-range';
import { DataColumnRenderGroup } from '../columns/data-column';
import { MemoryRowData } from '../components/memory-table';
import { Decorator } from '../decorations/decoration-service';
import { EventEmitter, IEvent } from '../utils/events';
import { Decoration, LocatedDecoration } from '../utils/view-types';
import { BreakpointMetadata, BreakpointService, breakpointService } from './breakpoint-service';

export class BreakpointDecorator implements Decorator {
    readonly id = 'breakpoints';

    protected onDidChangeEmitter = new EventEmitter<Decoration[]>();
    get onDidChange(): IEvent<Decoration[]> { return this.onDidChangeEmitter.event; }

    decorateFor?(_location: string, context: unknown): LocatedDecoration | undefined {
        if (DataColumnRenderGroup.is(context)) {
            const breakpoint = breakpointService.metadata(toHexStringWithRadixMarker(context.startAddress));
            return { classNames: BreakpointService.inlineClasses(breakpoint) };
        } else if (BigIntVariableRange.is(context)) {
            const breakpoint = breakpointService.metadata(context.name);
            return { classNames: BreakpointService.inlineClasses(breakpoint) };
        } else if (MemoryRowData.is(context)) {
            const breakpointMetadata = breakpointService.inRange(context)
                .map(bp => breakpointService.metadata(bp))
                .filter((bp): bp is BreakpointMetadata => bp !== undefined);
            const statusClasses = BreakpointService.statusClasses(breakpointMetadata);
            return { classNames: statusClasses };
        }

        return undefined;
    }
}
