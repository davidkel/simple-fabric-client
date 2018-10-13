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



class EventHandlerFactory {

	constructor(channel, mspId, peerMap, options) {
		this.channel = channel;
		this.peerMap = peerMap;
		this.options = options;
		this.mspId = mspId;

		// available event hubs, not necessarily connected event hubs, just ones that
		// are available to be tried
		//TODO: how should this be stored and returned for end users to use.
	}

	async initialize() {
		this.availableEventHubs = [];
		return;
	}

	cleanup() {
		this.disconnectEventHubs();
		this.availableEventHubs = [];
		return;
	}

	addEventHub(eventHub) {
		this.availableEventHubs.push(eventHub);
	}

	getEventHubs() {
		return this.availableEventHubs;
	}

	setEventHubs(availableEventHubs) {
		this.availableEventHubs = availableEventHubs;
	}

	/**
     * check the status of the event hubs and attempt to reconnect any event hubs.
	 * This is a non waitable request, should we have a waitable one ?
     */
	checkEventHubs() {
		for(const hub of this.availableEventHubs) {
			hub.checkConnection(true);
		}
	}

	disconnectEventHubs() {
		for (const hub of this.availableEventHubs) {
			try {
				hub.disconnect();
			} catch (error) {
				//
			}
		}
	}

	createTxEventHandler(txid) {
		throw new Error('not implemented');
	}


	// Stretch goal stuff for chaincode event handling
	chaincodeEventsEnabled() {
		return false;
	}

	createChaincodeEventHandler(chaincodeId, eventName) {
		throw new Error('not implemented');
	}

}


class TxEventHandler {

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


module.exports = {
	EventHandlerFactory,
	TxEventHandler
};
