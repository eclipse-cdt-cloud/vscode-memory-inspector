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

// const HEX_EDITOR_EXTENSION_ID = 'ms-vscode.hexeditor';
// const HEX_EDITOR_EDITOR_ID = 'hexEditor.hexedit';


import * as vscode from 'vscode';
import * as manifest from './manifest';
import { MemoryDocument } from './memory-document';

export class EditorProvider implements vscode.CustomEditorProvider<MemoryDocument> {
	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<MemoryDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    public activate() {
        vscode.window.registerCustomEditorProvider(manifest.EDITOR_NAME, this);
    }

    public saveCustomDocument(document: MemoryDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        throw new Error('Method not implemented.');
        // await document.save(cancellation);
    }

    public saveCustomDocumentAs(document: MemoryDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
        throw new Error('Method not implemented.');
        // return document.saveAs(destination, cancellation);
    }

    public revertCustomDocument(document: MemoryDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        throw new Error('Method not implemented.');
        // return document.revert(cancellation);
    }

    public backupCustomDocument(document: MemoryDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
        throw new Error('Method not implemented.');
        // return document.backup(context.destination);
    }

    public openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): MemoryDocument {
        throw new Error('Method not implemented.');

        /*
        vscode-debug-memory://<session ID>/<memoryReference>/memory.bin
        return URI.from({
            scheme: DEBUG_MEMORY_SCHEME, // vscode-debug-memory
            authority: sessionId,  // debug session ID
            path: '/' + encodeURIComponent(memoryReference) + `/${encodeURIComponent(displayName)}.bin`,  // memoryReference=debugprotocol.variable.memoryReference, dispolayName =memory
            query: range ? `?range=${range.fromOffset}:${range.toOffset}` : undefined, range=undefined
        });

*/
        // const { document, accessor } = await HexDocument.create(uri, openContext, this._telemetryReporter);
    }

    public resolveCustomEditor(document: MemoryDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {
        throw new Error('Method not implemented.');
        // Add html to panel
    }
}
