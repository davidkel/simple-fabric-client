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

const EventEmitter = require('events');

class Contract extends EventEmitter {

	constructor(channel, chaincodeId, functionNamespace, eventHandlerFactory, queryHandler, network) {
		super();
		this.channel = channel;
        this.chaincodeId = chaincodeId;
        this.functionNamespace = functionNamespace;
		this.eventHandlerFactory = eventHandlerFactory;
		this.network = network;
		this.queryHandler = queryHandler;

		if (this.eventHandlerFactory && this.eventHandlerFactory.chaincodeEventsEnabled()) {
			this.once('newListener', (eventName, listener) => {
				this.eventHandlerFactory.createChaincodeEventHandler(chaincodeId, eventName).on('chaincodeEvent'/* or eventName*/, (event) => {
					this.emit(eventName, event);
				});
			});
			// cleanup of the chaincode listeners is done when the network is cleaned up.
		}
	}

	/**
     * Check for proposal response errors.
     * @private
     * @param {any} responses the responses from the install, instantiate or invoke
     * @param {boolean} isProposal true is the responses are from a proposal
     * @param {regexp} pattern optional regular expression for message which isn't an error
     * @return {Object} number of ignored errors and valid responses
     * @throws if there are no valid responses at all.
     * @private
     */
	_validatePeerResponses(responses) {
		if (!responses.length) {
			throw new Error('No results were returned from the request');
		}

		const validResponses = [];
		const invalidResponses = [];
		const invalidResponseMsgs = [];

		responses.forEach((responseContent) => {
			if (responseContent instanceof Error) {
				const warning = `Response from attempted peer comms was an error: ${responseContent}`;
				invalidResponseMsgs.push(warning);
				invalidResponses.push(responseContent);
			} else {

				// not an error, if it is from a proposal, verify the response
				if (!this.channel.verifyProposalResponse(responseContent)) {
					// the node-sdk doesn't provide any external utilities from parsing the responseContent.
					// there are internal ones which may do what is needed or we would have to decode the
					// protobufs ourselves but it should really be the node sdk doing this.
					const warning = `Proposal response from peer failed verification. ${responseContent.response}`;
					invalidResponseMsgs.push(warning);
					invalidResponses.push(responseContent);
				} else if (responseContent.response.status !== 200) {
					const warning = `Unexpected response of ${responseContent.response.status}. Payload was: ${responseContent.response.payload}`;
					invalidResponseMsgs.push(warning);
				} else {
					validResponses.push(responseContent);
				}
			}
		});

		if (validResponses.length === 0) {
			const errorMessages = [ 'No valid responses from any peers.' ];
			invalidResponseMsgs.forEach(invalidResponse => errorMessages.push(invalidResponse));
			throw new Error(errorMessages.join('\n'));
		}

		return {validResponses, invalidResponses, invalidResponseMsgs};
	}

	/**
     * @param {string} transactionName transaction name
     * @param {string[]} parameters transaction parameters
     * @returns {byte[]} payload response
     */
	async evalTransaction(transactionName, parameters, txId) {
		//TODO: Need to check parameters
		if (!txId) {
			txId = this.network.getClient().newTransactionID();
		}
		const result = await this.queryHandler.queryChaincode(this.chaincodeId, transactionName, parameters, txId);
		return result ? result : null;
	}

	/**
     * @param {string} transactionName transaction name
     * @param {string[]} parameters transaction parameters
	 * @param {TransactionId} txId optional own transactionId to use
     * @returns {byte[]} payload response
     */
	async submitTransaction(transactionName, parameters, transientMap, txId) {
		//TODO: Need to check parameters

		if (!txId) {
			txId = this.network.getClient().newTransactionID();
		}

		// check the event hubs and connect any that have lost connection
		// this is non blocking check so good to do it first
		// startListening will do a more sledge hammer approach to try
		// to ensure everything is avalable. But that is upto the
		// eventhandler to implement.
		// TODO: Should we have a blocking soln here for example ?
		if (this.eventHandlerFactory) {
			this.eventHandlerFactory.checkEventHubs();
		}


        // Submit the transaction to the endorsers.
        if (this.functionNamespace) {
            transactionName = this.functionNamespace + ':' + transactionNamel;
        }
		const request = {
			chaincodeId: this.chaincodeId,
			txId,
			fcn: transactionName,
			args: parameters
		};

		// node sdk will target all peers on the channel that are endorsingPeer or do something special for a discovery environment
		const results = await this.channel.sendTransactionProposal(request);
		const proposalResponses = results[0];

		//TODO: what to do about invalidResponses
		const {validResponses} = this._validatePeerResponses(proposalResponses);
		if (validResponses.length === 0) {
			//TODO: include the invalidResponsesMsgs ?
			throw new Error('No valid responses from any peers');
		}

		// Submit the endorsed transaction to the primary orderers.
		const proposal = results[1];

		let eventHandler;
		if (this.eventHandlerFactory) {
			eventHandler = this.eventHandlerFactory.createTxEventHandler(txId.getTransactionID());
			await eventHandler.startListening();
		}

		//TODO: more to do regarding checking the response (see hlfconnection.invokeChaincode)

		const response = await this.channel.sendTransaction({
			proposalResponses: validResponses,
			proposal
		});

		if (response.status !== 'SUCCESS') {
			if (eventHandler) {
				eventHandler.cancelListening();
			}
			throw new Error(`Failed to send peer responses for transaction '${txId.getTransactionID()}' to orderer. Response status '${response.status}'`);
		}

		console.log('waiting for events');
		if (eventHandler) {
			try {
				await eventHandler.waitForEvents();
			} catch(err) {
				// TODO: Need to distinguish between Bad Peer response and something else
				if (validResponses && validResponses.length >= 2 && !this.channel.compareProposalResponseResults(validResponses)) {
					const warning = 'Peers do not agree, Read Write sets differ';
					//TODO: What should be done here
					//LOG.warn(method, warning);
				}
				throw err;
			}
		}
		console.log('got events');
		// return the payload from the invoked chaincode
		console.log('returns: ', proposalResponses[0].response.payload);

		let result = null;
		if (validResponses[0].response.payload) {
			result = validResponses[0].response.payload;
		}
		return result;

	}
}

module.exports = Contract;
