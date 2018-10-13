'use strict';

// required for hsm tests
// export CRYPTO_PKCS11_LIB="/usr/local/lib/softhsm/libsofthsm2.so"
// export CRYPTO_PKCS11_PIN="98765432"
// export CRYPTO_PKCS11_SLOT="0"

// CouchDBWallet, EventHandlerConstants also available
const {Network, IDManager, FileSystemWallet, InMemoryWallet, HSMWalletMixin, X509WalletMixin} = require('..');

const fs = require('fs');

(async () => {

	const testHSM = process.env.CRYPTO_PKCS11_LIB && process.env.CRYPTO_PKCS11_SLOT && process.env.CRYPTO_PKCS11_PIN;

	// Perform some identity management first
	const wallet = new FileSystemWallet('./WALLETS/wallet');

	let hsmwallet;
	if (testHSM) {
		hsmwallet = new FileSystemWallet('./WALLETS/hsmwallet', new HSMWalletMixin());
	}

	//const couchdbwallet = new CouchDBWallet({url: 'http://localhost:5984'});

	const inMemoryWallet = new InMemoryWallet();

	// load crypto material into the in memory wallet
	const cert = fs.readFileSync('./dave/cert.pem').toString();
	const key = fs.readFileSync('./dave/key.pem').toString();
	await inMemoryWallet.import('dave', X509WalletMixin.createIdentity('Org1MSP', cert, key));
	const exists = await inMemoryWallet.exists('dave');
	console.log('Dave exists:', exists);


	// TODO maybe network could also read the file directly
	const bufferDiscovery = fs.readFileSync('./ccp-discovery.json');
	const buffer = fs.readFileSync('./ccp.json');

	let hsmNetwork;
	let network;
	let memNetwork;
	let queryNetwork;

	try {
		const idManager = new IDManager();
		idManager.initialize(JSON.parse(bufferDiscovery.toString()));

		// now we are ready to interact with the network
		//TODO: should an app provide a wallet implementation or a URI string which represents an implementation to be
		// loaded by the network class.

		// Create a network bound to an hsm wallet
		if (testHSM) {
			hsmNetwork = new Network();
			await hsmNetwork.initialize(JSON.parse(buffer.toString()), {
				wallet: hsmwallet
			});
		}

		// Create a network bound to a standard filesystem wallet
		network = new Network();
		await network.initialize(JSON.parse(buffer.toString()), {
			wallet: wallet,
			eventHandlerOptions: {
				useFullBlocks: true
			}
		});

		// create a query only network
		console.log('creating a query only network instance');
		queryNetwork = new Network();
		await queryNetwork.initialize(JSON.parse(buffer.toString()), {
			wallet: wallet,
			identity: 'admin',
			eventHandlerFactory: null
		});


		// Create a network bound to an in memory wallet and discover
		memNetwork = new Network();
		await memNetwork.initialize(JSON.parse(bufferDiscovery.toString()), { // TODO: should use bufferDiscovery but there is a potential issue with SDK
			wallet: inMemoryWallet,
			identity: 'dave',
			useDiscovery: true,
			discoveryOptions: {
				discoveryProtocol: 'grpc',
				asLocalhost: true
			}
		});

		// see if admin exists in the standard non hsm wallet, if not get an identity from the Id Manager and stick it in the wallet
		const adminExists = await wallet.exists('admin');
		if (!adminExists) {
			await idManager.enrollToWallet('admin', 'adminpw', 'Org1MSP', wallet);
			// now that there are some identities in the wallet, we can tell the network(s) to use them
		}
		const id = await wallet.export('admin');
		console.log('exported x509 identity', id);
		console.log('listing all identities in a wallet');
		const idInfoList = await wallet.list();
		console.log(idInfoList);
		for (const idInfo of idInfoList) {
			console.log(`name=${idInfo.label}, mspId=${idInfo.mspId}, identifier=${idInfo.identifier}`);
		}
		await network.setIdentity('admin');

		// see if HSMUser is in the HSM filesystem wallet, and if not register one assuming it has never been registered otherwise
		// we need to remember the secret, then enroll the identity into the hsm wallet which ensures the keys are stored in the hsm.
		let hsmUser = 'HSMUser3';

		if (testHSM) {
			const hsmUserExists = await hsmwallet.exists(hsmUser);
			if (!hsmUserExists) {
				let secret = await idManager.registerUser(hsmUser, null, wallet, 'admin');
				console.log(hsmUser, '=', secret);
				await idManager.enrollToWallet(hsmUser, secret, 'Org1MSP', hsmwallet);
			}
			const id = await hsmwallet.export(hsmUser);
			console.log('exported hsm identity', id);
			// now that there are some identities in the wallet, we can tell the network(s) to use them
			await hsmNetwork.setIdentity(hsmUser);
		}

		try {
			let contract;
			let response;
			let blockToQuery;
			let channel;

			console.log('---> start testing network with file system identity:');
			channel = await network.getChannel('composerchannel');
			contract = await channel.getContract('demo');

			let eventHubs = channel.getEventHubs();

			eventHubs[0].registerBlockEvent((block) => {  //TODO: Note that eventHubs have a special field defining which mspId they are in.
				console.log('block---->');
				console.log(block);
				blockToQuery = block.header.number;
			});

			response = await contract.submitTransaction('invoke', ['key1', 'key2', '50']);
			console.log('got response 1: ' + response);

			let rawchannel = channel.getInternalChannel();
			let blk = await rawchannel.queryBlock(blockToQuery * 1);
			console.log('blk--->');
			console.log(JSON.stringify(blk.data.data[0].payload.data.actions));
			console.log('<--- Finish testing network with file system identity');



			console.log('---> start testing query only network with file system identity:');
			channel = await queryNetwork.getChannel('composerchannel');
			contract = await channel.getContract('demo');
			response = await contract.executeTransaction('query', ['key1']);
			console.log('got response: ' + response);
			console.log('<--- Finish testing query only network with file system identity');



			console.log('---> start testing network with in memory identity:');
			channel = await memNetwork.getChannel('composerchannel');
			contract = await channel.getContract('demo');
			response = await contract.submitTransaction('invoke', ['key1', 'key2', '50']);
			console.log('got response: ' + response);
			response = await contract.submitTransaction('invoke', ['key1', 'key2', '50']);
			console.log('got response: ' + response);
			console.log('testing query');
			response = await contract.executeTransaction('query', ['key1']);
			console.log('got response: ' + response);

			//response = await contract.submitTransaction('invoke', ['key1', 'key2', '50']);
			//response = await contract.submitTransaction('invoke', ['key1', 'key2', '50']);
			//response = await contract.submitTransaction('invoke', ['key1', 'key2', '50']);
			//response = await contract.submitTransaction('invoke', ['key1', 'key2', '50']);
			console.log('<--- finish testing network with in memory identity:');




			if (testHSM) {
				console.log('---> start testing network with hsm identity:');
				channel = await hsmNetwork.getChannel('composerchannel');
				contract = await channel.getContract('demo');
				response = await contract.submitTransaction('invoke', ['key1', 'key2', '50']);
				console.log('got response: ' + response);
				console.log('<--- finish testing network with hsm identity:');
			}

		} catch(error) {
			console.log('got submitTransaction error', error);
		}
	} catch(error) {
		console.log(error);
	} finally {
		console.log('cleaning up');
		queryNetwork.dispose();
		memNetwork.dispose();
		network.dispose();
		if (testHSM) {
			hsmNetwork.dispose();
			HSMWalletMixin.closeDown();
		}
		process.exit(0);  // needed because using HSM causes app to hang at the end.
	}


})();

