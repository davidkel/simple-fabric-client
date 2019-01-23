'use strict';
//const FABRIC_CONSTANTS = require('fabric-client/lib/Constants');
const BaseQueryHandler = require('./basequeryhandler');

// can contain peers from all channels, this will be shared across all connections.
const peerCount = new Map();

class RoundRobinQueryHandler extends BaseQueryHandler {

    constructor(channel, mspId, peerMap, queryOptions) {
        super(channel, mspId, peerMap, queryOptions);
        this.allQueryablePeers = peerMap.get(mspId);  //TODO: should remove peers that don't have the CHAINCODE_QUERY ROLE ?

        // queryOptions could select different scopes here
        // this.allQueryablePeers = connection.getChannelPeersInOrg([FABRIC_CONSTANTS.NetworkConfig.CHAINCODE_QUERY_ROLE]);
        // this.allQueryablePeers = this.getChannelPeers();  // use this to spread across different orgs peers in the channel
    }


    /**
     * sort the peers in order from least used to most used
     * completely untested for more than 1 peer but you get the idea.
     */
    getPeersInOrder() {
        const peerOrder = [];
        this.allQueryablePeers.forEach((peer) => {
            const curPeerCount = peerCount.get(peer.getName());
            if (!curPeerCount || peerOrder.length == 0) {
                // peer never used or no peers in the order list at the moment
                // so put it into the array.
                peerOrder.unshift(peer);
                if (!curPeerCount) {
                    // peer never been used, set count to zero
                    peerCount.set(peer.getName(), 0);
                }
            } else {

                // find insert point
                let inserted = false;
                for (let i = 0; i < peerOrder.length; i++) {
                    if (curPeerCount < peerCount.get(peerOrder[i].getName())) {
                        peerOrder.splice(i, 0, peer);
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) {
                    peerOrder.push(peer);
                }
            }
        })
        return peerOrder;
    }

    getChannelPeers() {
        const channelPeers = this.channel.getChannelPeers();
        return channelPeers.filter((channelPeer) => {
            return channelPeer.isInRole(FABRIC_CONSTANTS.NetworkConfig.CHAINCODE_QUERY_ROLE)
        });
    }

    async queryChaincode(txId, functionName, args) {
        console.log('using the round robin handler');
        let success = false;
        let payload;
        let allErrors = [];

        if (this.allQueryablePeers.length === 0) {
            const newError = new Error('No peers have been provided that can be queried');
            throw newError;
        }

        const peerList = this.getPeersInOrder();
        console.log(peerList);
        console.log(peerCount);

        for (let i = 0; i < peerList.length && !success; i++) {
            let peer = peerList[i];
            try {
                payload = await this._querySinglePeer(peer, txId, functionName, args);
                const peerName = peer.getName();
                const curCount = peerCount.get(peerName)
                peerCount.set(peerName, curCount + 1);
                success = true;
                break;
            } catch (error) {
                allErrors.push(error);
            }
        }

        if (!success) {
            const newError = new Error(`No peers available to query. last error was ${allErrors[allErrors.length - 1]}`);
            throw newError;
        }
        if (payload instanceof Error) {
            throw payload;
        }
        return payload;
    }
}
module.exports = RoundRobinQueryHandler;

