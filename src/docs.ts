'use strict';

import * as vscode from 'vscode';
import * as Markdown from 'markdown-it';
import * as path from 'path';
import * as fs from 'fs';

import MOS from './mos';

export default class DocumentationProvider implements vscode.TextDocumentContentProvider {
    symbols: any = { languages: { c: [], javascript: [] } };
    md: any;
    constructor(public context: vscode.ExtensionContext, public mos: MOS) {
        this.md = new Markdown();
        const symbolsPath = path.join(context.extensionPath, 'symbols', 'symbols.json')
        try {
            const symbolsData = fs.readFileSync(symbolsPath)
            const symbols = JSON.parse(symbolsData.toString());
            console.log(`autocompletion: loaded ${symbols.length} functions`);
            this.symbols.languages.c = symbols.filter(sym => /\.h$/.test(sym.file));
            this.symbols.languages.javascript = symbols.filter(sym => /\.js$/.test(sym.file));
            console.log(`autocompletion: ${this.symbols.languages.c.length} C funcitons, ${this.symbols.languages.javascript.length} JS functions.`)
        } catch (err) {
            vscode.window.showErrorMessage(err);
        }
        vscode.workspace.registerTextDocumentContentProvider('mos-docs', this);
        vscode.commands.registerCommand('mos.showDocs', () => {
            const ed = vscode.window.activeTextEditor;
            const range = ed.document.getWordRangeAtPosition(ed.selection.start)
            const word = ed.document.getText(range);
            const previewUri = vscode.Uri.parse(`mos-docs://symbol?${ed.document.languageId}#${word}`);
            vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'Mongoose OS Documentation');
        });

        vscode.languages.registerCompletionItemProvider('javascript', this.completion('javascript'));
        vscode.languages.registerCompletionItemProvider('c', this.completion('c'));
        vscode.languages.registerCompletionItemProvider('cpp', this.completion('c'));
    }

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        const word = uri.fragment;
        let doc = '_Not found_';
        let file = '';
        let line = 0;
        let proto = word;
        this.symbols.languages[uri.query || 'c'].forEach(sym => {
            if (sym.name == word) {
                doc = sym.doc || '_No documentation provided_';
                proto = sym.proto || word;
                file = sym.file;
                line = sym.line;
            }
        });
        return `
                <html>
                    <body>
                        <h2>${proto}</h2>
                        <p>
                            ${this.md.render(doc)}
                        </p>
                        <p>${file ? (file + ':' + line) : ''}</p>
                    </body>
                </html>
                `
    }

    completion(lang: string) {
        return {
            provideCompletionItems: (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) => {
                return this.symbols.languages[lang].map(sym => {
                    const item = new vscode.CompletionItem(sym.name);
                    item.detail = `${sym.file}:${sym.line}`;
                    item.documentation = new vscode.MarkdownString(sym.doc);
                    return item;
                });
            }
        };
    }
}
