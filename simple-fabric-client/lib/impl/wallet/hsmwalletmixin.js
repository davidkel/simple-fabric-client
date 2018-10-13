/*
 Copyright 2018 IBM All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

		http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/
'use strict';

const Client = require('fabric-client');
const {KEYUTIL} = require('jsrsasign');
const ecdsaKey = require('fabric-client/lib/impl/ecdsa/key.js');

let HSMSuite = new Map();

class HSMWalletMixin {

	static createIdentity(mspId, certificate) {
		return {
			type: 'HSMX509',
			mspId,
			certificate
		};
	}


	static clearHSMCache() {
		HSMSuite.clear();
	}

	static closeDown() {
		for (const suite of HSMSuite.values()) {
			suite.closeSession();
			suite.finalize();
		}
	}

	// can either pass values on construction, or let sdk pick up info from env vars
	constructor(library = null, slot = null, pin = null, usertype = null) {
		this.library = library;
		this.slot = slot ? slot * 1 : null;
		this.pin = pin ? pin + '' : null;
		this.usertype = usertype;
		this.cryptoSuite = null;
	}

	getCryptoSuite(label, wallet) {
		const key = '' + this.slot + '-' + this.pin;
		this.cryptoSuite = HSMSuite.get(key);
		if (!this.cryptoSuite) {
			this.cryptoSuite = Client.newCryptoSuite({ software: false, lib: this.library, slot: this.slot, pin: this.pin, usertype: this.usertype });
			// we need to set a path in the CryptoKeyStore even though it is using HSM otherwise
			// it will make the private key ephemeral and not store it in the HSM
			this.cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: '/tmp'}));
			HSMSuite.set(key, this.cryptoSuite);
		}
		return this.cryptoSuite;
	}

	// so similar to X509, can we do something about it ?
	async importIdentity(client, label, identity) {
		// check the identity type
		const cryptoContent = {
			signedCertPEM: identity.certificate
		};
		const publicKey = KEYUTIL.getKey(identity.certificate);
		const ecdsakey = new ecdsaKey(publicKey);
		cryptoContent.privateKeyObj = await this.cryptoSuite.getKey(Buffer.from(ecdsakey.getSKI(), 'hex'));

		await client.createUser(
			{
				username: label,
				mspid: identity.mspId,
				cryptoContent: cryptoContent
			});

	}

	// so similar to X509 can we do something about it.
	async exportIdentity(client, label) {
		const user = await client.getUserContext(label, true);
		let result = null;
		if (user) {
			result = HSMWalletMixin.createIdentity(
				user._mspId,
				user.getIdentity()._certificate
			);
		}
		return result;
	}

	async getIdentityInfo(client, label) {
		const user = await client.getUserContext(label, true);
		let result = null;
		if (user) {
			result = {
				label,
				mspId: user._mspId,
				identifier: user.getIdentity()._publicKey.getSKI()
			};
		}
		return result;
	}
}

module.exports = HSMWalletMixin;
