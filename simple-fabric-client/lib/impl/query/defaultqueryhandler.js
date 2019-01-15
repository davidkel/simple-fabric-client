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
//const FABRIC_CONSTANTS = require('fabric-client/lib/Constants');
const QueryHandler = require('../../api/queryhandler');

/**
 * Class to provide intelligence on how to query peers when peers are not available.
 * This is an initial implementation which could iterate and perhaps be pushed back
 * into the fabric node-sdk in future
 *
 * The current implementation creates a list of query peers. The top of the list
 * contains peers for the callers org, followed by peers in all other orgs.
 * It will search through the list looking for a peer to respond successfully to
 * a query then remember that peer, until it fails, then it will start looking
 * for a new peer from the top of the list, ignoring the one that just failed.
 * @private
 */
class DefaultQueryHandler extends QueryHandler {

    /**
     * constructor
     */
    constructor(channel, mspId, peerMap, queryOptions) {
        super(channel, mspId, peerMap, queryOptions);
        this.allQueryablePeers = peerMap.get(mspId);  //TODO: should remove peers that don't have the CHAINCODE_QUERY ROLE ?
        this.queryPeerIndex = -1;
    }

    /**
     * Query Chaincode using the following rules
     * 1. try the last successful peer
     * 2. If that fails or this is the first time try all query peers in order
     * Currently the implementation restricts to only peers in the same organisation, not across the channel.
     * @param {string} chaincodeId the chaincode id to use
     * @param {string} functionName the function name to invoke
     * @param {string[]} args the arguments
     * @param {TransactionID} txId the transaction id to use
     * @returns {object} asynchronous response or async error.
     */
    async queryChaincode(chaincodeId, functionName, args, txId) {
        let success = false;
        let payload;
        const allErrors = [];

        if (this.allQueryablePeers.length === 0) {
            const newError = new Error('No peers have been provided that can be queried');
            throw newError;
        }

        // try the last successful peer
        if (this.queryPeerIndex !== -1) {
            const peer = this.allQueryablePeers[this.queryPeerIndex];
            try {
                payload = await this._querySinglePeer(peer, chaincodeId, functionName, args, txId);
                success = true;
            } catch (error) {
                allErrors.push(error);
            }
        }

        if (!success) {

            // last successful peer failed or this is the first attempt at any query, so try to find a
            // peer to query.
            const failedPeer = this.queryPeerIndex;  // could be -1 if first attempt
            this.queryPeerIndex = -1;
            for (let i = 0; i < this.allQueryablePeers.length && !success; i++) {
                if (i === failedPeer) {
                    continue;
                }
                const peer = this.allQueryablePeers[i];
                try {
                    payload = await this._querySinglePeer(peer, chaincodeId, functionName, args, txId);
                    this.queryPeerIndex = i;
                    success = true;
                    break;
                } catch (error) {
                    allErrors.push(error);
                }
            }
        }

        if (!success) {
            const newError = new Error(`No peers available to query. last error was ${allErrors[allErrors.length-1]}`);
            throw newError;
        }

        if (payload instanceof Error) {
            throw payload;
        }

        return payload;

    }

    /**
     * Send a query
     * @param {Peer} peer The peer to query
     * @param {string} chaincodeId the chaincode id to use
     * @param {string} functionName the function name of the query
     * @param {array} args the arguments to ass
     * @param {TransactionID} txId the transaction id to use
     * @returns {Buffer} asynchronous response to query
     */
    async _querySinglePeer(peer, chaincodeId, functionName, args, txId) {
        const request = {
            targets: [peer],
            chaincodeId,
            txId: txId,
            fcn: functionName,
            args: args
        };

        const payloads = await this.queryByChaincode(request);
        if (!payloads.length) {
            throw new Error('No payloads were returned from the query request:' + functionName);
        }
        const payload = payloads[0];

        // if it has a code value is 14, means unavailable, so throw that error
        // code 2 looks like it is a chaincode response that was an error.
        if (payload instanceof Error && payload.code && payload.code === 14) {
            throw payload;
        }

        return payload;

    }

    /**
     * Perform a chaincode query and parse the responses.
     * @param {object} request the proposal for a query
     * @return {array} the responses
     */
    async queryByChaincode(request) {
        const method = 'queryByChaincode';
        try {
            const results = await this.channel.sendTransactionProposal(request);
            const responses = results[0];
            if (responses && Array.isArray(responses)) {
                let results = [];
                for (let i = 0; i < responses.length; i++) {
                    let response = responses[i];
                    if (response instanceof Error) {
                        results.push(response);
                    }
                    else if (response.response && response.response.payload) {
                        results.push(response.response.payload);
                    }
                    else {
                        results.push(new Error(response));
                    }
                }
                return results;
            }
            const err = new Error('Payload results are missing from the chaincode query');
            throw err;
        } catch(err) {
            throw err;
        }
    }
}


module.exports = DefaultQueryHandler;

