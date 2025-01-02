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
import { isDebugEvent, isDebugRequest, isDebugResponse } from '../common/debug-requests';
import { WrittenMemory } from '../common/memory-range';
import type { Session } from '../common/messaging';

export interface SessionInfo {
    raw: vscode.DebugSession;
    debugCapabilities?: DebugProtocol.Capabilities;
    clientCapabilities?: DebugProtocol.InitializeRequestArguments;
    active?: boolean;
    stopped?: boolean;
}

export interface SessionEvent {
    event: string;
    session?: SessionInfo;
    data?: unknown;
}

export interface ActiveSessionChangedEvent extends SessionEvent {
    event: 'active';
}

export interface SessionMemoryWrittenEvent extends SessionEvent {
    event: 'memory-written';
    session: SessionInfo;
    data: WrittenMemory;
}

export interface SessionStoppedEvent extends SessionEvent {
    event: 'stopped';
    session: SessionInfo;
}

export interface SessionContinuedEvent extends SessionEvent {
    event: 'continued';
    session: SessionInfo;
}

export interface SessionsChangedEvent extends SessionEvent {
    event: 'changed';
}

export interface SessionEvents {
    'active': ActiveSessionChangedEvent,
    'memory-written': SessionMemoryWrittenEvent,
    'continued': SessionContinuedEvent,
    'stopped': SessionStoppedEvent
    'changed': SessionsChangedEvent
}

export type DebugCapability = keyof DebugProtocol.Capabilities;
export type ClientCapability = keyof DebugProtocol.InitializeRequestArguments;

export function isSessionEvent<K extends keyof SessionEvents>(event: K, message: unknown): message is SessionEvents[K] {
    const assumed = message ? message as SessionEvent : undefined;
    return !!assumed && assumed.event === event;
}

export class SessionTracker implements vscode.DebugAdapterTrackerFactory {
    protected toDispose: vscode.Disposable[] = [];

    protected readonly _sessionInfo = new Map<string, SessionInfo>();

    private _onSessionEvent = new vscode.EventEmitter<SessionEvent>();
    public readonly onSessionEvent = this._onSessionEvent.event;

    activate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.debug.registerDebugAdapterTrackerFactory('*', this),
            vscode.debug.onDidChangeActiveDebugSession(session => this.activeSessionChanged(session))
        );
    }

    createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return ({
            onWillStartSession: () => this.sessionWillStart(session),
            onWillStopSession: () => this.sessionWillStop(session),
            onDidSendMessage: message => this.adapterMessageReceived(session, message),
            onWillReceiveMessage: message => this.willSendClientMessage(session, message)
        });
    }

    protected sessionInfo(session: vscode.DebugSession): SessionInfo {
        let info = this._sessionInfo.get(session.id);
        if (!info) {
            info = { raw: session };
            if (this._sessionInfo.has(session.id)) {
                // Only update session if it is active
                this._sessionInfo.set(session.id, info);
            }
        }
        return info;
    }

    protected async activeSessionChanged(session?: vscode.DebugSession): Promise<void> {
        for (const [sessionId, info] of this._sessionInfo) {
            info.active = sessionId === session?.id;
        }
        this._onSessionEvent.fire({ event: 'active', session: session ? this.sessionInfo(session) : undefined });
    }

    fireSessionEvent<K extends keyof Omit<SessionEvents, 'active'>>(session: vscode.DebugSession, event: K, data: SessionEvents[K]['data']): void {
        this._onSessionEvent.fire({ event, session: this.sessionInfo(session), data });
    }

    protected async sessionWillStart(session: vscode.DebugSession): Promise<void> {
        this._sessionInfo.set(session.id, { raw: session });
        this.fireSessionEvent(session, 'changed', undefined);
    }

    protected sessionWillStop(session: vscode.DebugSession): void {
        this._sessionInfo.delete(session.id);
        this.fireSessionEvent(session, 'changed', undefined);
    }

    protected willSendClientMessage(session: vscode.DebugSession, message: unknown): void {
        if (isDebugRequest('initialize', message)) {
            this.sessionInfo(session).clientCapabilities = message.arguments;
        }
    }

    protected adapterMessageReceived(session: vscode.DebugSession, message: unknown): void {
        if (isDebugResponse('initialize', message)) {
            this.sessionInfo(session).debugCapabilities = message.body;
        } else if (isDebugEvent('stopped', message)) {
            this.sessionInfo(session).stopped = true;
            this.fireSessionEvent(session, 'stopped', undefined);
        } else if (isDebugEvent('continued', message)) {
            this.sessionInfo(session).stopped = false;
            this.fireSessionEvent(session, 'continued', undefined);
        } else if (isDebugEvent('memory', message)) {
            this.fireSessionEvent(session, 'memory-written', message.body);
        }
    }

    public getSessions(): Session[] {
        return Array.from(this._sessionInfo.values())
            .map(info => ({ id: info.raw.id, name: info.raw.name }));
    }

    assertSession(sessionId: string | undefined, action: string = 'get session'): vscode.DebugSession {
        if (!sessionId || !this._sessionInfo.has(sessionId)) {
            throw new Error(`Cannot ${action}. No active debug session.`);
        }
        return this._sessionInfo.get(sessionId)!.raw;
    }

    isActive(session: vscode.DebugSession): boolean {
        return !!session && vscode.debug.activeDebugSession?.id === session?.id;
    }

    isStopped(session: vscode.DebugSession): boolean {
        return !!session && !!this.sessionInfo(session).stopped;
    }

    hasDebugCapability(session: vscode.DebugSession, capability: DebugCapability): boolean {
        return !!session && !!this.sessionInfo(session).debugCapabilities?.[capability];
    }

    assertDebugCapability(session: vscode.DebugSession, capability: DebugCapability, action: string = 'execute action'): vscode.DebugSession {
        if (!this.hasDebugCapability(session, capability)) {
            throw new Error(`Cannot ${action}. Session does not have capability '${capability}'.`);
        }
        return session;
    }

    hasClientCapability(session: vscode.DebugSession | undefined, capability: ClientCapability): boolean {
        return !!session && !!this.sessionInfo(session).clientCapabilities?.[capability];
    }

    assertClientCapability(session: vscode.DebugSession, capability: ClientCapability, action: string = 'execute action'): vscode.DebugSession {
        if (!this.hasClientCapability(session, capability)) {
            throw new Error(`Cannot ${action}. Client does not have capability '${capability}'.`);
        }
        return session;
    }
}
