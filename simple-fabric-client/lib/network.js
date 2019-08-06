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
const Ledger = require('./ledger');
const logger = require('./logger').getLogger('Network');
const utils = require('./utils');


//TODO: Overall todos
// 1. Better discovery plus discovery that when changes everything dynamically adapts
// 2. implement the event listener part
// 3. better response handling including errors

class Network {

    constructor() {
        logger.debug('in Network constructor');
        this.client = null;
        this.wallet = null;
        this.ledgers = new Map();

        // default options (plugin options are not defaulted here as may not be applicable if plugin changed)
        this.options = {
            // the default event manager
            eventManager: './impl/event/defaulteventmanager',
            // the default query handler
            queryHandler: './impl/query/defaultqueryhandler',
            // TODO: discovery-cache-age (only used by getDiscoveryResults)
            // TODO: We need a timeout when submitTransaction is called to determine if a refresh should
            // be made.
            useDiscovery: false,
            discoveryOptions: {
                // These are the defaults set by the node-sdk, can use env vars
                // or programmatically specify through the options.
                // discoveryProtocol: 'grpcs',
                // asLocalhost: false
                // discoveryRefresh: 300000 (TODO: on a timeout or only when submit is done ?)
            },
            // verify proposal responses
            verifyResponses: false,
            // compare proposal responses
            compareResponses: false
        };
    }

    /**
     * initialize the network with a connection profile (either for static purposes or for initial discovery info)
     *
     * @param {*} ccp
     * @param {*} options
     */
    async initialize(ccp, options) {
        if (!options || (!options.wallet && !options.identity)) {
            throw new Error('A wallet and identity must be assigned to a Network instance');
        }

        utils._mergeOptions(this.options, options);

        // require the event manager and query handler plugins
        if (this.options.eventManager) {
            try {
                this.eventManagerClass = require(this.options.eventManager);
            } catch(error) {
                console.log(error);
                throw new Error('unable to load provided event manager: ' + this.options.eventManager);
            }
        }

        if (this.options.queryHandler) {
            try {
                this.queryHandlerClass = require(this.options.queryHandler);
            } catch(error) {
                console.log(error);
                throw new Error('unable to load provided query handler: ' + this.options.queryHandler);
            }
        }

        // These are global to the app, but would assume you won't want a mixture of discover and non discover
        if (this.options.useDiscovery && this.options.discoveryOptions && this.options.discoveryOptions.discoveryProtocol) {
            Client.setConfigSetting('discovery-protocol', this.options.discoveryOptions.discoveryProtocol);
        }

        if (!(ccp instanceof Client)) {
            // still use a ccp for the discovery peer and ca information
            this.client = Client.loadFromConfig(ccp);
        }

        this.currentIdentity = await options.wallet.setUserContext(this.client, options.identity);

        if (options.clientTls) {
            if (options.clientTls.identity) {
                const tlsIdentity = await options.wallet.export(options.clientTls.identity);
                //TODO: Does export throw an error or should I check tlsIdentity ?
                this.client.setTlsClientCertAndKey(tlsIdentity.certificate, tlsIdentity.privateKey);
            } else if (options.clientTls.certificate && options.clientTls.key) {
                this.client.setTlsClientCertAndKey(options.clientTls.certificate, options.clientTls.key);

            } else {
                throw new Error('client TLS option set but no wallet label or cert/key provided');
            }
        }
    }

    /**
     * Allows you to set the identity after network initialization, may remove.
     *
     * @param {*} newIdentity
     * @memberof Network
     */
    /*
    async setIdentity(newIdentity) {
        //TODO: what to do if mspId changes ? all contracts are not useable as the default query peers and maybe the event
        // hubs are tied to a specific mspId. What happens if users write their own handlers ?
        // What happens if you are in the middle of interacting with a contract ?
        // also what if you are using ABAC and swap identities ? even if the mspId doesn't change.
        // Think this all boils down to the fact you cannot switch identities, you can only set it once
        if (this.currentIdentity) {
            throw new Error('The identity for this network has already been set. It cannot be changed');
        }
        this.currentIdentity = await this.options.wallet.setUserContext(this.client, newIdentity);
    }
    */

    /**
     * get the current identity
     *
     * @returns
     */
    getCurrentIdentity() {
        return this.currentIdentity;
    }

    /**
     * get the underlying client instance
     *
     * @returns
     */
    getClient() {
        return this.client;
    }


    getOptions() {
        return this.options;
    }

    // create an instance of the event manager and initialise it.
    async _createEventManager(channel, peerMap) {

        if (this.eventManagerClass) {
            // const currentmspId = this.getCurrentIdentity()_mspId;
            const currentmspId = this.getCurrentIdentity().getIdentity().getMSPId();
            const eventManager = new this.eventManagerClass(
                channel,
                currentmspId,
                peerMap,
                this.options.eventMgmtOptions
            );
            await eventManager.initialize();
            return eventManager;
        }
        return null;
    }

    // create an instance of the query handler and initialise it.
    async _createQueryHandler(channel, peerMap) {
        if (this.queryHandlerClass) {
            // const currentmspId = this.getCurrentIdentity()._mspId;
            const currentmspId = this.getCurrentIdentity().getIdentity().getMSPId();
            const queryHandler = new this.queryHandlerClass(
                channel,
                currentmspId,
                peerMap,
                this.options.queryHandlerOptions
            );
            await queryHandler.initialize();
            return queryHandler;
        }
        return null;
    }

    /**
     * clean up this network in prep for it to be discarded and garbage collected
     *
     * @memberof Network
     */
    dispose() {
        for (const ledger of this.ledgers.values()) {
            ledger._dispose();
        }
        this.ledgers.clear();
    }

    // get a ledger initialise it and cache it, otherwise use the cached version
    async getLedger(channelName) {
        const existingLedger = this.ledgers.get(channelName);
        if (existingLedger) {
            return existingLedger;
        }

        let channel = this.client.getChannel(channelName, false);
        if (channel === null) {
            channel = this.client.newChannel(channelName);
        }

        const newLedger = new Ledger(this, channel);
        await newLedger._initialize();
        this.ledgers.set(channelName, newLedger);
        return newLedger;

    }
}

module.exports = Network;
