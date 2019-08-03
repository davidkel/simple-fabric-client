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


/*
 * This file provides the API specifications for event handling in fabric-network
 */


/*
 * Purpose of the event handler factory: life cycle is managed by the ledger object
 * as the ledger as the ledger === channel and event management is at a channel level.
 * The factory owns the event hubs being used for the particular strategy.
 */
class EventManager {

    /**
     *
     * @param {*} channel The channel to use
     * @param {*} mspId the mspid of the application owner
     * @param {*} peerMap a map of all the peers by mspid
     * @param {*} options plugin specific options
     */
    constructor(channel, mspId, peerMap, options) {
        this.channel = channel;
        this.peerMap = peerMap;
        this.options = options;
        this.mspId = mspId;
    }

    /**
     * initialise the factory. This would establish the event hubs to be used
     * perhaps based on options and mspids
     */
    async initialize() {
        throw new Error('not implemented');
    }

    /**
     * dispose of this factory and perform any cleanup required
     */
    async dispose() {
        throw new Error('not implemented');
    }

    /**
     * create a tx event handler for the specific transaction id.
     * @param {string} txid Transaction id
     */
    createCommitHandler(txid) {
        throw new Error('not implemented');
    }

    createEventListener() {
        throw new Error('not implemented');
    }
}


class CommitHandler {

    checkEventHubs() {
        // optional fast check of the event hubs
    }

    /**
     * Start listening for events.
     */
    async startListening() {
        throw new Error('Not implemented');
    }

    /**
     * wait for all event hubs to send the tx event.
     * @returns {Promise} a promise which is resolved when all the events have been received, rejected if an error occurs.
     */
    async waitForEvents() {
        throw new Error('Not implemented');
    }

    /**
     * cancel listening for events
     */
    cancelListening() {
        throw new Error('Not implemented');
    }
}

class EventListener {
    registerBlockListener(callback) {

    }

    unRegisterBlockListener(handle) {

    }

    registerCCListener(chaincodeId, callback) {

    }

    unRegisterCCListener(handle) {

    }

    registerTxListener(txid, callback) {

    }

    unRegisterTxListener(handle) {

    }

}


module.exports = {
    EventManager,
    CommitHandler,
    EventListener
};
