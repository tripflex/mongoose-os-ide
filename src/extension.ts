'use strict';

import * as vscode from 'vscode';

import MOS from './mos';
import DeviceFileSystemProvider from './fs';
import DocumentationProvider from './docs';

import { setTimeout } from 'timers';
import { version } from 'punycode';

class Extension implements vscode.TaskProvider {
    context: vscode.ExtensionContext;
    mos: MOS;
    currentPort: string
    currentWiFiIP: string;
    deviceFSProvider: DeviceFileSystemProvider;
    documentationProvider: DocumentationProvider;

    activate(context: vscode.ExtensionContext) {
        console.log('mos extension activated');
        this.context = context;
        this.mos = new MOS('127.0.0.1:1992');
        this.registerCommands(context);
        this.createDocumentationViewer(context);
        this.createFileSystemViewer(context);
        this.createMOSToolPicker(context);
        this.createSerialPortPicker(context);
        this.createWiFiPicker(context);
        this.createDebugConsole(context);
    }

    deactivate() {
        this.deviceFSProvider.destroy();
        this.mos.destroy();
        console.log('mos extension deactivated');
    }

    registerCommands(context: vscode.ExtensionContext) {
        vscode.workspace.registerTaskProvider('mos', this);
        const fwPath = "build/fw.zip";
        vscode.commands.registerCommand('mos.flash', () => {
            this.cwd().then(cwd => {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,
                    title: `Flashing ${fwPath}...`
                }, progress => new Promise((resolve, reject) => {
                    this.mos.flash(`${cwd.uri.fsPath}/${fwPath}`).then(resolve, reject);
                })).then(() => {
                    vscode.window.showInformationMessage('Flashed successfully!');
                }, err => {
                    vscode.window.showErrorMessage(err);
                });
            });
        });
        vscode.commands.registerCommand('mos.rpc', () => {
            vscode.window.showInputBox({ prompt: 'RPC method' }).then(method => {
                vscode.window.showInputBox({ prompt: 'RPC arguments' }).then(args => {
                    this.mos.rpc(method, args).then(res => {
                        vscode.debug.activeDebugConsole.appendLine("RPC result: " + JSON.stringify(res, null, 2));
                    }, err => {
                        vscode.window.showErrorMessage(err);
                    });
                });
            });
        });
    }

    createMOSToolPicker(context: vscode.ExtensionContext) {
        const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
        status.show();
        context.subscriptions.push(status);
        this.mos.version().then(version => {
            status.text = `MOS ${version}`;
        });
    }

    createSerialPortPicker(context: vscode.ExtensionContext) {
        const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 110);
        status.command = 'selectSerialPort';
        const update = () => {
            status.text = `$(plug) ${this.currentPort || '<select port>'}`;
            this.deviceFSProvider.refresh();
        };
        update();
        status.show();
        context.subscriptions.push(status);

        const lastKnownPort = this.context.workspaceState.get('port', '');
        if (lastKnownPort) {
            this.mos.selectPort(lastKnownPort).then(() => {
                this.currentPort = lastKnownPort;
                update();
            }, err => {
                vscode.window.showErrorMessage(`Error opening port: ${err}`);
            });
        }

        vscode.commands.registerCommand('selectSerialPort', () => {
            vscode.window.showQuickPick(this.mos.listPorts())
                .then(port => this.mos.selectPort(port))
                .then(port => {
                    this.context.workspaceState.update('port', port);
                    this.currentPort = port;
                    update();
                }, err => {
                    vscode.window.showErrorMessage(`Error opening port: ${err}`);
                    this.context.workspaceState.update('port', '');
                    this.currentPort = '';
                    update();
                });
        });
    }

    createWiFiPicker(context: vscode.ExtensionContext) {
        const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        status.command = 'setupWiFi';
        const update = () => {
            status.text = `$(radio-tower) ${this.currentWiFiIP || '<setup WiFi>'}`;
        };
        update();
        status.show();
        context.subscriptions.push(status);

        vscode.commands.registerCommand('setupWiFi', () => {
            vscode.window.showInputBox({ prompt: 'WiFi SSID' }).then(ssid => {
                vscode.window.showInputBox({ prompt: 'WiFi Password', password: true }).then(password => {
                    this.mos.setupWiFi(ssid, password).then(ip => {
                        this.currentWiFiIP = ip;
                        update();
                        vscode.window.showInformationMessage('WiFi configured: IP ' + ip);
                    }, err => {
                        vscode.window.showErrorMessage(err);
                    });
                });
            });
        });
        return status;
    }

    createDebugConsole(context: vscode.ExtensionContext) {
        setTimeout(() => {
            this.mos.logs().on('message', s => {
                try {
                    const msg = JSON.parse(s);
                    vscode.debug.activeDebugConsole.appendLine(msg.data.replace(/\s*$/, ''));
                } catch (e) {
                    console.log(e);
                }
            }).on('error', err => {
                vscode.window.showErrorMessage(`Websocket error: ${err}`);
            });
        }, 500);
    }

    createFileSystemViewer(context: vscode.ExtensionContext) {
        this.deviceFSProvider = new DeviceFileSystemProvider(context, this.mos);
        vscode.window.registerTreeDataProvider('deviceFS', this.deviceFSProvider);
        vscode.commands.registerCommand('deviceFS.refresh', () => this.deviceFSProvider.refresh());
    }

    createDocumentationViewer(context: vscode.ExtensionContext) {
        this.documentationProvider = new DocumentationProvider(context, this.mos);
    }

    provideTasks(token?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
        return new Promise((resolve, reject) => {
            this.cwd().then(cwd => {
                let buildTask = new vscode.Task(
                    { type: 'mos' }, cwd, 'Build', 'mos',
                    new vscode.ProcessExecution('mos', ['build']),
                    '$mosBuildMatcher'
                );
                buildTask.group = vscode.TaskGroup.Build;

                let buildLocalTask = new vscode.Task(
                    { type: 'mos' }, cwd, 'Build (local)', 'mos',
                    new vscode.ProcessExecution('mos', ['build', '--local']),
                    '$mosBuildMatcher'
                );
                // buildLocalTask.group = vscode.TaskGroup.Build;
                resolve([buildTask, buildLocalTask]);
            }, reject);
        });
    }

    resolveTask(task: vscode.Task, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
        return null;
    }

    cwd(): Thenable<vscode.WorkspaceFolder> {
        return new Promise((resolve, reject) => {
            vscode.workspace.findFiles('**/mos.yml', '', 1).then(f => {
                resolve(vscode.workspace.getWorkspaceFolder(f[0]));
            }, reject);
        });
    }
}

const extension = new Extension();

export function activate(context: vscode.ExtensionContext) {
    extension.activate(context);
}

export function deactivate() {
    extension.deactivate();
}