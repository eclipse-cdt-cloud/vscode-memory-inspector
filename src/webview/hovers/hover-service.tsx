/********************************************************************************
 * Copyright (C) 2024 Ericsson and others.
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

import * as React from 'react';
import { HOST_EXTENSION } from 'vscode-messenger-common';
import { logMessageType } from '../../common/messaging';
import { MemoryAppState } from '../memory-webview-view';
import { Disposable, MemoryDisplayConfiguration } from '../utils/view-types';
import { messenger } from '../view-messenger';

export interface HoverableDetails {
    columnId: string;
    textContent: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extraData: any;
}

export interface MemoryDetails extends HoverableDetails, MemoryDisplayConfiguration, MemoryAppState { };

export type HoverProvider = (data: MemoryDetails) => Promise<React.ReactNode>;

export interface HoverContribution {
    readonly id: string;
    priority?: number;
    render: HoverProvider;
}

export class HoverService {
    protected contributions: HoverContribution[] = [];

    public register(contribution: HoverContribution): Disposable {
        if (this.contributions.some(c => c.id === contribution.id)) { return { dispose: () => { } }; }
        this.contributions.push(contribution);
        this.contributions.sort(this.sortContributions);
        return {
            dispose: () => {
                this.contributions = this.contributions.filter(hover => hover === contribution);
            }
        };
    }

    protected memoryAppState: MemoryAppState = {} as unknown as MemoryAppState;
    public setMemoryState(state: MemoryAppState): void {
        this.memoryAppState = state;
    }

    protected prepareData(hoverableDetails: HoverableDetails): MemoryDetails {
        return {
            ...hoverableDetails,
            ...this.memoryAppState,
        };
    }

    public async render(hoverableDetails: HoverableDetails): Promise<React.ReactNode> {
        const data = this.prepareData(hoverableDetails);
        const promises = this.contributions.map(async contribution => {
            let hoverPart: React.ReactNode;
            try {
                hoverPart = await contribution.render(data);
            } catch (err) {
                messenger.sendRequest(logMessageType, HOST_EXTENSION, `Error in hover contribution ${contribution.id}: ${err}`);
            }
            return hoverPart;
        });
        const nodes = (await Promise.all(promises)).filter(node => !!node);
        if (nodes.length > 0) {
            return <div className='memory-hover'>{nodes}</div>;
        }
        return <></>;
    }

    protected sortContributions(left: HoverContribution, right: HoverContribution): number {
        const leftHasPriority = typeof left.priority === 'number';
        const rightHasPriority = typeof right.priority === 'number';
        if (leftHasPriority && !rightHasPriority) { return -1; }
        if (rightHasPriority && !leftHasPriority) { return 1; }
        if ((!rightHasPriority && !leftHasPriority) || (left.priority! - right.priority! === 0)) {
            return left.id.localeCompare(right.id);
        }
        return left.priority! - right.priority!;
    }

}

export const hoverService = new HoverService();
