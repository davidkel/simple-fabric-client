const {Gateway, InMemoryWallet, X509WalletMixin} = require('fabric-network');

const fs = require('fs');

(async () => {
	// read in a CCP and parse to JS Object
	const buffer = fs.readFileSync('./ccp.json');
	const ccp = JSON.parse(buffer.toString());

	let gateway;

	try {

		// create a wallet and load an identity into it
		const wallet = new InMemoryWallet();
		const cert = fs.readFileSync('./dave/cert.pem').toString();
		const key = fs.readFileSync('./dave/key.pem').toString();
		await wallet.import('dave', X509WalletMixin.createIdentity('Org1MSP', cert, key));
		const exists = await wallet.exists('dave');
		// I think, therefore I am....
		console.log('Dave exists:', exists);

		// Create a network bound to a standard filesystem wallet
		gateway = new Gateway();

		// initialise the gateway with a wallet and the identity to bind to that gateway
		// which must exist in the wallet, default everything else
		await gateway.initialize(ccp, {
			wallet: wallet,
			identity: 'dave'
		});

		const network = await gateway.getNetwork('composerchannel');
		const contract = network.getContract('demo');
		await contract.submitTransaction('invoke', ['key1', 'key2', '50']);
	} catch(error) {
		console.log(error);
	} finally {
		gateway.disconnect();
	}


})();
