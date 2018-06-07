'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
class DocumentationProvider {
    constructor(context, mos) {
        this.context = context;
        this.mos = mos;
        this.symbols = { languages: { c: [], js: [] } };
        const symbolsPath = path.join(context.extensionPath, 'symbols', 'symbols.json');
        try {
            const symbolsData = fs.readFileSync(symbolsPath);
            this.symbols = JSON.parse(symbolsData.toString());
            console.log(`autocompletion: ${this.symbols.languages.c.length} C funcitons, ${this.symbols.languages.javascript.length} JS functions.`);
        }
        catch (err) {
            vscode.window.showErrorMessage(err);
        }
        vscode.workspace.registerTextDocumentContentProvider('mos-docs', this);
        vscode.commands.registerCommand('mos.showDocs', () => {
            const ed = vscode.window.activeTextEditor;
            const range = ed.document.getWordRangeAtPosition(ed.selection.start);
            const word = ed.document.getText(range);
            const previewUri = vscode.Uri.parse(`mos-docs://symbol?${ed.document.languageId}#${word}`);
            vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'Mongoose OS Documentation');
        });
        vscode.languages.registerCompletionItemProvider('javascript', this.completion('javascript'));
        vscode.languages.registerCompletionItemProvider('c', this.completion('c'));
        vscode.languages.registerCompletionItemProvider('cpp', this.completion('c'));
    }
    provideTextDocumentContent(uri, token) {
        const word = uri.fragment;
        let doc = '<i>Not found</i>';
        let file = '';
        let line = 0;
        let proto = word;
        this.symbols.languages[uri.query || 'c'].forEach(sym => {
            if (sym.name == word) {
                doc = sym.doc || '<i>No documentation provided</i>';
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
                            ${doc}
                        </p>
                        <p>${file ? (file + ':' + line) : ''}</p>
                    </body>
                </html>
                `;
    }
    completion(lang) {
        return {
            provideCompletionItems: (document, position, token, context) => {
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
exports.default = DocumentationProvider;
//# sourceMappingURL=docs.js.map