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

class X509WalletMixin {

	static createIdentity(mspId, certificate, privateKey) {
		return {
			type: 'X509',
			mspId,
			certificate,
			privateKey
		};
	}

	async importIdentity(client, label, identity) {
		// check identity type
		const cryptoContent = {
			signedCertPEM: identity.certificate,
			privateKeyPEM: identity.privateKey
		};

		await client.createUser(
			{
				username: label,
				mspid: identity.mspId,
				cryptoContent: cryptoContent
			});
	}

	async exportIdentity(client, label) {
		const user = await client.getUserContext(label, true);
		let result = null;
		if (user) {
			result = X509WalletMixin.createIdentity(
				user._mspId,
				user.getIdentity()._certificate,
				user.getSigningIdentity()._signer._key.toBytes()
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

module.exports = X509WalletMixin;
