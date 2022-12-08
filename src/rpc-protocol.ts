/********************************************************************************
 * Copyright (C) 2022 Ericsson, Arm and others.
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

// copied from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/extensions/common/rpcProtocol.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable no-null/no-null */

export interface RPCProtocol extends Disposable {
    /**
     * Returns a proxy to an object addressable/named in the plugin process or in the main process.
     */
    getProxy<T>(proxyId: ProxyIdentifier<T>): T;

    /**
     * Register manually created instance.
     */
    set<T, R extends T>(identifier: ProxyIdentifier<T>, instance: R): R;
}

class Deferred<T = void> {
    state: 'resolved' | 'rejected' | 'unresolved' = 'unresolved';
    resolve!: (value: T) => void;
    reject!: (err?: any) => void;

    promise = new Promise<T>((resolve, reject) => {
        this.resolve = result => {
            resolve(result);
            if (this.state === 'unresolved') {
                this.state = 'resolved';
            }
        };
        this.reject = err => {
            reject(err);
            if (this.state === 'unresolved') {
                this.state = 'rejected';
            }
        };
    });
}

interface Disposable {
    /**
     * Dispose this object.
     */
    dispose(): void;
}

namespace Disposable {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    export function is(arg: any): arg is Disposable {
        return !!arg && typeof arg === 'object' && 'dispose' in arg && typeof arg['dispose'] === 'function';
    }
    export function create(func: () => void): Disposable {
        return {
            dispose: func
        };
    }
}

class DisposableCollection implements Disposable {

    protected readonly disposables: Disposable[] = [];

    constructor(...toDispose: Disposable[]) {
        toDispose.forEach(d => this.push(d));
    }

    get disposed(): boolean {
        return this.disposables.length === 0;
    }

    private disposingElements = false;
    dispose(): void {
        if (this.disposed || this.disposingElements) {
            return;
        }
        this.disposingElements = true;
        while (!this.disposed) {
            try {
                const disposable = this.disposables.pop();
                if (disposable) {
                    disposable.dispose();
                }
            } catch (e) {
                // Swallow error
            }
        }
        this.disposingElements = false;
    }

    push(disposable: Disposable): Disposable {
        const disposables = this.disposables;
        disposables.push(disposable);
        const originalDispose = disposable.dispose.bind(disposable);
        const toRemove = Disposable.create(() => {
            const index = disposables.indexOf(disposable);
            if (index !== -1) {
                disposables.splice(index, 1);
            }
        });
        disposable.dispose = () => {
            toRemove.dispose();
            disposable.dispose = originalDispose;
            originalDispose();
        };
        return toRemove;
    }

    pushAll(disposables: Disposable[]): Disposable[] {
        return disposables.map(disposable =>
            this.push(disposable)
        );
    }

}

export class ProxyIdentifier<T> {
    public readonly id: string;
    constructor(public readonly isMain: boolean, id: string | T) {
        // TODO this is nasty, rewrite this
        this.id = (id as any).toString();
    }
}

export function createProxyIdentifier<T>(identifier: string): ProxyIdentifier<T> {
    return new ProxyIdentifier(false, identifier);
}

interface ConnectionClosedError extends Error {
    code: 'RPC_PROTOCOL_CLOSED'
}
namespace ConnectionClosedError {
    const code: ConnectionClosedError['code'] = 'RPC_PROTOCOL_CLOSED';
    export function create(message = 'connection is closed'): ConnectionClosedError {
        return Object.assign(new Error(message), { code });
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    export function is(error: any): error is ConnectionClosedError {
        return !!error && typeof error === 'object' && 'code' in error && error['code'] === code;
    }
}

export class RPCProtocolImpl implements RPCProtocol {

    private readonly locals = new Map<string, any>();
    private readonly proxies = new Map<string, any>();
    private lastMessageId = 0;
    private readonly pendingRPCReplies = new Map<string, Deferred<any>>();
    private readonly multiplexer: RPCMultiplexer;

    private readonly toDispose = new DisposableCollection(
        Disposable.create(() => { /* mark as no disposed */ })
    );

