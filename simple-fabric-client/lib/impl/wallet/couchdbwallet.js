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
const CouchDBKVStore = require('fabric-client/lib/impl/CouchDBKeyValueStore');
const BaseWallet = require('./basewallet');
const Nano = require('nano');

const PREFIX = '$identity_$';
class CouchDBWallet extends BaseWallet {

	// {url: 'http://localhost:5984'}
	constructor(options, mixin) {
		super(mixin);
		this.options = options;
		this.couch = Nano(options.url);
		this.dbOptions = {};
		Object.assign(this.dbOptions, this.options);
	}

	_createOptions(label) {
		label = this.normalizeLabel(label);
		const dbOptions = {};
		Object.assign(dbOptions, this.options);
		dbOptions.name = PREFIX + label;
		return dbOptions;
	}

	async getStateStore(label) {
		const store = await new CouchDBKVStore(this._createOptions(label));
		return store;
	}

	async getCryptoSuite(label) {
		const cryptoSuite = Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(CouchDBKVStore, this._createOptions(label)));
		return cryptoSuite;
	}

	async delete(label) {
		label = this.normalizeLabel(label);
		const name = PREFIX + label;
		return new Promise((resolve, reject) => {
			this.couch.db.destroy(name, (err) => {
				if (err === null) {
					resolve(true);
				}
				resolve(false);
			});
		});
	}

	async exists(label) {
		label = this.normalizeLabel(label);
		const name = PREFIX + label;
		return new Promise((resolve, reject) => {
			this.couch.db.get(name, (err) => {
				if (err === null) {
					resolve(true);
				}
				resolve(false);
			});
		});
	}

	async getAllLabels(hint = null) {
		this.couch.db.list((err, list) => {
			return list.map((entry) => {
				if (entry.startsWith(PREFIX)) {
					return entry.substring(PREFIX.length);
				}
			});
		});
		return null;
	}
}

module.exports = CouchDBWallet;
