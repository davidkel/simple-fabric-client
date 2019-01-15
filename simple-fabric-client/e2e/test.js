(async () => {
	const Peer = require('fabric-client/lib/peer');
	const peer = new Peer('grpc://127.0.0.1:5005', { clientCert: 'some cert' });
	peer.waitForReady = () => { return Promise.resolve(); };
	peer._endorserClient.processProposal = (proposal, callback) => {
		callback(null, {
			response: {
				status: 500,
				message: 'some error'
			}
		});
	};

	try {
		await peer.sendProposal({}, 1);
	} catch (err) {
		console.log(err.isProposalResponse);
		console.log(err);
	}
})();
