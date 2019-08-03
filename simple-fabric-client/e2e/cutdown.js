'use strict';

// required for hsm tests
// export CRYPTO_PKCS11_LIB="/usr/local/lib/softhsm/libsofthsm2.so"
// export CRYPTO_PKCS11_PIN="98765432"
// export CRYPTO_PKCS11_SLOT="0"

const { Network, IDManager, FileSystemWallet } = require('..');

const fs = require('fs');

(async () => {

    const wallet = new FileSystemWallet('./WALLETS/wallet');


    const buffer = fs.readFileSync('./ccp.json');

    let network;

    try {
        const idManager = new IDManager();
        idManager.initialize(JSON.parse(buffer.toString()));

        // Create a network bound to a standard filesystem wallet
        network = new Network();
        await network.initialize(JSON.parse(buffer.toString()), {
            wallet: wallet,
            eventMgmtOptions: {
                useFullBlocks: true
            }
        });

        // see if admin exists in the standard non hsm wallet, if not get an identity from the Id Manager and stick it in the wallet
        const adminExists = await wallet.exists('admin');
        if (!adminExists) {
            await idManager.enrollToWallet('admin', 'adminpw', 'Org1MSP', wallet);
            // now that there are some identities in the wallet, we can tell the network(s) to use them
        }
        await network.setIdentity('admin');


        try {
            let contract;
            let channel;


            console.log('---> start testing network with file system identity:');
            channel = await network.getChannel('composerchannel');
            contract = await channel.getContract('demo');

            await contract.submitTransaction('invoke', ['key1', 'key2', '50']);

        } catch (error) {
            console.log('got submitTransaction error', error);
        }
    } catch (error) {
        console.log(error);
    } finally {
        //process.exit(0);  // needed because using HSM causes app to hang at the end.
    }


})();

