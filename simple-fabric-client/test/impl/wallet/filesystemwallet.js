/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const should = chai.should();
const rewire = require('rewire');

const FileSystemWallet = rewire('../../../lib/impl/wallet/filesystemwallet');
const X509WalletMixin = require('../../../lib/impl/wallet/x509walletmixin');
const Client = require('fabric-client');
const api = require('fabric-client/lib/api.js');
const fs = require('fs-extra');
const Path = require('path');


describe('FileSystemWallet', () => {
	let testwallet;
	const sandbox = sinon.createSandbox();

	beforeEach(() => {
		testwallet = new FileSystemWallet('/somepath');
		sinon.stub(testwallet, 'normalizeLabel').returnsArg(0);
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should throw an error if path not defined', () => {
			(() => {new FileSystemWallet();}).should.throw(/No path/);
		});

		it('should default to X509 wallet mixin', () => {
			testwallet.walletMixin.should.be.an.instanceof(X509WalletMixin);
		});

		it('should accept a mixin parameter', () => {
			const wallet = new FileSystemWallet('/somepath','my_mixin');
			wallet.walletMixin.should.equal('my_mixin');
		});
	});

	describe('#_createFileKVS', () => {
		it('should create a File Key Value Store', async () => {
			sandbox.stub(fs, 'mkdirs').callsArg(1);
			const store = await FileSystemWallet._createFileKVS('test');
			store.should.be.an.instanceof(api.KeyValueStore);
		});
	});

	describe('#_getPartitionedPath', () => {
		it('should create partitioned path', () => {
			sandbox.stub(Path, 'join').returns('/joined/path');
			testwallet._getPartitionedPath('label');
			sinon.assert.calledOnce(testwallet.normalizeLabel);
			sinon.assert.calledOnce(Path.join);
			sinon.assert.calledWith(Path.join, '/somepath', 'label');
		});
	});

	describe('#_isDirectory', () => {
		beforeEach(() => {
			sandbox.stub(Path, 'join').returns('/joined/path');
		});

		it('should return true if a directory', async () => {
			sandbox.stub(fs, 'lstat').resolves(
				{
					isDirectory: () => {
						return true;
					}
				}
			);
			const isDir = await FileSystemWallet._isDirectory('adir');
			isDir.should.be.true;
		});

		it('should return false if not a directory',async () => {
			sandbox.stub(fs, 'lstat').resolves(
				{
					isDirectory: () => {
						return false;
					}
				}
			);
			const isDir = await FileSystemWallet._isDirectory('adir');
			isDir.should.be.false;
		});

		it('should return false if an error is thrown', async () => {
			sandbox.stub(fs, 'lstat').rejects(new Error('bad karma'));
			const isDir = await FileSystemWallet._isDirectory('adir');
			isDir.should.be.false;
		});

	});

	describe('#getStateStore', () => {
		it('should create a KV store', async () => {
			// use Error as a class to be detected
			sandbox.stub(FileSystemWallet, '_createFileKVS').resolves(new Error());
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path');
			const store = await testwallet.getStateStore('test');
			sinon.assert.calledOnce(FileSystemWallet._createFileKVS);
			sinon.assert.calledWith(FileSystemWallet._createFileKVS, '/partitioned/path');
			store.should.be.an.instanceof(Error);
		});
	});

	describe('#getCryptoSuite', () => {
		it('should create a KV store', async () => {
			sandbox.stub(Client, 'newCryptoKeyStore').returns({});
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path2');
			const suite = await testwallet.getCryptoSuite('test');
			sinon.assert.calledOnce(Client.newCryptoKeyStore);
			sinon.assert.calledWith(Client.newCryptoKeyStore, {path: '/partitioned/path2'});
			suite.should.be.an.instanceof(api.CryptoSuite);
		});
	});

	describe('#exists', () => {
		it('should test the existence of an identity from the wallet', async () => {
			sandbox.stub(fs, 'exists').resolves(true);
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path3');

			const exists = await testwallet.exists('user1');
			exists.should.equal(true);
			sinon.assert.calledOnce(fs.exists);
			sinon.assert.calledWith(fs.exists, '/partitioned/path3');

		});

		it('should test the non-existence of an identity from the wallet', async () => {
			sandbox.stub(fs, 'exists').resolves(false);
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path4');
			const exists = await testwallet.exists('user1');
			exists.should.equal(false);
			sinon.assert.calledOnce(fs.exists);
			sinon.assert.calledWith(fs.exists, '/partitioned/path4');
		});
	});

	describe('#delete', () => {
		it('should delete an identity from the wallet', async () => {
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path5');
			const rimrafStub = sinon.stub();
			FileSystemWallet.__set__('rimraf', rimrafStub.callsArg(1));
			const success = await testwallet.delete('user1');
			success.should.be.true;
		});
		it('should throw an error if delete fails', async () => {
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path6');
			const rimrafStub = sinon.stub();
			FileSystemWallet.__set__('rimraf', rimrafStub.callsArgWith(1, new Error('Not found')));
			const success = await testwallet.delete('user2');
			success.should.be.false;
		});
	});

	describe('#getAllLabels', () => {
		// test readdir returns null, [], throws error
		it('should list all identities in the wallet', async () => {

			// user1 and user3 are the only valid identities
			sandbox.stub(fs, 'readdir').resolves(['user1', 'user2', 'user3', 'user4']);
			const isDirStub = sandbox.stub(FileSystemWallet, '_isDirectory');
			sinon.stub(testwallet, '_getPartitionedPath').returns('/partitioned/path7');
			const existsStub = sandbox.stub(fs, 'exists');
			isDirStub.withArgs('user1').resolves(true);
			isDirStub.withArgs('user2').resolves(false);
			isDirStub.returns(true);

			existsStub.withArgs('/partitioned/path7/user1').resolves(true);
			existsStub.withArgs('/partitioned/path7/user3').resolves(true);
			existsStub.withArgs('/partitioned/path7/user4').resolves(false);

			const labels = await testwallet.getAllLabels();
			labels.length.should.equal(2);
			labels.includes('user1').should.equal(true);
			labels.includes('user3').should.equal(true);
		});

		it('should handle no entries in the wallet - 1', async () => {
			sandbox.stub(fs, 'readdir').resolves(null);
			const labels = await testwallet.getAllLabels();
			labels.length.should.equal(0);
		});

		it('should handle no entries in the wallet - 2', async () => {
			sandbox.stub(fs, 'readdir').resolves([]);
			const labels = await testwallet.getAllLabels();
			labels.length.should.equal(0);
		});

		it('should handle no entries in the wallet - 3', async () => {
			sandbox.stub(fs, 'readdir').rejects(new Error('no directory'));
			const labels = await testwallet.getAllLabels();
			labels.length.should.equal(0);
		});

	});
});
