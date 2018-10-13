describe('#_connectToEventHubs', () => {
	beforeEach(() => {
		mockChannel.getPeers.returns([mockPeer1]);
		mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.EVENT_SOURCE_ROLE).returns(true);
		mockChannel.newChannelEventHub.withArgs(mockPeer1).returns(mockEventHub1);        });

	it('should ignore a disconnected event hub on process exit', () => {
		sandbox.stub(process, 'on').withArgs('exit').yields();
		mockEventHub1.isconnected.returns(false);
		connection._connectToEventHubs();
		sinon.assert.calledOnce(process.on);
		sinon.assert.calledWith(process.on, 'exit');
		sinon.assert.notCalled(mockEventHub1.disconnect);
	});

	it('should disconnect a connected event hub on process exit', () => {
		sandbox.stub(process, 'on').withArgs('exit').yields();
		mockEventHub1.isconnected.returns(true);
		connection._connectToEventHubs();
		sinon.assert.calledOnce(process.on);
		sinon.assert.calledWith(process.on, 'exit');
		sinon.assert.calledOnce(mockEventHub1.disconnect);
		sinon.assert.notCalled(mockEventHub1.unregisterChaincodeEvent);
	});

	it('should do nothing with chaincode event listeners if none registered on process exit', () => {
		sandbox.stub(process, 'on').withArgs('exit').yields();
		mockEventHub1.isconnected.returns(true);
		connection._connectToEventHubs();
		sinon.assert.notCalled(mockEventHub1.unregisterChaincodeEvent);
	});


	it('should unregister a chaincode listener if listener registered', () => {
		sandbox.stub(process, 'on').withArgs('exit').yields();
		mockEventHub1.isconnected.returns(true);
		connection.ccEvent = {eventHub: mockEventHub1, handle: 'handle'};
		connection._connectToEventHubs();

		sinon.assert.calledOnce(process.on);
		sinon.assert.calledWith(process.on, 'exit');
		sinon.assert.calledOnce(mockEventHub1.unregisterChaincodeEvent);
		sinon.assert.calledWith(mockEventHub1.unregisterChaincodeEvent, 'handle');
	});


	it('should not register any listeners for chaincode events if no business network is specified', () => {
		connection = new HLFConnection(mockConnectionManager, 'hlfabric1', null, {}, mockClient, mockChannel, mockCAClient);
		connection._connectToEventHubs();
		sinon.assert.notCalled(mockEventHub1.registerChaincodeEvent);
		should.equal(connection.ccEvent,undefined);

	});

	it('should do nothing and not register an exit handler if there are no eventhubs', () => {
		mockChannel.getPeers.returns([]);
		sandbox.stub(process, 'on');
		connection._connectToEventHubs();
		sinon.assert.notCalled(mockEventHub1.registerChaincodeEvent);
		sinon.assert.notCalled(process.on);
	});

	it('should only connect event hubs where the peer is an event source', () => {
		sandbox.stub(process, 'on').withArgs('exit').yields();
		mockChannel.getPeers.returns([mockPeer1, mockPeer2, mockPeer3]);
		mockPeer2.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.EVENT_SOURCE_ROLE).returns(false);
		mockPeer3.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.EVENT_SOURCE_ROLE).returns(true);
		mockChannel.newChannelEventHub.withArgs(mockPeer3).returns(mockEventHub3);

		connection._connectToEventHubs();
		sinon.assert.calledOnce(mockEventHub1.connect);
		sinon.assert.calledOnce(mockEventHub3.connect);
		sinon.assert.notCalled(mockEventHub2.connect);
	});

});

describe('#_checkCCListener', () => {
	beforeEach(() => {

		mockChannel.getPeers.returns([mockPeer1, mockPeer2]);
		mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.EVENT_SOURCE_ROLE).returns(true);
		mockChannel.newChannelEventHub.withArgs(mockPeer1).returns(mockEventHub1);
		mockPeer2.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.EVENT_SOURCE_ROLE).returns(true);
		mockChannel.newChannelEventHub.withArgs(mockPeer2).returns(mockEventHub2);
		mockEventHub1.isconnected.returns(false);
		mockEventHub2.isconnected.returns(true);
		connection._connectToEventHubs();
		mockEventHub1.registerChaincodeEvent.withArgs('org-acme-biznet', 'composer', sinon.match.func).returns('handle');
	});

	it('should do nothing if cc event handler registered', () => {
		connection._registerForChaincodeEvents(mockEventHub1);
		const regSpy = sandbox.spy(connection._registerForChaincodeEvents);
		connection._checkCCListener().should.be.true;
		sinon.assert.notCalled(regSpy);
		sinon.assert.notCalled(logWarnSpy);
	});

	it('should register if not registered to first connected event hub', () => {
		sandbox.stub(connection, '_registerForChaincodeEvents');
		connection._checkCCListener().should.be.true;
		sinon.assert.calledOnce(connection._registerForChaincodeEvents);
		sinon.assert.calledWith(connection._registerForChaincodeEvents, mockEventHub2);
		sinon.assert.notCalled(logWarnSpy);
	});

	it('should log a warning if no connected event hubs', () => {
		sandbox.stub(connection, '_registerForChaincodeEvents');
		mockEventHub2.isconnected.returns(false);
		connection._checkCCListener().should.be.false;
		sinon.assert.calledOnce(logWarnSpy);
	});


});

describe('#_checkEventhubs', () => {

	it('should check the connections for every event hub', () => {
		mockChannel.getPeers.returns([mockPeer1, mockPeer2]);
		mockPeer1.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.EVENT_SOURCE_ROLE).returns(true);
		mockChannel.newChannelEventHub.withArgs(mockPeer1).returns(mockEventHub1);
		mockPeer2.isInRole.withArgs(FABRIC_CONSTANTS.NetworkConfig.EVENT_SOURCE_ROLE).returns(true);
		mockChannel.newChannelEventHub.withArgs(mockPeer2).returns(mockEventHub2);
		mockEventHub1.isconnected.returns(false);
		mockEventHub2.isconnected.returns(true);
		connection._connectToEventHubs();
		connection._checkEventhubs();
		sinon.assert.calledOnce(mockEventHub1.checkConnection);
		sinon.assert.calledOnce(mockEventHub2.checkConnection);
	});

	it('should do nothing if there are no event hubs', () => {
		connection._checkEventhubs();
		sinon.assert.notCalled(mockEventHub1.checkConnection);
		sinon.assert.notCalled(mockEventHub2.checkConnection);
	});

});
