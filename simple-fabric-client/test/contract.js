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
const sinon = require('sinon');

const Channel = require('fabric-client/lib/Channel');
const Peer = require('fabric-client/lib/Peer');
const Client = require('fabric-client');
const ChannelEventHub = require('fabric-client/lib/ChannelEventHub');
const TransactionID = require('fabric-client/lib/TransactionID.js');
const FABRIC_CONSTANTS = require('fabric-client/lib/Constants');
const User = require('fabric-client/lib/User.js');
const QueryHandler = require('../lib/api/queryhandler');

const chai = require('chai');
const should = chai.should();
chai.use(require('chai-as-promised'));

const Contract = require('../lib/contract');


describe('Contract', () => {

	let sandbox = sinon.createSandbox();
	let clock;

	let mockChannel, mockClient, mockCAClient, mockUser;
	let mockPeer1, mockPeer2, mockPeer3, mockEventHub1, mockEventHub2, mockEventHub3, mockQueryHandler;
	let connectOptions;
	let contract;
	let mockTransactionID, logWarnSpy;

	beforeEach(() => {
		clock = sinon.useFakeTimers();
		mockChannel = sinon.createStubInstance(Channel);
		mockClient = sinon.createStubInstance(Client);
		mockUser = sinon.createStubInstance(User);
		mockTransactionID = sinon.createStubInstance(TransactionID);
		mockTransactionID.getTransactionID.returns('00000000-0000-0000-0000-000000000000');
		mockClient.newTransactionID.returns(mockTransactionID);
		mockChannel.getName.returns('testchainid');

		mockPeer1 = sinon.createStubInstance(Peer);
		mockPeer1.index = 1; // add these so that the mockPeers can be distiguished when used in WithArgs().
		mockPeer1.getName.returns('Peer1');
		mockEventHub1 = sinon.createStubInstance(ChannelEventHub);
		mockEventHub1.getPeerAddr.returns('EventHub1');

		mockPeer2 = sinon.createStubInstance(Peer);
		mockPeer2.index = 2;
		mockPeer2.getName.returns('Peer2');
		mockEventHub2 = sinon.createStubInstance(ChannelEventHub);
		mockEventHub2.getPeerAddr.returns('EventHub2');

		mockPeer3 = sinon.createStubInstance(Peer);
		mockPeer3.index = 3;
		mockPeer3.getName.returns('Peer3');
		mockEventHub3 = sinon.createStubInstance(ChannelEventHub);
		mockEventHub3.getPeerAddr.returns('EventHub3');

		mockQueryHandler = sinon.createStubInstance(QueryHandler);
		contract = new Contract(mockChannel, 'someid', null, mockQueryHandler, null);

	});

	afterEach(() => {
		sandbox.restore();
		clock.restore();
	});

	/*
	describe('#createQueryHandler', () => {

		it('should create a new query handler', () => {
			// restore the createQueryHandler implementation as by default it is mocked out.
			sandbox.restore();
			sandbox = sinon.sandbox.create();
			const mockConnection = sinon.createStubInstance(HLFConnection);
			mockcontract.getChannelPeersInOrg.returns([]);
			mockcontract.channel = mockChannel;
			mockChannel.getPeers.returns([]);
			const queryHandler = HLFcontract.createQueryHandler(mockConnection);
			queryHandler.should.be.an.instanceOf(HLFQueryHandler);
		});

	});
	*/

	describe('#_validatePeerResponses', () => {
		it('should return all responses because all are valid', () => {
			const responses = [
				{
					response: {
						status: 200,
						payload: 'no error'
					}
				},

				{
					response: {
						status: 200,
						payload: 'good here'
					}
				}
			];

			mockChannel.verifyProposalResponse.returns(true);
			mockChannel.compareProposalResponseResults.returns(true);

			(function() {
				const {validResponses} = contract._validatePeerResponses(responses);
				validResponses.should.deep.equal(responses);
			}).should.not.throw();
		});

		it('should throw if no responses', () => {
			(function() {
				contract._validatePeerResponses([]);
			}).should.throw(/No results were returned/);
		});

		it('should throw if no proposal responses', () => {
			(function() {
				contract._validatePeerResponses([]);
			}).should.throw(/No results were returned/);
		});

		it('should throw if all responses are either not 200 or errors', () => {
			const responses = [
				{
					response: {
						status: 500,
						payload: 'got an error'
					}
				},
				new Error('had a problem'),
				{
					response: {
						status: 500,
						payload: 'oh oh another error'
					}
				}
			];

			mockChannel.verifyProposalResponse.returns(true);
			mockChannel.compareProposalResponseResults.returns(true);

			(function() {
				contract._validatePeerResponses(responses);
			}).should.throw(/No valid responses/);
		});

		it('should return only the valid responses', () => {
			const resp1 = {
				response: {
					status: 200,
					payload: 'no error'
				}
			};

			const resp2 = new Error('had a problem');

			const resp3 = {
				response: {
					status: 500,
					payload: 'such error'
				}
			};

			const responses = [resp1, resp2, resp3];

			mockChannel.verifyProposalResponse.returns(true);
			mockChannel.compareProposalResponseResults.returns(true);

			(function() {
				const {validResponses} = contract._validatePeerResponses(responses);
				validResponses.should.deep.equal([resp1]);

			}).should.not.throw();

		});

		/*
		it('should log warning if verifyProposal returns false', () => {
			const response1 = {
				response: {
					status: 200,
					payload: 'NOTVALID'
				}
			};
			const response2 = {
				response: {
					status: 200,
					payload: 'I AM VALID'
				}
			};

			const responses = [ response1, response2 ];

			mockChannel.verifyProposalResponse.withArgs(response1).returns(false);
			mockChannel.verifyProposalResponse.withArgs(response2).returns(true);
			mockChannel.compareProposalResponseResults.returns(true);
			contract._validatePeerResponses(responses, true);
			sinon.assert.calledWith(logWarnSpy, '_validatePeerResponses', sinon.match(/Proposal response from peer failed verification/));
		});
		*/
	});


	describe('#queryChainCode', () => {
		/*
		beforeEach(() => {
			mockChannel.getPeers.returns([mockPeer1]);
			mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.EVENT_SOURCE_ROLE).returns(true);
			mockChannel.newChannelEventHub.withArgs(mockPeer1).returns(mockEventHub1);
			contract._connectToEventHubs();
			mockEventHub1.isconnected.returns(true);
			mockEventHub1.getPeerAddr.returns('mockPeer1');
		});
		*/

		// it('should throw if functionName not specified', () => {
		// 	return contract.queryChainCode(mockSecurityContext, null, [])
		// 		.should.be.rejectedWith(/functionName not specified/);
		// });

		// it('should throw if args not specified', () => {
		// 	return contract.queryChainCode(mockSecurityContext, 'myfunc', null)
		// 		.should.be.rejectedWith(/args not specified/);
		// });

		// it('should throw if args contains non-string values', () => {
		// 	return contract.queryChainCode(mockSecurityContext, 'myfunc', [3.142])
		// 		.should.be.rejectedWith(/invalid arg specified: 3.142/);
		// });

		it('should query chaincode and handle a good response without return data', async () => {
			mockQueryHandler.queryChaincode.withArgs('someid', 'myfunc', ['arg1', 'arg2'], mockTransactionID).resolves();

			const result = await contract.executeTransaction('myfunc', ['arg1', 'arg2'], mockTransactionID);
			sinon.assert.calledOnce(mockQueryHandler.queryChaincode);
			should.equal(result, null);
		});

		it('should query chaincode and handle a good response with return data', async () => {
			const response = Buffer.from('hello world');
			mockQueryHandler.queryChaincode.withArgs('someid', 'myfunc', ['arg1', 'arg2'], mockTransactionID).resolves(response);

			const result = await contract.executeTransaction('myfunc', ['arg1', 'arg2'], mockTransactionID);
			sinon.assert.calledOnce(mockQueryHandler.queryChaincode);
			result.equals(response).should.be.true;
		});

		it('should query chaincode and handle an error response', () => {
			const response = new Error('such error');
			mockQueryHandler.queryChaincode.withArgs('someid', 'myfunc', ['arg1', 'arg2'], mockTransactionID).rejects(response);
			return contract.executeTransaction('myfunc', ['arg1', 'arg2'], mockTransactionID)
				.should.be.rejectedWith(/such error/);

		});
	});


	describe('#submitTransaction', () => {
		const validResponses = [{
			response: {
				status: 200
			}
		}];


		beforeEach(() => {
			sandbox.stub(contract, '_validatePeerResponses').returns({validResponses: validResponses});
		});

		// it('should throw if functionName not specified', () => {
		// 	return contract.submitTransaction(null, [], mockTransactionID)
		// 		.should.be.rejectedWith(/functionName not specified/);
		// });

		// it('should throw if args not specified', () => {
		// 	return contract.submitTransaction('myfunc', null, mockTransactionID)
		// 		.should.be.rejectedWith(/args not specified/);
		// });

		// it('should throw if args contains non-string values', () => {
		// 	return contract.submitTransaction('myfunc', [3.142], mockTransactionID)
		// 		.should.be.rejectedWith(/invalid arg specified: 3.142/);
		// });

		it('should submit an invoke request to the chaincode which does not return data', () => {
			const proposalResponses = [{
				response: {
					status: 200
				}
			}];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			// This is the commit proposal and response (from the orderer).
			const response = {
				status: 'SUCCESS'
			};
			mockChannel.sendTransaction.withArgs({ proposalResponses: proposalResponses, proposal: proposal }).resolves(response);
			return contract.submitTransaction('myfunc', ['arg1', 'arg2'], mockTransactionID)
				.then((result) => {
					should.equal(result, null);
					sinon.assert.calledOnce(mockChannel.sendTransactionProposal);
					sinon.assert.calledWith(mockChannel.sendTransactionProposal, {
						chaincodeId: 'someid',
						txId: mockTransactionID,
						fcn: 'myfunc',
						args: ['arg1', 'arg2']
					});
					sinon.assert.calledOnce(mockChannel.sendTransaction);
				});
		});

		it('should submit an invoke request to the chaincode which does return data', () => {
			const proposalResponses = [{
				response: {
					status: 200,
					payload: 'hello world'
				}
			}];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			contract._validatePeerResponses.returns({validResponses: proposalResponses});
			// This is the commit proposal and response (from the orderer).
			const response = {
				status: 'SUCCESS'
			};
			mockChannel.sendTransaction.withArgs({ proposalResponses: proposalResponses, proposal: proposal }).resolves(response);
			return contract.submitTransaction('myfunc', ['arg1', 'arg2'], mockTransactionID)
				.then((result) => {
					result.should.equal('hello world');
					sinon.assert.calledOnce(mockChannel.sendTransactionProposal);
					sinon.assert.calledWith(mockChannel.sendTransactionProposal, {
						chaincodeId: 'someid',
						txId: mockTransactionID,
						fcn: 'myfunc',
						args: ['arg1', 'arg2']
					});
					sinon.assert.calledOnce(mockChannel.sendTransaction);
				});
		});

		it('should submit an invoke request to the chaincode', () => {
			const proposalResponses = [{
				response: {
					status: 200
				}
			}];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			// This is the commit proposal and response (from the orderer).
			const response = {
				status: 'SUCCESS'
			};
			mockChannel.sendTransaction.withArgs({ proposalResponses: proposalResponses, proposal: proposal }).resolves(response);
			return contract.submitTransaction('myfunc', ['arg1', 'arg2'], mockTransactionID)
				.then((result) => {
					should.equal(result, null);
					sinon.assert.notCalled(mockClient.newTransactionID);
					sinon.assert.calledOnce(mockChannel.sendTransactionProposal);
					sinon.assert.calledWith(mockChannel.sendTransactionProposal, {
						chaincodeId: 'someid',
						txId: mockTransactionID,
						fcn: 'myfunc',
						args: ['arg1', 'arg2']
					});
					sinon.assert.calledOnce(mockChannel.sendTransaction);
				});
		});


		it('should throw if transaction proposals were not valid', () => {
			const proposalResponses = [];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			const errorResp = new Error('an error');
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			contract._validatePeerResponses.withArgs(proposalResponses).throws(errorResp);
			return contract.submitTransaction('myfunc', ['arg1', 'arg2'], mockTransactionID)
				.should.be.rejectedWith(/an error/);
		});

		/*
		it('should throw an error if the commit of the transaction times out', () => {
			// This is the transaction proposal and response (from the peers).
			const proposalResponses = [{
				response: {
					status: 200
				}
			}];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			// This is the commit proposal and response (from the orderer).
			const response = {
				status: 'SUCCESS'
			};
			mockChannel.sendTransaction.withArgs({ proposalResponses: proposalResponses, proposal: proposal }).resolves(response);
			// This is the event hub response.
			sandbox.stub(global, 'setTimeout').yields();
			// mockEventHub.registerTxEvent.yields();
			return contract.submitTransaction('myfunc', ['arg1', 'arg2'], mockTransactionID)
				.should.be.rejectedWith(/Failed to receive commit notification/)
				.then(() => {
				});
		});
		*/

		it('should throw an error if the orderer responds with an error', () => {
			const proposalResponses = [{
				response: {
					status: 200
				}
			}];
			const proposal = { proposal: 'i do' };
			const header = { header: 'gooooal' };
			mockChannel.sendTransactionProposal.resolves([ proposalResponses, proposal, header ]);
			// This is the commit proposal and response (from the orderer).
			const response = {
				status: 'FAILURE'
			};
			mockChannel.sendTransaction.withArgs({ proposalResponses: proposalResponses, proposal: proposal }).resolves(response);
			return contract.submitTransaction('myfunc', ['arg1', 'arg2'], mockTransactionID)
				.should.be.rejectedWith(/Failed to send/);
		});

	});

});
