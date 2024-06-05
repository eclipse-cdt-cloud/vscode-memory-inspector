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

import MemoryMap from 'nrf-intel-hex';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { isVariablesContext } from '../common/external-views';
import { IntelHEX } from '../common/intel-hex';
import * as manifest from '../common/manifest';
import {
    bytesToStringMemory, createMemoryFromRead,
    validateCount, validateMemoryReference, validateOffset
} from '../common/memory';
import { toHexStringWithRadixMarker } from '../common/memory-range';
import { ApplyMemoryArguments, ApplyMemoryResult, MemoryOptions, StoreMemoryArguments } from '../common/messaging';
import { isWebviewContext } from '../common/webview-context';
import { MemoryProvider } from './memory-provider';

export const StoreCommandType = `${manifest.PACKAGE_NAME}.store-file`;
export const ApplyCommandType = `${manifest.PACKAGE_NAME}.apply-file`;

const VALID_FILE_NAME_CHARS = /[^a-zA-Z0-9 _-]/g;

type StoreMemoryOptions = Required<MemoryOptions> & {
    proposedOutputName?: string,
    outputFile: vscode.Uri;
};

const DEFAULT_STORE_OPTIONS: Omit<StoreMemoryOptions, 'outputFile' | 'proposedOutputName'> = {
    memoryReference: toHexStringWithRadixMarker(0n, 8),
    offset: 0,
    count: 256
};

interface ApplyMemoryOptions {
    uri: vscode.Uri;
}

export class MemoryStorage {
    constructor(protected memoryProvider: MemoryProvider) {
    }

    public activate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand(StoreCommandType, args => this.storeMemory(args)),
            vscode.commands.registerCommand(ApplyCommandType, args => this.applyMemory(args))
        );
    }

    public async storeMemory(args?: StoreMemoryArguments): Promise<void> {
        const providedDefaultOptions = await this.storeArgsToOptions(args);
        const options = await this.getStoreMemoryOptions(providedDefaultOptions);
        if (!options) {
            // user aborted process
            return;
        }

        const { outputFile, ...readArgs } = options;
        try {
            const memoryResponse = await this.memoryProvider.readMemory(readArgs);
            const memory = createMemoryFromRead(memoryResponse);
            const memoryMap = new MemoryMap({ [Number(memory.address)]: memory.bytes });
            await vscode.workspace.fs.writeFile(outputFile, new TextEncoder().encode(memoryMap.asHexString()));
        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Could not write memory to '${vscode.workspace.asRelativePath(outputFile)}': ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Could not write memory to '${vscode.workspace.asRelativePath(outputFile)}': ${error}`);
            }
            return;
        }

        const option = await vscode.window.showInformationMessage(`File '${vscode.workspace.asRelativePath(outputFile)}' saved.`, 'Open File');
        if (option === 'Open File') {
            await vscode.window.showTextDocument(outputFile);
        }
    }

    protected async storeArgsToOptions(args?: StoreMemoryArguments): Promise<Partial<StoreMemoryOptions>> {
        if (!args) {
            return {};
        }
        if (isWebviewContext(args)) {
            return { ...args.activeReadArguments };
        }
        if (isVariablesContext(args)) {
            try {
                const variableName = args.variable.evaluateName ?? args.variable.name;
                const count = await this.memoryProvider.getSizeOfVariable(variableName);
                const memoryReference = args.variable.memoryReference ?? await this.memoryProvider.getAddressOfVariable(variableName);
                return { count: Number(count), memoryReference, offset: 0, proposedOutputName: variableName };
            } catch (error) {
                // ignore, we are just using them as default values
                return { memoryReference: args.variable.memoryReference, offset: 0 };
            }
        }
        return args;
    }

    protected async getStoreMemoryOptions(providedDefault?: Partial<StoreMemoryOptions>): Promise<StoreMemoryOptions | undefined> {
        const memoryReference = await vscode.window.showInputBox({
            title: 'Store Memory to File (1/3)',
            prompt: 'Start Memory Address',
            placeHolder: 'Hex address or expression',
            value: providedDefault?.memoryReference ?? DEFAULT_STORE_OPTIONS.memoryReference,
            validateInput: validateMemoryReference
        });
        if (!memoryReference) {
            return;
        }
        const offset = await vscode.window.showInputBox({
            title: 'Store Memory to File (2/3)',
            prompt: 'Memory Address Offset',
            placeHolder: 'Positive or negative offset in bytes',
            value: providedDefault?.offset?.toString() ?? DEFAULT_STORE_OPTIONS.offset.toString(),
            validateInput: validateOffset
        });
        if (!offset) {
            return;
        }
        const count = await vscode.window.showInputBox({
            title: 'Store Memory to File (3/3)',
            prompt: 'Length',
            placeHolder: 'Number of bytes to read',
            value: providedDefault?.count?.toString() ?? DEFAULT_STORE_OPTIONS.count.toString(),
            validateInput: validateCount
        });
        if (!count) {
            return;
        }
        const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        const proposedName = providedDefault?.proposedOutputName ?? memoryReference + '_' + count;
        const validName = proposedName.replace(VALID_FILE_NAME_CHARS, '');
        const defaultUri = workspaceUri ? Utils.joinPath(workspaceUri, validName) : workspaceUri;
        const saveFile = await vscode.window.showSaveDialog({ title: 'Store Memory', defaultUri, filters: IntelHEX.DialogFilters });
        if (!saveFile) {
            return;
        }
        const outputFile = IntelHEX.FileExtensions.applyIfMissing(saveFile);
        return { memoryReference, offset: Number(offset), count: Number(count), outputFile };
    }

    public async applyMemory(args?: ApplyMemoryArguments): Promise<ApplyMemoryResult> {
        const providedDefaultOptions = await this.applyArgsToOptions(args);
        const options = await this.getApplyMemoryOptions(providedDefaultOptions);
        if (!options) {
            // user aborted process
            return {};
        }
        try {
            const byteContent = await vscode.workspace.fs.readFile(options.uri);
            const memoryMap = MemoryMap.fromHex(new TextDecoder().decode(byteContent));
            let memoryReference: string | undefined;
            let count: number | undefined;
            for (const [address, memory] of memoryMap) {
                memoryReference = toHexStringWithRadixMarker(address);
                count = memory.length;
                const data = bytesToStringMemory(memory);
                await this.memoryProvider.writeMemory({ memoryReference, data });
            }
            await vscode.window.showInformationMessage(`Memory from '${vscode.workspace.asRelativePath(options.uri)}' applied.`);
            return { memoryReference, count, offset: 0 };
        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Could not apply memory from '${vscode.workspace.asRelativePath(options.uri)}': ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Could not apply memory from '${vscode.workspace.asRelativePath(options.uri)}': ${error}`);
            }
            return {};
        }
    }

    protected async applyArgsToOptions(args?: ApplyMemoryArguments): Promise<Partial<ApplyMemoryOptions>> {
        return URI.isUri(args) ? { uri: args } : {};
    }

    protected async getApplyMemoryOptions(providedDefault?: Partial<ApplyMemoryOptions>): Promise<ApplyMemoryOptions | undefined> {
        if (providedDefault?.uri) {
            // if we are already given a URI, let's not bother the user and simply use it
            return { uri: providedDefault.uri };
        }
        const selectedUris = await vscode.window.showOpenDialog({
            title: 'Apply Memory',
            filters: IntelHEX.DialogFilters,
            defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
        });
        if (selectedUris && selectedUris?.length > 0) {
            return { uri: selectedUris[0] };
        }
        return undefined;
    }
}
