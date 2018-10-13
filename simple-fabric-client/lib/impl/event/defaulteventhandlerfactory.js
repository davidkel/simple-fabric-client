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

const {EventHandlerFactory} = require('../../api/eventhandler');
const DefaultTxEventHandler = require('./defaulttxeventhandler');
const EventHandlerConstants = require('./defaulteventstrategies');

class DefaultEventHandlerFactory extends EventHandlerFactory {

	constructor(channel, mspId, peerMap, options) {
		super(channel, mspId, peerMap, options || {});

		if (!this.options.timeout) {
			this.options.timeout = 60;
		}

		this.strategyMap = new Map([
			[EventHandlerConstants.MSPID_SCOPE_ALLFORTX, this._connectEventHubsForMspid],
			[EventHandlerConstants.MSPID_SCOPE_ANYFORTX, this._connectEventHubsForMspid],
			[EventHandlerConstants.CHANNEL_SCOPE_ALLFORTX, this._connectAllEventHubs],
			[EventHandlerConstants.CHANNEL_SCOPE_ANYFORTX, this._connectAllEventHubs]
		]);

		if (!this.options.strategy) {
			this.options.strategy = EventHandlerConstants.MSPID_SCOPE_ALLFORTX;
		}

		if (!this.strategyMap.has(this.options.strategy)) {
			throw new Error('unknown event handling strategy: ' + this.options.strategy);
		}
	}

	async initialize() {
		await super.initialize();
		if (!this.initialized) {
			this.useFullBlocks = this.options.useFullBlocks || this.options.chaincodeEventsEnabled;
			if (this.useFullBlocks === null || this.useFullBlocks === undefined) {
				this.useFullBlocks = false;
			}

			await this._establishEventHubsForStrategy();
			this.initialized = true;
		}
	}

	cleanup() {
		super.cleanup();
		this.initialized = false;
	}

	async _establishEventHubsForStrategy() {
		// clear out the current set of event hubs
		this.setEventHubs([]);
		const connectStrategy = this.strategyMap.get(this.options.strategy);
		await connectStrategy.call(this, this.mspId);
		if (this.getEventHubs().length === 0) {
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
	 * @memberof DefaultEventHandlerFactory
	 */
	_setupEventHubsForMspid(mspId, connectPromises) {

		//TODO: We need to have a timeout
		const orgPeers = this.peerMap.get(mspId);
		if (orgPeers.length > 0) {
			for (const orgPeer of orgPeers) {
				// TODO: could use this.channel.getChannelEventHub() or even getChannelEventHubsForOrg...
				// these associate the eventhub with the peer
				let eventHub = this.channel.newChannelEventHub(orgPeer);
				eventHub._EVH_mspId = mspId;  // insert the mspId into the object
				this.addEventHub(eventHub);
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
	 * @memberof DefaultEventHandlerFactory
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
	 * @memberof DefaultEventHandlerFactory
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
	 * @memberof DefaultEventHandlerFactory
	 */
	createTxEventHandler(txid) {
		// pass in all available eventHubs to listen on, the handler decides when to resolve based on strategy
		// a TxEventHandler should check that the available ones are usable when appropriate.
		return new DefaultTxEventHandler(this, txid);
	}
}

module.exports = DefaultEventHandlerFactory;
