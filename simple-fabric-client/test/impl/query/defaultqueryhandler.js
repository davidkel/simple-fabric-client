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

const DefaultQueryHandler = require('../../../lib/impl/query/defaultqueryhandler');
const Peer = require('fabric-client/lib/Peer');
const TransactionID = require('fabric-client/lib/TransactionID');
const Channel = require('fabric-client/lib/Channel');
//onst FABRIC_CONSTANTS = require('fabric-client/lib/Constants');

const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();
chai.use(require('chai-as-promised'));

describe('DefaultQueryHandler', () => {

	const sandbox = sinon.createSandbox();
	let mockPeer1, mockPeer2, mockPeer3;
	let mockPeerMap, mockTransactionID, mockChannel;
	let queryHandler;

	beforeEach(() => {
		mockPeer1 = sinon.createStubInstance(Peer);
		mockPeer1.getName.returns('Peer1');
		mockPeer1.index = 1;
		mockPeer2 = sinon.createStubInstance(Peer);
		mockPeer2.getName.returns('Peer2');
		mockPeer2.index = 2;
		mockPeer3 = sinon.createStubInstance(Peer);
		mockPeer3.getName.returns('Peer3');
		mockPeer3.index = 3;
		mockPeerMap = new Map();
		mockPeerMap.set('mspid', [mockPeer1, mockPeer2, mockPeer3]);

		mockTransactionID = sinon.createStubInstance(TransactionID);
		mockChannel = sinon.createStubInstance(Channel);
		queryHandler = new DefaultQueryHandler(mockChannel, 'mspid', mockPeerMap);

	});
	afterEach(() => {
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should create a list of all queryable peers', () => {
			const queryHandler = new DefaultQueryHandler(mockChannel, 'mspid', mockPeerMap);
			queryHandler.allQueryablePeers.length.should.equal(3);
			queryHandler.allQueryablePeers.should.deep.equal([mockPeer1, mockPeer2, mockPeer3]);
		});
	});

	describe('#queryChaincode', () => {
		it('should not switch to another peer if peer returns a payload which is an error', async () => {
			const response = new Error('my chaincode error');
			mockChannel.queryByChaincode.resolves([response]);
			const qspSpy = sinon.spy(queryHandler, '_querySinglePeer');
			try {
				await queryHandler.queryChaincode('chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
				should.fail('expected error to be thrown');
			} catch(error) {
				error.message.should.equal('my chaincode error');
				sinon.assert.calledOnce(qspSpy);
				sinon.assert.calledWith(qspSpy, mockPeer1, 'chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
				queryHandler.queryPeerIndex.should.equal(0);
			}

		});


		it('should choose a valid peer', async () => {
			const response = Buffer.from('hello world');
			sandbox.stub(queryHandler, '_querySinglePeer').resolves(response);

			const result = await queryHandler.queryChaincode('chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			sinon.assert.calledOnce(queryHandler._querySinglePeer);
			sinon.assert.calledWith(queryHandler._querySinglePeer, mockPeer1, 'chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			queryHandler.queryPeerIndex.should.equal(0);
			result.equals(response).should.be.true;
		});

		it('should cache a valid peer and reuse', async () => {
			const response = Buffer.from('hello world');
			sandbox.stub(queryHandler, '_querySinglePeer').resolves(response);

			await queryHandler.queryChaincode('chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			const result = await queryHandler.queryChaincode('chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			sinon.assert.calledTwice(queryHandler._querySinglePeer);
			sinon.assert.alwaysCalledWith(queryHandler._querySinglePeer, mockPeer1, 'chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			queryHandler.queryPeerIndex.should.equal(0);
			result.equals(response).should.be.true;
		});

		it('should choose a valid peer if any respond with an error', async () => {
			const response = Buffer.from('hello world');
			const qsp = sandbox.stub(queryHandler, '_querySinglePeer');

			/* this didn't work as the mockPeers look the same
            qsp.withArgs(mockPeer2, 'aTxID', 'myfunc', ['arg1', 'arg2']).rejects(new Error('I failed'));
            qsp.withArgs(mockPeer1, 'aTxID', 'myfunc', ['arg1', 'arg2']).rejects(new Error('I failed'));
            qsp.withArgs(mockPeer3, 'aTxID', 'myfunc', ['arg1', 'arg2']).resolves(response);
            */
			qsp.onFirstCall().rejects(new Error('I failed'));
			qsp.onSecondCall().rejects(new Error('I failed'));
			qsp.onThirdCall().resolves(response);

			const result = await queryHandler.queryChaincode('chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			sinon.assert.calledThrice(qsp);
			sinon.assert.calledWith(qsp.thirdCall, mockPeer3, 'chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			queryHandler.queryPeerIndex.should.equal(2);
			result.equals(response).should.be.true;
		});

		it('should handle when the last successful peer fails', async () => {
			const response = Buffer.from('hello world');
			const qsp = sandbox.stub(queryHandler, '_querySinglePeer');
			qsp.onFirstCall().resolves(response);
			qsp.onSecondCall().rejects(new Error('I failed'));
			qsp.onThirdCall().resolves(response);

			let result = await queryHandler.queryChaincode('chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			result.equals(response).should.be.true;
			result = await queryHandler.queryChaincode('chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			result.equals(response).should.be.true;
			sinon.assert.calledThrice(queryHandler._querySinglePeer);
			sinon.assert.calledWith(qsp.firstCall, mockPeer1, 'chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			sinon.assert.calledWith(qsp.secondCall, mockPeer1, 'chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			sinon.assert.calledWith(qsp.thirdCall, mockPeer2, 'chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			queryHandler.queryPeerIndex.should.equal(1);
			result.equals(response).should.be.true;

		});

		it('should throw if all peers respond with errors', () => {
			const qsp = sandbox.stub(queryHandler, '_querySinglePeer');
			qsp.onFirstCall().rejects(new Error('I failed 1'));
			qsp.onSecondCall().rejects(new Error('I failed 2'));
			qsp.onThirdCall().rejects(new Error('I failed 3'));

			return queryHandler.queryChaincode('chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID)
				.should.be.rejectedWith(/No peers available.+failed 3/);
		});

		/*
		it('should throw if no peers are suitable to query', () => {


			return queryHandler.queryChaincode('chaincodeId', 'myfunc', ['arg1', 'arg2'], mockTransactionID)
				.should.be.rejectedWith(/No peers have been provided/);
		});
		*/
	});

	describe('#_querySinglePeer', () => {

		it('should query a single peer', async () => {
			const response = Buffer.from('hello world');
			mockChannel.queryByChaincode.resolves([response]);
			const result = await queryHandler._querySinglePeer(mockPeer2, 'org-acme-biznet', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			sinon.assert.calledOnce(mockChannel.queryByChaincode);
			sinon.assert.calledWith(mockChannel.queryByChaincode, {
				chaincodeId: 'org-acme-biznet',
				txId: mockTransactionID,
				fcn: 'myfunc',
				args: ['arg1', 'arg2'],
				targets: [mockPeer2]
			});
			result.equals(response).should.be.true;

		});

		it('should throw if no responses are returned', () => {
			mockChannel.queryByChaincode.resolves([]);
			return queryHandler._querySinglePeer(mockPeer2, 'org-acme-biznet', 'myfunc', ['arg1', 'arg2'], 'txid')
				.should.be.rejectedWith(/No payloads were returned from the query request/);
		});

		it('should return any responses that are errors and not UNAVAILABLE', async () => {
			const response = new Error('such error');
			mockChannel.queryByChaincode.resolves([response]);
			const result = await queryHandler._querySinglePeer(mockPeer2, 'org-acme-biznet', 'myfunc', ['arg1', 'arg2'], mockTransactionID);
			sinon.assert.calledOnce(mockChannel.queryByChaincode);
			sinon.assert.calledWith(mockChannel.queryByChaincode, {
				chaincodeId: 'org-acme-biznet',
				txId: mockTransactionID,
				fcn: 'myfunc',
				args: ['arg1', 'arg2'],
				targets: [mockPeer2]
			});
			result.should.be.instanceOf(Error);
			result.message.should.equal('such error');
		});

		it('should throw any responses that are errors and code 14 being unavailable.', () => {
			const response = new Error('14 UNAVAILABLE: Connect Failed');
			response.code = 14;
			mockChannel.queryByChaincode.resolves([response]);
			return queryHandler._querySinglePeer(mockPeer2, 'org-acme-biznet', 'myfunc', ['arg1', 'arg2'], 'txid')
				.should.be.rejectedWith(/Connect Failed/);
		});

		it('should throw if query request fails', () => {
			mockChannel.queryByChaincode.rejects(new Error('Query Failed'));
			return queryHandler._querySinglePeer(mockPeer2, 'org-acme-biznet', 'myfunc', ['arg1', 'arg2'], 'txid')
				.should.be.rejectedWith(/Query Failed/);
		});
	});

	//TODO: tests that drive this class end to end not just
	//individual

});
