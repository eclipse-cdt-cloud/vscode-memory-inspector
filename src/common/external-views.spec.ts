/********************************************************************************
 * Copyright (C) 2026 Microchip Technology Inc. and its subsidiaries and others.
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

import { expect } from 'chai';
import { isVariablesContext, isWatchItemContext, VariablesView, WatchView } from './external-views';

describe('external-views', () => {
    describe('isVariablesContext', () => {
        it('accepts a fully-formed Variables view context with a Scope container', () => {
            const ctx: VariablesView.IVariablesContext = {
                sessionId: 'session-1',
                container: { name: 'Locals', variablesReference: 1000, expensive: false },
                variable: { name: 'foo', value: '42', variablesReference: 0 }
            };
            expect(isVariablesContext(ctx)).to.equal(true);
        });

        it('accepts a Variables view context with a Variable container (nested variable)', () => {
            const ctx: VariablesView.IVariablesContext = {
                sessionId: 'session-1',
                container: { name: 'parent', value: '{...}', variablesReference: 2000 },
                variable: { name: 'child', value: '7', variablesReference: 0 }
            };
            expect(isVariablesContext(ctx)).to.equal(true);
        });

        it('accepts a Variables view context with an EvaluateArguments container', () => {
            const ctx: VariablesView.IVariablesContext = {
                sessionId: 'session-1',
                container: { expression: 'someExpr' },
                variable: { name: 'child', value: '7', variablesReference: 0 }
            };
            expect(isVariablesContext(ctx)).to.equal(true);
        });

        it('rejects undefined / null / primitive values', () => {
            expect(isVariablesContext(undefined)).to.equal(false);
            // eslint-disable-next-line no-null/no-null
            expect(isVariablesContext(null as unknown)).to.equal(false);
            expect(isVariablesContext(42)).to.equal(false);
            expect(isVariablesContext('string')).to.equal(false);
        });

        it('rejects an object missing the variable field', () => {
            expect(isVariablesContext({ sessionId: 's', container: { expression: 'e' } })).to.equal(false);
        });

        it('rejects an object with an unexpected container shape', () => {
            expect(isVariablesContext({
                sessionId: 's',
                container: { unexpected: true },
                variable: { name: 'x', value: '1' }
            })).to.equal(false);
        });

        it('rejects a watch expression shape that lacks container/variable', () => {
            const watchLike = { name: 'g_counter', value: '42', memoryReference: '0xdeadbeef' };
            expect(isVariablesContext(watchLike)).to.equal(false);
        });
    });

    describe('isWatchItemContext', () => {
        it('accepts a root watch expression with memoryReference set', () => {
            const watch: WatchView.IWatchItemContext = {
                name: 'g_counter',
                value: '42',
                type: 'int',
                memoryReference: '0xdeadbeef',
                evaluateName: 'g_counter'
            };
            expect(isWatchItemContext(watch)).to.equal(true);
        });

        it('accepts a child watch variable with only name/value', () => {
            const child = { name: 'field', value: '0' };
            expect(isWatchItemContext(child)).to.equal(true);
        });

        it('accepts a minimal watch item with just a name', () => {
            expect(isWatchItemContext({ name: 'expr' })).to.equal(true);
        });

        it('rejects a Variables view wrapper context (handled by isVariablesContext instead)', () => {
            const wrapped: VariablesView.IVariablesContext = {
                sessionId: 'session-1',
                container: { name: 'Locals', variablesReference: 1000, expensive: false },
                variable: { name: 'foo', value: '42', variablesReference: 0 }
            };
            expect(isWatchItemContext(wrapped)).to.equal(false);
        });

        it('rejects undefined / null / primitive values', () => {
            expect(isWatchItemContext(undefined)).to.equal(false);
            // eslint-disable-next-line no-null/no-null
            expect(isWatchItemContext(null as unknown)).to.equal(false);
            expect(isWatchItemContext(42)).to.equal(false);
            expect(isWatchItemContext('string')).to.equal(false);
            expect(isWatchItemContext(true)).to.equal(false);
        });

        it('rejects an empty object', () => {
            expect(isWatchItemContext({})).to.equal(false);
        });

        it('rejects an object whose name is not a string', () => {
            expect(isWatchItemContext({ name: 42 })).to.equal(false);
            expect(isWatchItemContext({ name: undefined })).to.equal(false);
        });

        it('discriminates: variables wrappers match isVariablesContext only, watch items match isWatchItemContext only', () => {
            const wrapped: VariablesView.IVariablesContext = {
                sessionId: 'session-1',
                container: { expression: 'x' },
                variable: { name: 'foo', value: '42', variablesReference: 0 }
            };
            const watchItem: WatchView.IWatchItemContext = { name: 'expr', memoryReference: '0x1' };

            expect(isVariablesContext(wrapped)).to.equal(true);
            expect(isWatchItemContext(wrapped)).to.equal(false);

            expect(isWatchItemContext(watchItem)).to.equal(true);
            expect(isVariablesContext(watchItem)).to.equal(false);
        });
    });
});
