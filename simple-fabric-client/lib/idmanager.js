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
const User = require('fabric-client/lib/User');

class IDManager {

    initialize(ccp) {
        this.client = Client.loadFromConfig(ccp);
    }

    async registerUser(userID, options, issuerWallet, issuerId) {
        if (!options) {
            options = {};
        }
        let identity = await issuerWallet.setUserContext(this.client, issuerId);

        let registerRequest = {
            enrollmentID: userID,
            affiliation: options.affiliation || 'org1',  // or eg. org1.department1
            attrs: [],
            maxEnrollments: options.maxEnrollments || -1,  // infinite enrollment by default
            role: options.role || 'client'
        };

        if (options.issuer) {
            // Everyone we create can register clients.
            registerRequest.attrs.push({
                name: 'hf.Registrar.Roles',
                value: 'client'
            });

            // Everyone we create can register clients that can register clients.
            registerRequest.attrs.push({
                name: 'hf.Registrar.Attributes',
                value: 'hf.Registrar.Roles, hf.Registrar.Attributes'
            });
        }

        let idAttributes = options.attributes;
        if (typeof idAttributes === 'string') {
            try {
                idAttributes = JSON.parse(idAttributes);
            } catch(error) {
                const newError = new Error('attributes provided are not valid JSON. ' + error);
                throw newError;
            }
        }

        for (let attribute in idAttributes) {
            registerRequest.attrs.push({
                name: attribute,
                value: idAttributes[attribute]
            });
        }

        let userSecret = await this.client.getCertificateAuthority().register(registerRequest, identity);
        return userSecret;
    }

    async enrollToWallet(userID, secret, mspId, walletToImportTo) {
        await walletToImportTo.configureClientStores(this.client, userID);
        let options = { enrollmentID: userID, enrollmentSecret: secret };

        const enrollment = await this.client.getCertificateAuthority().enroll(options);
        // private key will now have been stored

        let user = new User(userID);
        user.setCryptoSuite(this.client.getCryptoSuite());
        await user.setEnrollment(enrollment.key, enrollment.certificate, mspId);
        // public key will now have been stored
        await this.client.setUserContext(user);
        // state store will now have been saved

    }

}

module.exports = IDManager;
