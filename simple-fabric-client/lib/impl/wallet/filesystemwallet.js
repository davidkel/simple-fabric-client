/*
 Copyright 2018 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/
'use strict';

const Client = require('fabric-client');
const rimraf = require('rimraf');
const fs = require('fs-extra');
const Path = require('path');
const BaseWallet = require('./basewallet');
const FileKVS = require('fabric-client/lib/impl/FileKeyValueStore');

class FileSystemWallet extends BaseWallet {

    static async _createFileKVS(path) {
        return await new FileKVS({path});
    }

    async _isDirectory(label) {
        console.log('in isDirectory');
        try {
            console.log(this.path);
            console.log(label);
            console.log(Path.join(this.path, label));
            const stat = await fs.lstat(Path.join(this.path, label));
            console.log(stat);
            return stat.isDirectory();
        } catch(err) {
            console.log(err);
            return false;
        }
    }

    constructor(path, mixin) {
        if (!path) {
            throw new Error('No path for wallet has been provided');
        }
        super(mixin);
        this.path = path;
    }

    _getPartitionedPath(label) {
        label = this.normalizeLabel(label);
        const partitionedPath = Path.join(this.path, label);
        return partitionedPath;
    }

    async getStateStore(label) {
        const partitionedPath = this._getPartitionedPath(label);
        return FileSystemWallet._createFileKVS(partitionedPath);
    }

    async getCryptoSuite(label) {
        const partitionedPath = this._getPartitionedPath(label);
        const cryptoSuite = Client.newCryptoSuite();
        cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: partitionedPath}));
        return cryptoSuite;
    }

    async getAllLabels() {
        let dirList;
        const labelList = [];
        try {
            dirList = await fs.readdir(this.path);
            console.log(this.path, dirList);
        } catch(err) {
            return [];
        }

        if (dirList && dirList.length > 0) {
            console.log('dirlist processing');
            for (const label of dirList) {
                const isDir = await this._isDirectory(label);
                const exists = await fs.exists(Path.join(this._getPartitionedPath(label), label));
                console.log(label, isDir, exists);
                if (isDir && exists) {
                    labelList.push(label);
                }
            }
        }
        console.log('labellist', labelList);
        return labelList;
    }

    async delete(label) {
        const partitionedPath = this._getPartitionedPath(label);
        return new Promise((resolve, reject) => {
            rimraf(partitionedPath, (err) => {
                if (err) {
                    resolve(false);
                }
                resolve(true);
            });
        });
    }

    async exists(label) {
        const partitionedPath = this._getPartitionedPath(label);
        const exists = await fs.exists(partitionedPath);
        return exists;
    }
}

module.exports = FileSystemWallet;