    constructor(send: (msg: string) => void) {
        this.toDispose.push(
            this.multiplexer = new RPCMultiplexer(send)
        );
        this.toDispose.push(Disposable.create(() => {
            this.proxies.clear();
            for (const reply of this.pendingRPCReplies.values()) {
                reply.reject(ConnectionClosedError.create());
            }
            this.pendingRPCReplies.clear();
        }));
    }

    private get isDisposed(): boolean {
        return this.toDispose.disposed;
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    getProxy<T>(proxyId: ProxyIdentifier<T>): T {
        if (this.isDisposed) {
            throw ConnectionClosedError.create();
        }
        let proxy = this.proxies.get(proxyId.id);
        if (!proxy) {
            proxy = this.createProxy(proxyId.id);
            this.proxies.set(proxyId.id, proxy);
        }
        return proxy;
    }

    set<T, R extends T>(identifier: ProxyIdentifier<T>, instance: R): R {
        if (this.isDisposed) {
            throw ConnectionClosedError.create();
        }
        this.locals.set(identifier.id, instance);
        if (Disposable.is(instance)) {
            this.toDispose.push(instance);
        }
        this.toDispose.push(Disposable.create(() => this.locals.delete(identifier.id)));
        return instance;
    }

    onMessage(msg: string): void {
        const messages = JSON.parse(msg);
        for (const message of messages) {
            this.receiveOneMessage(message);
        }
    }

    private createProxy<T>(proxyId: string): T {
        const handler = {
            get: (target: any, name: string) => {
                if (!target[name] && name.charCodeAt(0) === 36 /* CharCode.DollarSign */) {
                    target[name] = (...myArgs: any[]) =>
                        this.remoteCall(proxyId, name, myArgs);
                }
                return target[name];
            }
        };
        return new Proxy(Object.create(null), handler);
    }

    private remoteCall(proxyId: string, methodName: string, args: any[]): Promise<any> {
        if (this.isDisposed) {
            return Promise.reject(ConnectionClosedError.create());
        }

        const callId = String(++this.lastMessageId);
        const result = new Deferred();

        this.pendingRPCReplies.set(callId, result);
        this.multiplexer.send(this.request(callId, proxyId, methodName, args));
        return result.promise;
    }

    private receiveOneMessage(rawmsg: string): void {
        if (this.isDisposed) {
            return;
        }
        const msg = <RPCMessage>JSON.parse(rawmsg);

        switch (msg.type) {
            case MessageType.Request:
                this.receiveRequest(msg);
                break;
            case MessageType.Reply:
                this.receiveReply(msg);
                break;
            case MessageType.ReplyErr:
                this.receiveReplyErr(msg);
                break;
        }
    }

    private receiveRequest(msg: RequestMessage): void {
        const callId = msg.id;
        const proxyId = msg.proxyId;
        // convert `null` to `undefined`, since we don't use `null` in internal plugin APIs
        const args = msg.args.map(arg => arg === null ? undefined : arg);

        const invocation = this.invokeHandler(proxyId, msg.method, args);

        invocation.then(result => {
            this.multiplexer.send(this.replyOK(callId, result));
        }, error => {
            this.multiplexer.send(this.replyErr(callId, error));
        });
    }

    private receiveReply(msg: ReplyMessage): void {
        const callId = msg.id;
        const pendingReply = this.pendingRPCReplies.get(callId);
        if (!pendingReply) {
            return;
        }
        this.pendingRPCReplies.delete(callId);
        pendingReply.resolve(msg.res);
    }

    private receiveReplyErr(msg: ReplyErrMessage): void {
        const callId = msg.id;
        const pendingReply = this.pendingRPCReplies.get(callId);
        if (!pendingReply) {
            return;
        }
        this.pendingRPCReplies.delete(callId);

        let err: Error | undefined = undefined;
        if (msg.err && msg.err.$isError) {
            err = new Error();
            err.name = msg.err.name;
            err.message = msg.err.message;
            err.stack = msg.err.stack;
        }
        pendingReply.reject(err);
    }

    private invokeHandler(proxyId: string, methodName: string, args: any[]): Promise<any> {
        try {
            return Promise.resolve(this.doInvokeHandler(proxyId, methodName, args));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    private doInvokeHandler(proxyId: string, methodName: string, args: any[]): any {
        const actor = this.locals.get(proxyId);
        if (!actor) {
            throw new Error('Unknown actor ' + proxyId);
        }
        const method = actor[methodName];
        if (typeof method !== 'function') {
            throw new Error('Unknown method ' + methodName + ' on actor ' + proxyId);
        }
        return method.apply(actor, args);
    }

    private request(req: string, rpcId: string, method: string, args: any[]): string {
        return `{"type":${MessageType.Request},"id":"${req}","proxyId":"${rpcId}","method":"${method}","args":${JSON.stringify(args)}}`;
    }

    private replyOK(req: string, res: any): string {
        if (typeof res === 'undefined') {
            return `{"type":${MessageType.Reply},"id":"${req}"}`;
        }
        return `{"type":${MessageType.Reply},"id":"${req}","res":${safeStringify(res)}}`;
    }

    private replyErr(req: string, err: any): string {
        err = typeof err === 'string' ? new Error(err) : err;
        if (err instanceof Error) {
            return `{"type":${MessageType.ReplyErr},"id":"${req}","err":${safeStringify(transformErrorForSerialization(err))}}`;
        }
        return `{"type":${MessageType.ReplyErr},"id":"${req}","err":null}`;
    }
}

/**
 * Sends/Receives multiple messages in one go:
 *  - multiple messages to be sent from one stack get sent in bulk at `process.nextTick`.
 *  - each incoming message is handled in a separate `process.nextTick`.
 */
class RPCMultiplexer implements Disposable {

    private readonly sender: (msg: string) => void;
    private readonly sendAccumulatedBound: () => void;

    private messagesToSend: string[];

    private readonly toDispose = new DisposableCollection();

    constructor(sender: (msg: string) => void) {
        this.sender = sender;
        this.sendAccumulatedBound = this.sendAccumulated.bind(this);

        this.toDispose.push(Disposable.create(() => this.messagesToSend = []));
        this.messagesToSend = [];
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    private sendAccumulated(): void {
        const tmp = this.messagesToSend;
        this.messagesToSend = [];
        this.sender(JSON.stringify(tmp));
    }

    public send(msg: string): void {
        if (this.toDispose.disposed) {
            throw ConnectionClosedError.create();
        }
        if (this.messagesToSend.length === 0) {
            if (typeof setImmediate !== 'undefined') {
                setImmediate(this.sendAccumulatedBound);
            } else {
                setTimeout(this.sendAccumulatedBound, 0);
            }
        }
        this.messagesToSend.push(msg);
    }
}

const enum MessageType {
    Request = 1,
    Reply = 2,
    ReplyErr = 3,
    Cancel = 4,
    Terminate = 5,
    Terminated = 6
}

interface CancelMessage {
    type: MessageType.Cancel;
    id: string;
}

interface RequestMessage {
    type: MessageType.Request;
    id: string;
    proxyId: string;
    method: string;
    args: any[];
}

interface ReplyMessage {
    type: MessageType.Reply;
    id: string;
    res: any;
}

interface ReplyErrMessage {
    type: MessageType.ReplyErr;
    id: string;
    err: SerializedError;
}

type RPCMessage = RequestMessage | ReplyMessage | ReplyErrMessage | CancelMessage;

interface SerializedError {
    readonly $isError: true;
    readonly name: string;
    readonly message: string;
    readonly stack: string;
}

function transformErrorForSerialization(error: Error): SerializedError {
    if (error instanceof Error) {
        const { name, message } = error;
        const stack: string = (<any>error).stacktrace || error.stack;
        return {
            $isError: true,
            name,
            message,
            stack
        };
    }

    // return as is
    return error;
}

interface JSONStringifyReplacer {
    (key: string, value: any): any;
}

function safeStringify(obj: any, replacer?: JSONStringifyReplacer): string {
    try {
        return JSON.stringify(obj, replacer);
    } catch (err) {
        return 'null';
    }
}
