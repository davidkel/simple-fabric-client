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
const rewire = require('rewire');

const InternalChannel = rewire('fabric-client/lib/Channel');
const Peer = InternalChannel.__get__('ChannelPeer');
const Client = require('fabric-client');
const ChannelEventHub = require('fabric-client/lib/ChannelEventHub');
const TransactionID = require('fabric-client/lib/TransactionID.js');
const FABRIC_CONSTANTS = require('fabric-client/lib/Constants');

const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));

const Channel = require('../lib/channel');
const Network = require('../lib/network');


describe('Channel', () => {

	let sandbox = sinon.createSandbox();
	let clock;

	let mockChannel, mockClient;
	let mockPeer1, mockPeer2, mockPeer3, mockEventHub1, mockEventHub2, mockEventHub3;
	let channel;
	let mockTransactionID, mockNetwork;

	beforeEach(() => {
		clock = sinon.useFakeTimers();
		mockChannel = sinon.createStubInstance(InternalChannel);
		mockClient = sinon.createStubInstance(Client);
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

		mockNetwork = sinon.createStubInstance(Network);
		mockNetwork.getOptions.returns({useDiscovery: false});
		channel = new Channel(mockNetwork, mockChannel);

	});

	afterEach(() => {
		sandbox.restore();
		clock.restore();
	});


	describe('#_initializeInternalChannel', () => {
		let peerArray;
		let mockPeer4, mockPeer5;
		beforeEach(() => {
			mockPeer4 = sinon.createStubInstance(Peer);
			mockPeer4.index = 4;
			mockPeer5 = sinon.createStubInstance(Peer);
			mockPeer5.index = 5;

			mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
			mockPeer2.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			mockPeer3.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
			mockPeer4.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(true);
			mockPeer5.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.LEDGER_QUERY_ROLE).returns(false);
			peerArray = [mockPeer1, mockPeer2, mockPeer3, mockPeer4, mockPeer5];
			mockChannel.getPeers.returns(peerArray);
		});

		it('should initialize the channel using the first peer', async () => {
			mockChannel.initialize.resolves();
			await channel._initializeInternalChannel();
			sinon.assert.calledOnce(mockChannel.initialize);
		});

		it('should try other peers if initialization fails', async () => {
			channel.initialized = false;
			// create a real mock
			mockChannel.initialize.onCall(0).rejects(new Error('connect failed'));
			mockChannel.initialize.onCall(1).resolves();
			await channel._initializeInternalChannel();
			sinon.assert.calledTwice(mockChannel.initialize);
			sinon.assert.calledWith(mockChannel.initialize.firstCall, {target: mockPeer1});
			sinon.assert.calledWith(mockChannel.initialize.secondCall, {target: mockPeer3});
		});

		it('should fail if all peers fail', async () => {
			channel.initialized = false;
			mockChannel.initialize.onCall(0).rejects(new Error('connect failed'));
			mockChannel.initialize.onCall(1).rejects(new Error('connect failed next'));
			mockChannel.initialize.onCall(2).rejects(new Error('connect failed again'));
			let error;
			try {
				await channel._initializeInternalChannel();
			} catch(_error) {
				error = _error;
			}
			error.should.match(/connect failed again/);
			sinon.assert.calledThrice(mockChannel.initialize);
			sinon.assert.calledWith(mockChannel.initialize.firstCall, {target: mockPeer1});
			sinon.assert.calledWith(mockChannel.initialize.secondCall, {target: mockPeer3});
			sinon.assert.calledWith(mockChannel.initialize.thirdCall, {target: mockPeer4});
		});
	});

});
