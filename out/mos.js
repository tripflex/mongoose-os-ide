'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs = require("fs");
const request = require("request");
const WebSocket = require("ws");
class MOS {
    constructor(httpAddr) {
        let baseUrl = httpAddr;
        if (baseUrl.indexOf('://') == -1) {
            baseUrl = `http://${baseUrl}`;
        }
        if (baseUrl[baseUrl.length - 1] != '/') {
            baseUrl = `${baseUrl}/`;
        }
        this.baseUrl = baseUrl;
        this.request = request.defaults({ baseUrl: baseUrl });
        this.mosProcess = child_process_1.spawn('mos', ['--start-webview=false', '--start-browser=false', `--http-addr=${httpAddr}`]);
        this.mosProcess.on('error', err => console.log('mos process spawn error: ', err));
        this.mosProcess.on('close', code => console.log('mos process exited: ', code));
    }
    destroy() {
        this.mosProcess.kill();
    }
    listPorts() {
        return new Promise((resolve, reject) => {
            this.request('/getports', { json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                }
                else if (body.error) {
                    reject(body.error);
                }
                else {
                    resolve(body.result.Ports);
                }
            });
        });
    }
    selectPort(port) {
        return new Promise((resolve, reject) => {
            this.request.post('/connect', { form: { port: port, reconnect: true }, json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                }
                else if (body.error) {
                    reject(body.error);
                }
                else {
                    resolve(port);
                }
            });
        });
    }
    setupWiFi(ssid, password) {
        return new Promise((resolve, reject) => {
            this.request.post('/wifi', { form: { ssid: ssid, pass: password }, json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                }
                else if (body.error) {
                    reject(body.error);
                }
                else {
                    resolve(body.result);
                }
            });
        });
    }
    logs() {
        const origin = `${this.baseUrl.replace(/^http/, 'ws')}`;
        const ws = new WebSocket(`${origin}ws`, '', { origin: origin });
        return ws;
    }
    flash(firmware) {
        return new Promise((resolve, reject) => {
            this.request.post('/flash', { form: { firmware: firmware }, json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                }
                else if (body.error) {
                    reject(body.error);
                }
                else {
                    resolve(body.result);
                }
            });
        });
    }
    rpc(method, args) {
        return new Promise((resolve, reject) => {
            this.request.post('/call', { form: { method: method, args: args }, json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                }
                else if (body.error) {
                    reject(body.error);
                }
                else {
                    resolve(body.result);
                }
            });
        });
    }
    rpcList() {
        return new Promise((resolve, reject) => {
            this.rpc('RPC.List', '').then(list => {
                resolve(list);
            }, reject);
        });
    }
    fsList() {
        return new Promise((resolve, reject) => {
            this.rpc('FS.ListExt', '').then(list => {
                resolve(list.map(f => f.name));
            }, reject);
        });
    }
    fsGet(remote, local) {
        return new Promise((resolve, reject) => {
            this.request.post('/get', { form: { name: remote }, json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                }
                else if (body.error) {
                    reject(body.error);
                }
                else {
                    fs.writeFile(local, body.result, err => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve();
                        }
                    });
                }
            });
        });
    }
    fsPut(remote, local) {
        return new Promise((resolve, reject) => {
            fs.readFile(local, null, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.request.post('/put', { form: { path: remote, data: data.toString() }, json: true }, (err, res, body) => {
                    if (err) {
                        reject(err);
                    }
                    else if (body.error) {
                        reject(body.error);
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
    configGet() {
        return new Promise((resolve, reject) => {
            this.rpc('Config.Get', '').then(config => {
                resolve(JSON.stringify(config, null, 2));
            }, reject);
        });
    }
    configSet(config) {
        return new Promise((resolve, reject) => {
            try {
                const configJSON = JSON.parse(config);
                this.rpc('Config.Set', JSON.stringify({ config: configJSON })).then(() => {
                    this.rpc('Config.Save', JSON.stringify({ reboot: true })).then(() => {
                        resolve();
                    }, reject);
                }, reject);
            }
            catch (e) {
                reject(e);
            }
        });
    }
    version() {
        return new Promise((resolve, reject) => {
            this.request('/version', { json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                }
                else if (body.error) {
                    reject(body.error);
                }
                else {
                    resolve(body.result);
                }
            });
        });
    }
}
exports.default = MOS;
//# sourceMappingURL=mos.js.map