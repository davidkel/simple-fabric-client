import { Channel, User, ChannelEventHub, TransactionId, ICryptoKey } from 'fabric-client';
import { EventEmitter } from 'events';
import Client = require('fabric-client');


export interface InitOptions {
	eventManager?: string;
	eventManagerOptions?: any;
	queryHandler?: string;
	queryHandlerOptions?: any;
	useDiscovery?: boolean;
	discoveryOptions?: {
		discoveryProtocol: string;
		asLocalHost: boolean;
		discoveryRefresh: number;
	}
}


//-------------------------------------------
// Main fabric network classes
//-------------------------------------------
export class Network {
	constructor();
	initialize(ccp: string | Client, options?: InitOptions): Promise<void>;
	getCurrentIdentity(): User;
	getClient(): Client;
	getOptions(): InitOptions;
	getChannel(channelName: string): Promise<FabricNetwork.Channel>;
	dispose(): void;
}

declare namespace FabricNetwork {
	export class Channel {
		getInternalChannel(): Channel;
		getPeerMap(): Map<string, Client.Peer[]>;
		rediscover(): Promise<void>;
		getContract(chaincodeId: string): Contract;
		// array of mapped by mspid ?
		getEventHubs(): ChannelEventHub[];
	}
}
export class Contract extends EventEmitter {
	evalTransation(transactionName: string, parameters: string[], transientMap?: Map<string, Buffer>, txId?: TransactionId): Promise<Buffer>;
	submitTransaction(transactionName: string, parameters: string[], , transientMap?: Map<string, Buffer>, txId?: TransactionId): Promise<Buffer>;
}

//-------------------------------------------
// Wallet Management
//-------------------------------------------
export interface Identity {
	type: string
}

export interface HSMX509Identity extends Identity {
	mspId: string,
	certificate: string
}

export interface X509Identity extends HSMX509Identity {
	privateKey: string
}

export interface IdentityInformation {
	label: string,
	mspId: string,
	identifier: string
}


export interface WalletAPI {
	import(label: string, identity: Identity): Promise<void>;
	export(label: string): Promise<Identity>;
	list(): Promise<IdentityInformation>;
	delete(label: string): Promise<void>;
	exists(label: string): Promise<boolean>;
}

export interface WalletSPI {
	setUserContext(client: Client, label: string): Promise<void>;
	configureClientStores(client: Client, label: string): Promise<void>;
}

export interface Wallet extends WalletAPI, WalletSPI {
}

export interface WalletMixin {
}

export abstract class BaseWallet implements Wallet {
	import(label: string, identity: Identity): Promise<void>;
	export(label: string): Promise<Identity>;
	list(): Promise<IdentityInformation>;
	abstract delete(label: string): Promise<void>;
	abstract exists(label: string): Promise<boolean>;

	setUserContext(client: Client, label: string): Promise<void>;
	configureClientStores(client: Client, label: string): Promise<void>;
	setWalletMixin(walletMixin: WalletMixin): void;
	getAllLabels(): Promise<string[]>;
	normalizeLabel(label: string): string;
	abstract getStateStore(client: Client, label: string): Promise<void>;
	abstract getCryptoSuite(client: Client, label: string): Promise<void>;
}

// Real usable Wallet implementations
export class InMemoryWallet extends BaseWallet {
	delete(label: string): Promise<void>;
	exists(label: string): Promise<boolean>;
	getStateStore(client: Client, label: string): Promise<void>;
	getCryptoSuite(client: Client, label: string): Promise<void>;
}

export class FileSystemWallet extends BaseWallet {
	constructor(path: string);
	delete(label: string): Promise<void>;
	exists(label: string): Promise<boolean>;
	getStateStore(client: Client, label: string): Promise<void>;
	getCryptoSuite(client: Client, label: string): Promise<void>;
}

export class CouchDBWallet extends BaseWallet {
	constructor(options: any); // TODO: need to define the option format here
	delete(label: string): Promise<void>;
	exists(label: string): Promise<boolean>;
	getStateStore(client: Client, label: string): Promise<void>;
	getCryptoSuite(client: Client, label: string): Promise<void>;
}

export class HSMWalletMixin implements WalletMixin {
	constructor(library: string, slot: number, pin: string, userType: string);
	static createIdentity(mspId: string, certificate: string): HSMX509Identity;
}

export class X509WalletMixin implements WalletMixin {
	constructor();
	static createIdentity(mspId: string, certificate: string, privateKey: string): X509Identity;
}


//-------------------------------------------
// Plugins
//-------------------------------------------

//-------------------------------------------
// query handler plugin type definitions
//-------------------------------------------
export abstract class QueryHandler {
	constructor(channel: Channel, mspId: string, peerMap: Map<string, Client.Peer>, queryOptions: any);
	initialize(): Promise<void>;
	abstract queryChaincode(chaincodeId: string, functionName: string, params: string, txId: TransactionId): Promise<Buffer>;
	dispose(): void;
}


// -------------------------------------
// Event Handler plugin type definitions
// -------------------------------------
export abstract class EventManager {
	constructor(channel: string, mspId: string, peerMap: Map<string, Client.Peer>, eventMgmtOptions: any);
	initalize(): Promise<void>;
	dispose(): void;
	//addEventHub(eventHub: ChannelEventHub): void;
	//getEventHubs(): ChannelEventHub[];  // FUTURE: Do we want an eventhub map against mspid ?
	//setEventHubs(availableEventHubs: ChannelEventHub[]): void;
	//checkCommitEventHubs(): void;
	//disconnectEventHubs(): void;
    abstract createCommitHandler(txid: string): CommitHandler;
    abstract createEventListener(): EventListener;

	//chaincodeEventsEnabled(): boolean;
	//abstract createChaincodeEventHandler(chaincodeId: string, eventName: string): ChaincodeEventHandler;
	//abstract createBlockEventHandler(): BlockEventHandler;
}

export abstract class CommitHandler {
    abstract checkEventHubs(): void;
	abstract startListening(): Promise<void>;
	abstract waitForEvents(): Promise<void>;
	abstract cancelListening(): void;
}



export abstract class EventListener {
    registerBlockEvent(callback: () => void, options: object): object;
    unRegisterBlockEvent(handle: object): void;

    registerCCEvent(callback: () => void, options: object): object;
    unRegisterCCEvent(handle: object): void;

}


// real implementation definition, bit annoying to have to define
// it twice, once for JS users and again for TS users
export enum DefaultCommitHandlerStrategies {
	MSPID_SCOPE_ALLFORTX = 'MSPID_SCOPE_ALLFORTX',
	MSPID_SCOPE_ANYFORTX = 'MSPID_SCOPE_ANYFORTX',
	CHANNEL_SCOPE_ALLFORTX = 'CHANNEL_SCOPE_ALLFORTX',
	CHANNEL_SCOPE_ANYFORTX = 'CHANNEL_SCOPE_ANYFORTX'
}


