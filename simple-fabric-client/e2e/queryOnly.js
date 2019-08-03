'use strict';

// required for hsm tests
// export CRYPTO_PKCS11_LIB="/usr/local/lib/softhsm/libsofthsm2.so"
// export CRYPTO_PKCS11_PIN="98765432"
// export CRYPTO_PKCS11_SLOT="0"

const { Network, InMemoryWallet, X509WalletMixin } = require('..');

const fs = require('fs');

(async () => {

    const wallet = new InMemoryWallet();
    // load crypto material into the in memory wallet
    const cert = fs.readFileSync('./dave/cert.pem').toString();
    const key = fs.readFileSync('./dave/key.pem').toString();
    await wallet.import('dave', X509WalletMixin.createIdentity('Org1MSP', cert, key));
    const exists = await wallet.exists('dave');
    console.log('Dave exists:', exists);

    const buffer = fs.readFileSync('./ccp.json');

    let network;

    try {
        // Create a network bound to a standard filesystem wallet
        network = new Network();
        await network.initialize(JSON.parse(buffer.toString()), {
            wallet: wallet,
            identity: 'dave'
        });

        try {
            let contract;
            let channel;


            console.log('---> start testing network with file system identity:');
            channel = await network.getChannel('composerchannel');
            contract = await channel.getContract('demo');

            let resp = await contract.executeTransaction('invoke', 'key1', 'key2', '50');
            console.log('response', resp.toString());

            resp = await contract.executeTransaction('invoke', 'key1', 'key2', '50');
            console.log('response', resp.toString());
            resp = await contract.executeTransaction('invoke', 'key1', 'key2', '50');
            console.log('response', resp.toString());


        } catch (error) {
            console.log('got submitTransaction error', error);
        }
    } catch (error) {
        console.log(error);
    } finally {
        //process.exit(0);  // needed because using HSM causes app to hang at the end.
    }


})();

