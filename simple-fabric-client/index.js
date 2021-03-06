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

module.exports.Network = require('./lib/network');
module.exports.IDManager = require('./lib/idmanager');

module.exports.FileSystemWallet = require('./lib/impl/wallet/filesystemwallet');
module.exports.InMemoryWallet = require('./lib/impl/wallet/inmemorywallet');
module.exports.HSMWalletMixin = require('./lib/impl/wallet/hsmwalletmixin');
module.exports.X509WalletMixin = require('./lib/impl/wallet/x509walletmixin');
module.exports.CouchDBWallet = require('./lib/impl/wallet/couchdbwallet');

module.exports.EventHandlerConstants = require('./lib/impl/event/defaulteventstrategies');

module.exports.Wallet = require('./lib/api/wallet');
module.exports.EventHandlerFactory = require('./lib/api/eventhandler').EventHandlerFactory;
module.exports.TxEventHandler = require('./lib/api/eventhandler').TxEventHandler;
module.exports.QueryHandler = require('./lib/api/queryhandler');
