'use strict';

import { spawn, ChildProcess } from 'child_process';
import { Stream } from 'stream';

import * as fs from 'fs';

import * as request from 'request';
import * as WebSocket from 'ws';

export default class MOS {
    baseUrl: string;
    request: any;
    mosProcess: ChildProcess;

    constructor(httpAddr: string) {
        let baseUrl = httpAddr;
        if (baseUrl.indexOf('://') == -1) {
            baseUrl = `http://${baseUrl}`;
        }
        if (baseUrl[baseUrl.length - 1] != '/') {
            baseUrl = `${baseUrl}/`;
        }
        this.baseUrl = baseUrl;
        this.request = request.defaults({ baseUrl: baseUrl });
        this.mosProcess = spawn('mos', ['--start-webview=false', '--start-browser=false', `--http-addr=${httpAddr}`]);
        this.mosProcess.on('error', err => console.log('mos process spawn error: ', err));
        this.mosProcess.on('close', code => console.log('mos process exited: ', code));
    }

    destroy() {
        this.mosProcess.kill();
    }

    listPorts(): Thenable<string[]> {
        return new Promise((resolve, reject) => {
            this.request('/getports', { json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                } else if (body.error) {
                    reject(body.error);
                } else {
                    resolve(body.result.Ports);
                }
            });
        });
    }

    selectPort(port: string): Thenable<string> {
        return new Promise((resolve, reject) => {
            this.request.post('/connect', { form: { port: port, reconnect: true }, json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                } else if (body.error) {
                    reject(body.error);
                } else {
                    resolve(port);
                }
            });
        });
    }

    setupWiFi(ssid: string, password: string): Thenable<string> {
        return new Promise((resolve, reject) => {
            this.request.post('/wifi', { form: { ssid: ssid, pass: password }, json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                } else if (body.error) {
                    reject(body.error);
                } else {
                    resolve(body.result);
                }
            });
        });
    }

    logs(): WebSocket.Client {
        const origin = `${this.baseUrl.replace(/^http/, 'ws')}`;
        const ws = new WebSocket(`${origin}ws`, '', { origin: origin });
        return ws;
    }

    flash(firmware: string): Thenable<any> {
        return new Promise((resolve, reject) => {
            this.request.post('/flash', { form: { firmware: firmware }, json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                } else if (body.error) {
                    reject(body.error);
                } else {
                    resolve(body.result);
                }
            });
        });
    }

    rpc(method: string, args: string): Thenable<any> {
        return new Promise((resolve, reject) => {
            this.request.post('/call', { form: { method: method, args: args }, json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                } else if (body.error) {
                    reject(body.error);
                } else {
                    resolve(body.result)
                }
            });
        });
    }

    rpcList(): Thenable<string[]> {
        return new Promise((resolve, reject) => {
            this.rpc('RPC.List', '').then(list => {
                resolve(list);
            }, reject);
        });
    }

    fsList(): Thenable<string[]> {
        return new Promise((resolve, reject) => {
            this.rpc('FS.ListExt', '').then(list => {
                resolve(list.map(f => f.name));
            }, reject);
        });
    }

    fsGet(remote: string, local: string): Thenable<void> {
        return new Promise((resolve, reject) => {
            this.request.post('/get', { form: { name: remote }, json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                } else if (body.error) {
                    reject(body.error);
                } else {
                    fs.writeFile(local, body.result, err => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    }

    fsPut(remote: string, local: string): Thenable<void> {
        return new Promise((resolve, reject) => {
            fs.readFile(local, null, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.request.post('/put', { form: { path: remote, data: data.toString() }, json: true }, (err, res, body) => {
                    if (err) {
                        reject(err);
                    } else if (body.error) {
                        reject(body.error);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    configGet(): Thenable<string> {
        return new Promise((resolve, reject) => {
            this.rpc('Config.Get', '').then(config => {
                resolve(JSON.stringify(config, null, 2));
            }, reject);
        });
    }

    configSet(config: string): Thenable<void> {
        return new Promise((resolve, reject) => {
            try {
                const configJSON = JSON.parse(config);
                this.rpc('Config.Set', JSON.stringify({ config: configJSON })).then(() => {
                    this.rpc('Config.Save', JSON.stringify({ reboot: true })).then(() => {
                        resolve();
                    }, reject);
                }, reject);
            } catch (e) {
                reject(e);
            }
        });
    }

    version(): Thenable<string> {
        return new Promise((resolve, reject) => {
            this.request('/version', { json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                } else if (body.error) {
                    reject(body.error);
                } else {
                    resolve(body.result);
                }
            });
        });
    }
}
