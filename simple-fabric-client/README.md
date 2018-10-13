# Prototype of the fabric Network capability
This prototype is a view on the ideas to be presented as part of an enhancement to the fabric-node-sdk with the hope of being able to relicate the same concepts to the Java SDK and hopefully the GO SDK. 

The problems that are trying to be addressed are

- An App developer should not have to be concerned with the make up of the network
- wanting to invoke chaincode that results in an update to the world state and blockchain easily
- being notified when the blockchain has been updated via a pluggable event handler mechanism with a default implementation
- Fault tolerance for peers
  - for initialising a channel, an attempt is made on a peer in the channel to initialize, if that fails the next one in the channel is tried
  - for querying peers only a single strategy is provided which is only peers in the identities mspId are tried, once one is found to respond it locks onto that peer. If it fails then it searches for another peer to lock onto
  - transaction submission is currently delegated back to the node-sdk which sends all proposals to peers in the channel for non discovery and whatever the default service discovery plugin provides when using 
- Both CCP and Service Discovery support
- Simplify identity management of the state store and keystores

(note that some of this may make sense to push to base fabric-client rather than be done here, for example initializing a channel to try other peers).

# Summary of Classes
A quick summary of what each of the packages and classes

## Network
This is the top level class that represents the fabric network, it is initialised either through a CCP or by using service discovery (support for Service Discovery has not be done). It also has a wallet associated with it which will be used to select identities stored in that wallet. At any one time only a single identity can be active on that network instance, Any contract obtained from that network instance will use the identity assigned to that network.
The Network initializes the channel (as it requires this for the validation part of transaction submission) and will try other peers in the channel if it cannot get a response from the first peer in the channel.

## Contract
This is the class that will be used to interact with specific chaincode. Developers will submit a transaction or query via a contract instance

## IDManager
In order to be able to easily test this prototype something was needed that provided simple interaction between identities issued by the ca server and the wallets. This class is currently not in scope for proposal. Developers would need to find a way to get the required certificate and private key into a wallet. They have to do something similar now anyway with the node sdk to get the information into the state store and key stores.

## API package
This defines a base set of superclases for all the pluggable capabilities this package offers
- eventhandler: how to manage and monitor peer event hubs
- query: strategy for which peers to query based on a list of available peers
- wallet: definition of a wallet class
- walletmixin: definition of a mixin for the wallet class

## impl/event
This contains 2 classes that implement the interface defined in the eventhandler file. The default implementation is designed to support multiple strategies of when is the right time to notify the client. The following 4 strategies are implemented and can be selected when creating a network instance

- S1: wait for all peers associated with the current identity's mspId to emit committed events, or disconnect the event hubs due to error. A client is unblocked successfully so long as all peers respond or error out with at least 1 peer responding with committed (This is the DEFAULT)
- S2: wait for the first peer associated with the current identity's mspId to emit a committed event
- S3: wait for at least 1 peer from each mspId to emit a committed event
- S4: wait for all peers in the channel to emit a committed event or disconnect the eventhub due to error. A client is unblocked successfully so long as at least 1 peer from each mspId responds with committed

If any of the event hubs respond with anything except a `VALID` response then an error is thrown.
if the strategy cannot be satisfied within a timeout period then an error is thrown
if at any time a event hub disconnects due to an error and that means the strategy cannot be satisified then an error is thrown


### DefaultEventHandlerFactory
The `Contact` class wants to be able to get an event handler for each transaction it needs to listen for. Also (but not implemented currently), there needs to be a chaincode event handler as well, probably won't be a need for a block event handler. This implementation provides a factory for these handlers. What it also does is provide management of the event hubs, ie only connecting to the relevant ones based on the strategy, and being able to disconnect them when required.

### DefaultTxEventHandler
This provides the implementation to listen for the transaction committed events and ensure either unblock the client when the strategy is satisfied or throw an error if a strategy cannot be satisfied.

## impl/query
This defines the interface to implement a query handler. Query handlers decide which peers to query given a list of possible choices

### DefaultQueryHandler
This is a default implmentation of a query handler that provides fault tolerance rather than performance. It will only query peers associated with the mspId it was constructed with and will "lock" onto a peer that responds. It goes through the list looking for a peer to lock onto. If a peers fails to respond it will look for another peer to lock on to.

## impl/wallet
This defines the concept of a wallet. A wallet is a place to keep identities. It hides the fact that you require both a state store and key store for the node sdk to be able to interact with a fabric. Wallet implementation provide a single view of where to store credential information as well as helper methods to import/export/list/delete/update etc identities via the wallet. It also allows a mixin to provide an alternative implementation for a keystore needed to provide HSM support.
Wallets are used to configure clients with the appropriate state/keystore implementations and locations as well as setting the user context of a client with the appropriate identity. 

Note the implementations here are not complete, but enough to run testing of the prototype

### FileSystemWallet
Provide a file based wallet where the state store and keystores are partitioned through directories named after the alias/label provided as a way to select an identity. It uses the standard file system based stores

### CouchDBWallet
Provide a couchdb based wallet where the state store and keystores are partitioned via different database names named after the alias/label provided as a way to select an identity. It uses the standard couchdb based stores

### InMemoryWallet
Provides an in memory wallet implementation for people who want to keep their certs and keys in pem format somewhere else but still be able to easily load them in for use by an application

### HSMWalletMixin
You can mix this into any wallet to enable that wallet to have it's keystore HSM managed rather than managed by the chosen wallet implementation. The state store remains the same.
