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

import * as vscode from 'vscode';
import * as manifest from '../common/manifest';
import { stringifyWithBigInts } from '../common/typescript';

export enum Verbosity {
    off = 0,
    error = 1,
    warn = 2,
    info = 3,
    debug = 4
}

export abstract class Logger {
    protected logVerbosity: Verbosity;

    protected constructor() {
        this.logVerbosity = this.getVerbosity();
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.CONFIG_LOGGING_VERBOSITY}`)) {
                this.logVerbosity = this.getVerbosity();
            }
        });
    }

    protected getVerbosity(): Verbosity {
        const config = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<string>(manifest.CONFIG_LOGGING_VERBOSITY) || manifest.DEFAULT_LOGGING_VERBOSITY;
        return Verbosity[config as keyof typeof Verbosity];
    }

    protected abstract logMessage(message: string): void;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public log(verbosity: Verbosity, ...messages: Array<string | any>): void {
        if (this.logVerbosity === Verbosity.off || verbosity > this.logVerbosity) {
            return;
        }

        const result = messages.map(message => typeof message === 'string' ? message : stringifyWithBigInts(message, '\t')).join(' ');

        this.logMessage(result);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public error = (...messages: Array<string | any>): void => this.log(Verbosity.error, ...messages);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public warn = (...messages: Array<string | any>): void => this.log(Verbosity.warn, ...messages);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public info = (...messages: Array<string | any>): void => this.log(Verbosity.info, ...messages);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public debug = (...messages: Array<string | any>): void => this.log(Verbosity.debug, ...messages);
}

class OutputChannelLogger extends Logger {
    public static instance = new OutputChannelLogger();

    protected outputChannel: vscode.OutputChannel | undefined;

    protected override logMessage(message: string): void {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel(manifest.DISPLAY_NAME);
        }
        this.outputChannel.appendLine(message);
    }
}

export const outputChannelLogger = OutputChannelLogger.instance;
