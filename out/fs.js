'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
var DeviceNodeType;
(function (DeviceNodeType) {
    DeviceNodeType[DeviceNodeType["File"] = 0] = "File";
    DeviceNodeType[DeviceNodeType["Config"] = 1] = "Config";
    DeviceNodeType[DeviceNodeType["SectionFiles"] = 2] = "SectionFiles";
    DeviceNodeType[DeviceNodeType["SectionConfig"] = 3] = "SectionConfig";
})(DeviceNodeType || (DeviceNodeType = {}));
class DeviceFileNode {
    constructor(name, type = DeviceNodeType.File) {
        this.name = name;
        this.type = type;
    }
}
class DeviceFileSystemProvider {
    constructor(context, mos) {
        this.context = context;
        this.mos = mos;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        if (!fs.existsSync(context.storagePath)) {
            fs.mkdirSync(context.storagePath);
        }
        this.filesDir = path.join(context.storagePath, 'deviceFiles');
        if (!fs.existsSync(this.filesDir)) {
            fs.mkdirSync(this.filesDir);
        }
        this.configDir = path.join(context.storagePath, 'deviceConfig');
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir);
        }
        this.cleanupFiles = new Set();
        vscode.commands.registerCommand('deviceFS.add', () => {
            vscode.window.showInputBox({ prompt: 'File name' }).then(name => {
                const local = path.resolve(this.filesDir, name);
                mos.fsGet(name, local).then(() => {
                    vscode.window.showErrorMessage(`File ${name} already exists`);
                }, () => {
                    mos.rpc('FS.Put', JSON.stringify({ filename: name, data: '', append: false })).then(() => {
                        this.refresh();
                    }, err => {
                        vscode.window.showErrorMessage(err);
                    });
                });
            });
        });
        vscode.commands.registerCommand('deviceFS.remove', (node) => {
            mos.rpc('FS.Remove', JSON.stringify({ filename: node.name })).then(() => {
                this.refresh();
            }, err => {
                vscode.window.showErrorMessage(err);
            });
        });
        vscode.commands.registerCommand('mos.openDeviceConfig', (name) => {
            const local = path.resolve(this.configDir, 'config.json');
            mos.configGet().then(config => {
                fs.writeFileSync(local, config);
                vscode.window.showTextDocument(vscode.Uri.file(local));
            }, err => {
                vscode.window.showErrorMessage(err);
            });
        });
        vscode.commands.registerCommand('mos.openDeviceFile', (name) => {
            const local = path.resolve(this.filesDir, name);
            this.cleanupFiles.add(local);
            mos.fsGet(name, local).then(() => {
                vscode.window.showTextDocument(vscode.Uri.file(local));
            }, err => {
                vscode.window.showErrorMessage(err);
            });
        });
        vscode.workspace.onDidSaveTextDocument((document) => {
            const local = path.normalize(document.fileName);
            if (local.startsWith(this.filesDir)) {
                const remote = path.basename(document.fileName);
                mos.fsPut(remote, document.fileName).then(() => { }, err => {
                    vscode.window.showErrorMessage(err);
                });
            }
            else if (local.startsWith(this.configDir)) {
                mos.configSet(document.getText()).then(() => { }, err => {
                    vscode.window.showErrorMessage(err);
                });
            }
        });
    }
    destroy() {
        const safely = f => {
            try {
                f();
            }
            catch (e) {
                console.error(e);
            }
        };
        this.cleanupFiles.forEach(f => {
            safely(() => fs.unlinkSync(f));
        });
        safely(() => fs.unlinkSync(path.join(this.configDir, 'config.json')));
        safely(() => fs.rmdirSync(this.filesDir));
        safely(() => fs.rmdirSync(this.configDir));
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    reload() {
        return new Promise((resolve, reject) => {
            this.mos.fsList().then(files => {
                resolve(files.map(f => new DeviceFileNode(f, DeviceNodeType.File)));
            }, reject);
        });
    }
    getTreeItem(element) {
        switch (element.type) {
            case DeviceNodeType.SectionFiles:
            case DeviceNodeType.SectionConfig:
                return new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Expanded);
            case DeviceNodeType.File:
                return {
                    label: element.name,
                    contextValue: 'deviceFile',
                    command: {
                        command: 'mos.openDeviceFile',
                        arguments: [element.name],
                        title: 'Open Device File'
                    }
                };
            case DeviceNodeType.Config:
                return {
                    label: element.name,
                    command: {
                        command: 'mos.openDeviceConfig',
                        arguments: [element.name],
                        title: `Open ${element.name}`
                    }
                };
        }
    }
    getChildren(element) {
        if (!element) {
            return Promise.resolve([
                new DeviceFileNode('Configuration', DeviceNodeType.SectionConfig),
                new DeviceFileNode('Files', DeviceNodeType.SectionFiles),
            ]);
        }
        switch (element.type) {
            case DeviceNodeType.SectionConfig:
                return Promise.resolve([new DeviceFileNode('config.json', DeviceNodeType.Config)]);
            case DeviceNodeType.SectionFiles:
                return this.reload();
        }
    }
}
exports.default = DeviceFileSystemProvider;
//# sourceMappingURL=fs.js.map