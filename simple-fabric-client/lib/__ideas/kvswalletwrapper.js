/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const api = require('fabric-client/lib/api');
const KeyValueStore = api.KeyValueStore;

/**
 * A class that implements a proxy between the Hyperledger Fabric,
 * key/value store, using the hfc module, and the Composer wallet.
 */
class KVSWalletWrapper extends KeyValueStore {

	/**
     * Constructor.
     * @param {Wallet} wallet The wallet to use.
     */
	constructor(wallet) {
		super();
		this.wallet = wallet;
		return Promise.resolve(this);
	}

	/**
     * Get the value associated with name.
     * @param {string} name of the key
     * @returns {Promise} Promise for the value corresponding to the key.
     * If the value does not exist in the store, returns null without
     * rejecting the promise
     */
	getValue(name) {
		return this.wallet.exists(name)
			.then((result) => {
				if (result) {
					return this.wallet.get(name);
				} else {
					return null;
				}
			})
			.then((value) => {
				return value;
			})
			.catch((error) => {
				throw error;
			});
	}

	/**
     * Set the value associated with name.
     * @param {string} name of the key to save
     * @param {string} value to save
     * @returns {Promise} Promise for the 'value' object upon successful write operation
     */
	setValue(name, value) {
		return this.wallet.put(name,value)
			.then(() => {
			})
			.catch((error) => {
				throw error;
			});
	}

}

module.exports = KVSWalletWrapper;
