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

//TODO: Push this into the node sdk KeyValueStore. Potential API consideration
//new methods have to be optional and as such cannot be managed by the network stuff


const api = require('fabric-client/lib/api');
const Logger = require('composer-common').Logger;
const KeyValueStore = api.KeyValueStore;

class ExtendedKeyValueStore extends KeyValueStore {

    /**
     * Constructor.
     * @param {Wallet} wallet The wallet to use.
     */
    constructor(kvStore) {
        super();
        this.kvStore = kvStore;
        return Promise.resolve(this);
    }

    /**
     * Get the value associated with name.
     * @param {string} name of the key
     * @returns {Promise} Promise for the value corresponding to the key.
     * If the value does not exist in the store, returns null without
     * rejecting the promise
     */
    async getValue(name) {
        return this.kvStore.getValue();
    }

    /**
     * Set the value associated with name.
     * @param {string} name of the key to save
     * @param {string} value to save
     * @returns {Promise} Promise for the 'value' object upon successful write operation
     */
    async setValue(name, value) {
        return this.kvStore.setValue();
    }

    async deleteValue(name) {
        throw new Error('unimplemented');
    }

}

module.exports = ExtendedKeyValueStore;