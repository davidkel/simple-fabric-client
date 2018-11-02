# Misc:
- Examples and Docs
- Unit tests, package tests, integration tests
- logging
- What about IDManager ?
- variables should not use org but mspId

# Performance:

# Service Discovery:
- Understand Service Discovery more, what are the configurable options available
- How should service discovery be used ?

# HA:
- Better HA for multiple peers in an org when using CCP
- initializeChannel better HA plus only required for submit/notify and discovery

# Event Handling:
- Chaincode event handling
- need to filter down the peerMap to only include event source peers.

# Query Handling:
- Need to filter down the peerMap to only include queryable peers


# Contracts:
- Should identities be at the network level or contract level ? See below, but then contracts would need their own event hubs maybe to share for ids in the same msp
- Switching identities in a network, how do existing contracts handle ? - Bad idea, not going to do it. Event hubs are connected using an identity so
  should you be allowed to switch identities but continue to use those event hubs ? maybe ok if you have access to both identities but then there
  is the case of what if you changed the identity to a different mspid. So for now Identity is locked to an instance of the network class

- getContract should return a cached getContract



Network --> Client + User
Channel --> Channel + ChannelEventHub
Contract
Wallet




- share peer objects across channels (but roles is channel specific, so may have to separate roles from the peers)
- txid do we want to hide completely ?
- discovery may not be limited to channel level may be able to discover at a higher level
- txId changes, not a concern for us we just use the basic nounce, txid string
- can't share eventhubs as they are connected using a specific identity, and I don't like the idea of constant connect/disconnect option




hlfconnection/hlfconnectionmanager capabilities
==========================
- General operational capabilities (composer network install/start/upgrade) - no need for download/list/ping/reset/loglevel
  - perform a peer install
  - perform a channel start
  - perform a channel upgrade

- Programming interaction
  - submit/notify (with chaincode events)
  - query

- CA Interaction (identity request, identity issue - for user registration, list, revoke. bind is not required)
  - request an identity based on user/secret
  - register a user on ca server

card management is replicated in the wallet implementation (composer card create/delete/export/import/list)

private data is sent over transient map apparantly
private data needs to target only peers of the appropriate organisations.

ACLs in composer don't protect against querying the ledger blocks directly.
