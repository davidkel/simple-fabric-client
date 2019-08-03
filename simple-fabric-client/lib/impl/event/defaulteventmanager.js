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

const {EventManager} = require('../../api/eventmanagement');
const DefaultCommitHandler = require('./defaultcommithandler');
const DefaultCommitStrategies = require('../../defaultcommitstrategies');

class DefaultEventManager extends EventManager {

    constructor(channel, mspId, peerMap, options) {
        super(channel, mspId, peerMap, options || {});

        const defaultEventMgmtOptions = {
            commitStrategy: DefaultCommitStrategies.MSPID_SCOPE_ALLFORTX,
            commitTimeout: 60,  // rename to commitTimeout
            useFullBlocksForAll: true  // Not sure yet about this one may not for tx commit only
        };

        // TODO: do an options merge
        if (!this.options.commitStrategy) {
            this.options.commitStrategy = defaultEventMgmtOptions.commitStrategy;
        }

        if (!this.options.commitTimeout) {
            this.options.commitTimeout = defaultEventMgmtOptions.commitTimeout;
        }

        // define the handler which creates and connects event hubs for the particular
        // commit strategy.
        this.strategyMap = new Map([
            [DefaultCommitStrategies.MSPID_SCOPE_ALLFORTX, this._connectEventHubsForMspid],
            [DefaultCommitStrategies.MSPID_SCOPE_ANYFORTX, this._connectEventHubsForMspid],
            [DefaultCommitStrategies.CHANNEL_SCOPE_ALLFORTX, this._connectAllEventHubs],
            [DefaultCommitStrategies.CHANNEL_SCOPE_ANYFORTX, this._connectAllEventHubs]
        ]);

        if (!this.strategyMap.has(this.options.commitStrategy)) {
            throw new Error('unknown event handling strategy: ' + this.options.commitStrategy);
        }
    }

    addCommitEventHub(eventHub) {
        this.availableCommitEventHubs.push(eventHub);
    }

    getCommitEventHubs() {
        return this.availableCommitEventHubs;
    }

    setCommitEventHubs(availableCommitEventHubs) {
        this.availableCommitEventHubs = availableCommitEventHubs;
    }

    /**
     * check the status of the event hubs and attempt to reconnect any event hubs.
     * This is a non waitable request, should we have a waitable one ?
     */
    _checkCommitEventHubs() {
        for(const hub of this.availableCommitEventHubs) {
            hub.checkConnection(true);
        }
    }

    disconnectEventHubs() {
        for (const hub of this.availableCommitEventHubs) {
            try {
                hub.disconnect();
            } catch (error) {
                //
            }
        }
    }

    async initialize() {
        this.availableCommitEventHubs = [];

        if (!this.initialized) {
            this.useFullBlocks = this.options.useFullBlocksForAll;
            if (this.useFullBlocks === null || this.useFullBlocks === undefined) {
                this.useFullBlocks = false;
            }

            await this._establishEventHubsForStrategy();
            this.initialized = true;
        }
    }

    async dispose() {
        this.disconnectEventHubs();
        this.availableCommitEventHubs = [];
        this.initialized = false;
    }

    async _establishEventHubsForStrategy() {
        // clear out the current set of event hubs
        this.setCommitEventHubs([]);
        const connectStrategy = this.strategyMap.get(this.options.strategy);
        await connectStrategy.call(this, this.mspId);
        if (this.getCommitEventHubs().length === 0) {
            throw new Error('No available event hubs found for strategy');
        }
    }


    //TODO: These methods could go into the superclass maybe ?
    /**
     * Set up the event hubs for peers of a specific mspId and put the
     * promises of each into the supplied array
     *
     * @param {*} mspId
     * @param {*} connectPromises
     */
    _setupEventHubsForMspid(mspId, connectPromises) {

        //TODO: We need to have a timeout
        const orgPeers = this.peerMap.get(mspId);
        if (orgPeers.length > 0) {
            for (const orgPeer of orgPeers) {
                // TODO: could use this.channel.getChannelEventHub() or even getChannelEventHubsForOrg...
                // these associate the eventhub with the peer
                // TODO: Need to add a timeout
                let eventHub = this.channel.newChannelEventHub(orgPeer);
                eventHub._EVH_mspId = mspId;  // insert the mspId into the object
                this.addCommitEventHub(eventHub);
                let connectPromise = new Promise((resolve, reject) => {
                    const regId = eventHub.registerBlockEvent(
                        (block) => {
                            console.log(new Date(), 'got block event');
                            eventHub.unregisterBlockEvent(regId);
                            resolve();
                        },
                        (err) => {
                            console.log(new Date(), 'got error', err);
                            eventHub.unregisterBlockEvent(regId);
                            resolve();
                        }
                    );
                });
                connectPromises.push(connectPromise);
                eventHub.connect(this.useFullBlocks);
            }
        }
    }

    /**
     * set up the event hubs for peers of the specified mspid and wait for them to
     * either connect successfully or fail
     *
     * @param {*} mspId
     */
    async _connectEventHubsForMspid(mspId) {
        let connectPromises = [];
        this._setupEventHubsForMspid(mspId, connectPromises);
        if (connectPromises.length > 0) {
            console.log('waiting for mspid event hubs to connect or fail to connect', connectPromises);
            await Promise.all(connectPromises);
        }
    }

    /**
     * set up the event hubs for all the peers and wait for them to
     * either connect successfully or fail
     *
     * @param {*} mspId
     */
    async _connectAllEventHubs(mspId) {
        console.log('in _connectAllEventHubs');
        let connectPromises = [];
        for (const mspId of this.peerMap.keys()) {
            this._setupEventHubsForMspid(mspId, connectPromises);
        }
        if (connectPromises.length > 0) {
            console.log('waiting for all event hubs to connect or fail to connect', connectPromises);
            await Promise.all(connectPromises);
        }
    }

    /**
     * create an Tx Event handler for the specific txid
     *
     * @param {*} txid
     * @returns
     */
    createCommitHandler(txid) {
        // pass in all available eventHubs to listen on, the handler decides when to resolve based on strategy
        // a CommitHandler should check that the available ones are usable when appropriate.
        return new DefaultCommitHandler(this, txid);
    }

    createEventListener() {
    //  return new DefaultEventListener(this);
    }
}

module.exports = DefaultEventManager;
