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
import type { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { isDebugEvent, isDebugRequest, isDebugRequestType, isDebugResponse, isDebugResponseType } from '../common/debug-requests';
import type { WrittenMemory } from '../common/memory-range';
import type { ContinuedEvent, StoppedEvent } from '../common/messaging';

export interface SessionInfo {
    raw: vscode.DebugSession;
    debugCapabilities?: DebugProtocol.Capabilities;
    clientCapabilities?: DebugProtocol.InitializeRequestArguments;
    active?: boolean;
    stopped?: boolean;
}

export interface SessionRequest {
    session: SessionInfo;
    request: DebugProtocol.Request
}

export interface SessionResponse {
    session: SessionInfo;
    response: DebugProtocol.Response
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
    data: StoppedEvent;
}

export interface SessionContinuedEvent extends SessionEvent {
    event: 'continued';
    session: SessionInfo;
    data: ContinuedEvent
}

export interface SessionEvents {
    'active': ActiveSessionChangedEvent,
    'memory-written': SessionMemoryWrittenEvent,
    'continued': SessionContinuedEvent,
    'stopped': SessionStoppedEvent
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
    private _onSessionRequest = new vscode.EventEmitter<SessionRequest>();
    public readonly onSessionRequest = this._onSessionRequest.event;
    private _onSessionResponse = new vscode.EventEmitter<SessionResponse>();
    public readonly onSessionResponse = this._onSessionResponse.event;

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
            this._sessionInfo.set(session.id, info);
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

    fireSessionRequest(session: vscode.DebugSession, data: DebugProtocol.Request): void {
        this._onSessionRequest.fire({ session: this.sessionInfo(session), request: data });
    }

    fireSessionResponse(session: vscode.DebugSession, data: DebugProtocol.Response): void {
        this._onSessionResponse.fire({ session: this.sessionInfo(session), response: data });
    }

    protected async sessionWillStart(session: vscode.DebugSession): Promise<void> {
        this._sessionInfo.set(session.id, { raw: session });
    }

    protected sessionWillStop(session: vscode.DebugSession): void {
        this._sessionInfo.delete(session.id);
    }

    protected willSendClientMessage(session: vscode.DebugSession, message: unknown): void {
        if (isDebugRequest('initialize', message)) {
            this.sessionInfo(session).clientCapabilities = message.arguments;
        }

        if (isDebugRequestType(message)) {
            this.fireSessionRequest(session, message);
        }
    }

    protected adapterMessageReceived(session: vscode.DebugSession, message: unknown): void {
        if (isDebugResponse('initialize', message)) {
            this.sessionInfo(session).debugCapabilities = message.body;
        } else if (isDebugEvent('stopped', message)) {
            this.sessionInfo(session).stopped = true;
            this.fireSessionEvent(session, 'stopped', message);
        } else if (isDebugEvent('continued', message)) {
            this.sessionInfo(session).stopped = false;
            this.fireSessionEvent(session, 'continued', message);
        } else if (isDebugEvent('memory', message)) {
            this.fireSessionEvent(session, 'memory-written', message.body);
        }

        if (isDebugResponseType(message)) {
            this.fireSessionResponse(session, message);
        }
    }

    get activeSession(): vscode.DebugSession | undefined {
        return vscode.debug.activeDebugSession;
    }

    assertActiveSession(action: string = 'get session'): vscode.DebugSession {
        if (!this.activeSession) {
            throw new Error(`Cannot ${action}. No active debug session.`);
        }
        return this.activeSession;
    }

    isActive(session = this.activeSession): boolean {
        return !!session && vscode.debug.activeDebugSession?.id === session?.id;
    }

    isStopped(session = this.activeSession): boolean {
        return !!session && !!this.sessionInfo(session).stopped;
    }

    hasDebugCapability(session = this.activeSession, capability: DebugCapability): boolean {
        return !!session && !!this.sessionInfo(session).debugCapabilities?.[capability];
    }

    assertDebugCapability(session = this.assertActiveSession(), capability: DebugCapability, action: string = 'execute action'): vscode.DebugSession {
        if (!this.hasDebugCapability(session, capability)) {
            throw new Error(`Cannot ${action}. Session does not have capability '${capability}'.`);
        }
        return session;
    }

    hasClientCapability(session: vscode.DebugSession | undefined, capability: ClientCapability): boolean {
        return !!session && !!this.sessionInfo(session).clientCapabilities?.[capability];
    }

    assertClientCapability(session = this.assertActiveSession(), capability: ClientCapability, action: string = 'execute action'): vscode.DebugSession {
        if (!this.hasClientCapability(session, capability)) {
            throw new Error(`Cannot ${action}. Client does not have capability '${capability}'.`);
        }
        return session;
    }
}
