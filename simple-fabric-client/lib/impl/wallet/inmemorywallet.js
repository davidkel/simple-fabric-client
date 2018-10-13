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
const BaseWallet = require('./basewallet');
const api = require('fabric-client/lib/api.js');

// this will be shared across all instance of a memory wallet, so really an app should
// only have one instance otherwise if you put 2 different identities with the same
// label it will overwrite the existing one.
const memoryStore = new Map();

class InMemoryWallet extends BaseWallet {

	async getStateStore(label) {
		label = this.normalizeLabel(label);
		const store = await new InMemoryKVS(label);
		return store;
	}

	async getCryptoSuite(label) {
		label = this.normalizeLabel(label);
		const cryptoSuite = Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore(InMemoryKVS, label));
		return cryptoSuite;
	}

	async delete(label) {
		label = this.normalizeLabel(label);
		memoryStore.delete(label);
	}

	async exists(label) {
		label = this.normalizeLabel(label);
		return memoryStore.has(label);
	}

	async getAllLabels() {
		return Array.from(memoryStore.keys());
	}
}

class InMemoryKVS extends api.KeyValueStore {

	/**
	 * constructor
	 *
	 * @param {Object} options contains a single property <code>path</code> which points to the top-level directory
	 * for the store
	 */
	constructor(prefix) {
		super();
		this.partitionKey = prefix;
		return Promise.resolve(this);
	}

	async getValue(name) {
		const idStore = memoryStore.get(this.partitionKey);
		if (!idStore) {
			return null;
		}
		return idStore.get(name);
	}

	async setValue(name, value) {
		let idStore = memoryStore.get(this.partitionKey);
		if (!idStore) {
			idStore = new Map();
		}
		idStore.set(name, value);
		memoryStore.set(this.partitionKey, idStore);
		return value;
	}
}

module.exports = InMemoryWallet;
