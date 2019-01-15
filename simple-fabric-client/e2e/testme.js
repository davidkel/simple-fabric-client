'use strict';

// required for hsm tests
// export CRYPTO_PKCS11_LIB="/usr/local/lib/softhsm/libsofthsm2.so"
// export CRYPTO_PKCS11_PIN="98765432"
// export CRYPTO_PKCS11_SLOT="0"

const Network = require('../lib/network');
const IDManager = require('../lib/idmanager');
const InMemoryWallet = require('../lib/inmemorywallet');

const fs = require('fs');


(async () => {

	const inMemoryWallet = new InMemoryWallet();

	// load crypto material into the in memory wallet
	//const cert = fs.readFileSync('./dave/cert.pem').toString();
	//const key = fs.readFileSync('./dave/key.pem').toString();
	//await inMemoryWallet.import('dave', 'Org1MSP', cert, key);
	//const exists = await inMemoryWallet.exists('dave');
	//console.log('Dave exists:', exists);


	// TODO maybe network could also read the file directly
	const buffer = fs.readFileSync('./ccp.json');
	let memNetwork;

	try {
		const idManager = new IDManager();
		idManager.initialize(JSON.parse(buffer.toString()));

		// now we are ready to interact with the network
		//TODO: should an app provide a wallet implementation or a URI string which represents an implementation to be
		// loaded by the network class.

		// Create a network bound to an in memory wallet
		memNetwork = new Network();
		await memNetwork.initialize(JSON.parse(buffer.toString()), {
			wallet: inMemoryWallet
		});

	} catch(error) {
		console.log(error);
	} finally {
		//process.exit(0);  // needed because using HSM causes app to hang at the end.
	}


})();

