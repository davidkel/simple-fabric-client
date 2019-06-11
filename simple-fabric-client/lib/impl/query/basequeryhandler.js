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

const QueryHandler = require('../../api/queryhandler');

class BaseQueryHandler extends QueryHandler {

    constructor(channel, mspId, peerMap, queryOptions) {
        super(channel, mspId, peerMap, queryOptions);
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
     * use this method because transaction ids were being re-generated in the node-sdk
     * version.
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

module.exports = BaseQueryHandler;
