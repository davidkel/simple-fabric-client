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

const {CommitHandler} = require('../../api/eventmanagement');
const CommitHandlerConstants = require('../../defaultcommitstrategies');

const STRATEGY_PASSED = 1;
const STRATEGY_STILLONGOING = 0;
const STRATEGY_FAILED = -1;

class DefaultCommitHandler extends CommitHandler {

    /**
     * Check the connectivity status of an event hub
     * @param {ChannelEventHub} eventHub the channel event hub to check connectivity status for
     * @returns {boolean} true if appears to be connected ok
     */
    static eventHubConnected(eventHub) {
        const connectionState = eventHub.checkConnection();
        // An eventHub can be connected, but in 1 of 3 states: IDLE, CONNECTING or READY.
        // if it's IDLE or CONNECTING then the channel still usable, it's just either freed resources (IDLE) internally
        // or in a state of re-establishing the connection (CONNECTING). But because the node sdk in _checkConnection
        // checks only for the READY state and disconnects it and throws an error otherwise, and _checkConnection is used
        // for the registrations, we can only check for READY. The default for IDLE_TIMEOUT for GRPC is as far as I know
        // for now, INT_MAX so connnections should never go into IDLE or CONNECTING state.
        return eventHub.isconnected() && (connectionState === 'READY' || connectionState === true);
    }


    /**
     * Construct a Tx Event Handler.
     * @param {EventHub[]} eventHubs the event hubs to listen for tx events  //TODO: fix
     * @param {String} txId the txid that is driving the events to occur
     * @param {Integer} timeout how long (in seconds) to wait for events to occur.
     */
    constructor(eventMgr, txId) {
        super();
        this.eventHubs = eventMgr.getCommitEventHubs();
        if (!this.eventHubs || this.eventHubs.length === 0) {
            throw new Error('No event hubs defined');
        }
        if (!txId) {
            throw new Error('No transaction id provided');
        }
        this.eventMgr = eventMgr;
        this.txId = txId;
        this.mspId = eventMgr.mspId;  // TODO: Need to handle
        this.options = eventMgr.options;  //TODO: Need to handle

        this.eventsByMspId = null;
        this.notificationPromise = null;
        this.timeoutHandle = null;

        // build the strategy map
        // how to handle a custom one ?
        this.strategyMap = new Map([
            [CommitHandlerConstants.MSPID_SCOPE_ALLFORTX, {
                checkInitialState: this._checkInitialCountByMspId,
                eventReceived: this._checkRemainingEventsForMspId,
                errorReceived: this._checkRemainingEventsForMspId
            }],
            [CommitHandlerConstants.MSPID_SCOPE_ANYFORTX, {
                checkInitialState: this._checkInitialCountByMspId,
                eventReceived: () => { return STRATEGY_PASSED;},
                errorReceived: this._checkRemainingEventsForMspId
            }],
            [CommitHandlerConstants.CHANNEL_SCOPE_ALLFORTX, {
                checkInitialState: this._checkInitialCountByMspId,
                eventReceived: this._checkEachMspIdForEvents,
                errorReceived: this._checkEachMspIdForEvents
            }],
            [CommitHandlerConstants.CHANNEL_SCOPE_ANYFORTX, {
                checkInitialState: this._checkInitialCountTotal,
                eventReceived: () => { return STRATEGY_PASSED;},
                errorReceived: this._checkRemainingEventsForAll
            }],
        ]);
    }


    /**
     * check that each MSPid has at least 1 event hub. If we have only connected to event hubs
     * of a specific mspid, then there will only be a single MSPid set to check
     *
     *
     * @memberof DefaultCommitHandler
     */
    async _checkInitialCountByMspId() {
        console.log('eventCount', this.eventsByMspId);
        let reestablish = false;
        if (this.eventsByMspId.size === 0) {
            reestablish = true;
        }
        this.eventsByMspId.forEach((entry) => {
            if (entry.initial < 1) {
                reestablish = true;
            }
        });
        if (reestablish) {
            await this.eventMgr._establishEventHubsForStrategy();
        }

        if (this.eventsByMspId.size === 0) {
            throw new Error('no event hubs available');
        }
        this.eventsByMspId.forEach((entry) => {
            if (entry.initial < 1) {
                // try to recover the event hubs ?
                throw new Error('not enough connected event hubs to satisfy strategy');
            }
        });

    }

    /**
     * check that there is at least 1 event hub
     *
     *
     * @memberof DefaultCommitHandler
     */
    async _checkInitialCountTotal() {
        let total = 0;
        this.eventsByMspId.forEach((entry) => {
            total += entry.initial;
        });
        if (total < 1) {
            await this.eventMgr._establishEventHubsForStrategy();
            this.eventsByMspId.forEach((entry) => {
                total += entry.initial;
            });
            if (total < 1) {
                throw new Error('not enough connected event hubs to satisfy strategy');
            }
        }
    }


    /**
     * Check event hubs for an MSPid. If all event hubs have returned or errored
     * and we have at least 1 valid response then that is a pass, otherwise it's
     * a fail. However we are still onging if there are still outstanding events
     * for this mspId
     * Can be called for both error and event processing. for event processing
     * count.valid will always be > 0.
     *
     * @param {*} mspId
     * @param {*} count
     * @returns
     * @memberof DefaultCommitHandler
     */
    _checkRemainingEventsForMspId(mspId, count) {
        if (count.remaining < 1) {
            if (count.valid > 0) {
                return STRATEGY_PASSED;
            } else {
                return STRATEGY_FAILED;
            }
        }
        return STRATEGY_STILLONGOING;
    }

    /**
     * for both event and error handling.
     * check each MSP id to see if they have at least 1 valid event or could still receive
     * a valid event if none received. Determines if it's either passed, failed or still
     * possible.
     *
     * @param {*} mspid
     * @param {*} count
     * @returns
     * @memberof DefaultCommitHandler
     */
    _checkEachMspIdForEvents(mspid, count) {
        let passed = true;
        let failed = false;

        // TODO: forEach is the wrong way to iterate here
        this.eventsByMspId.forEach((entry) => {
            if (entry.valid === 0) {
                if (entry.remaining === 0) {
                    failed = true;
                } else {
                    passed = false;
                }
            }
        });

        if (passed) {
            return STRATEGY_PASSED;
        }
        if (failed) {
            return STRATEGY_FAILED;
        }

        return STRATEGY_STILLONGOING;
    }

    /**
     * on error event only, if there are no event handlers left, this is a strategy failure.
     *
     * @param {*} mspId
     * @param {*} count
     * @returns
     * @memberof DefaultCommitHandler
     */
    _checkRemainingEventsForAll(mspId, count) {
        let totalleft = 0;

        this.eventsByMspId.forEach((entry) => {
            totalleft += entry.remaining;
        });

        if (totalleft === 0) {
            return STRATEGY_FAILED;
        }

        return STRATEGY_STILLONGOING;
    }


    /**
     * add in to the list of eventhubs to wait on, only the ones which we know are connected
     * once we have that list, check they satisfy the strategy.
     */
    async _getConnectedHubs() {
        // requires that we know that all connect requests have been processed (either successfully or failed to connect)
        const connectedHubs = [];
        this.eventsByMspId = new Map();
        for (const eventHub of this.eventHubs) {
            // we can guarantee that at this point if an event hub could be connected then
            // it will have been flagged as connected.
            if (DefaultCommitHandler.eventHubConnected(eventHub)) {
                connectedHubs.push(eventHub);
                let count = this.eventsByMspId.get(eventHub._EVH_mspId);
                if (!count) {

                    // initial number of connected event hubs for the mspid
                    // along with the remaining number of event hubs to respond
                    count = {initial: 1, remaining: 1};
                    this.eventsByMspId.set(eventHub._EVH_mspId, count);
                } else {
                    count.initial++;
                    count.remaining++;
                }
            } else {
                console.log('event hub not connected');
            }
        }

        const connectStrategy = this.strategyMap.get(this.options.commitStrategy);
        await connectStrategy.checkInitialState.call(this);

        return connectedHubs;
    }

    _checkStrategyStatus(mspId, errorReceived) {
        const count = this.eventsByMspId.get(mspId);
        count.remaining--;
        if (!errorReceived) {
            count.valid = count.valid ? count.valid + 1 : 1;
        }
        this.eventsByMspId.set(mspId, count);

        const commitStrategy = this.strategyMap.get(this.options.commitStrategy);
        if (!errorReceived) {
            return commitStrategy.eventReceived.call(this, mspId, count);
        } else {
            return commitStrategy.errorReceived.call(this, mspId, count);
        }
    }

    /**
     * background request to check the event hubs are connected
     */
    quickCheckEventHubs() {
        this.eventMgr._checkCommitEventHubs();
    }

    /**
     * Start listening for events.
     */
    async startListening() {

        // - check that there are enough and correct connected event hubs to satisfy strategy
        this.connectedHubs = await this._getConnectedHubs();

        let txResolve, txReject;

        // set up a single promise and break out the promise handlers
        // - A single promise held which resolves when enough events are received or rejects if err handler fires
        //   which would break the strategy
        this.notificationPromise = new Promise((resolve, reject) => {
            txResolve = resolve;
            txReject = reject;
        });


        // create a single timeout handler which rejects the single promise if it fires
        this.timeoutHandle = setTimeout(() => {
            this.cancelListening();
            txReject(new Error('Event strategy not satisified within the timeout period'));
        }, this.options.commitTimeout * 1000);

        for (const hub of this.connectedHubs) {
            console.log('registering for event');

            // - when enough events are received, strategy broken, timeout fires, should unregister all txevent listeners
            hub.registerTxEvent(this.txId,
                (tx, code) => {
                    console.log(new Date(), 'got event');
                    hub.unregisterTxEvent(this.txId);
                    if (code !== 'VALID') {
                        this.cancelListening();
                        txReject(new Error(`Peer ${hub.getPeerAddr()} has rejected transaction '${this.txId}' with code ${code}`));
                    } else {
                        if (this._checkStrategyStatus(hub._EVH_mspId, false) === STRATEGY_PASSED) {
                            this.cancelListening();
                            txResolve();
                        }
                    }
                },
                (err) => {
                    console.log(new Date(), 'got an error', err);
                    hub.unregisterTxEvent(this.txId);
                    const strategyStatus = this._checkStrategyStatus(hub._EVH_mspId, true);
                    if (strategyStatus !== STRATEGY_STILLONGOING) {
                        this.cancelListening();
                        if (strategyStatus === STRATEGY_FAILED) {
                            txReject(new Error('not possible to satisfy the event strategy due to loss of event hub comms'));
                        }
                        // a failure of an event hub could still mean the strategy was satisfied
                        // eg we are waiting for all and got some, but the last one just failed
                        txResolve();
                    }
                }
            );

        }

    }

    /**
     * wait for all event hubs to send the tx event.
     * @returns {Promise} a promise which is resolved when all the events have been received, rejected if an error occurs.
     */
    async waitForEvents() {
        console.log('inside waitForEvents');
        if (this.notificationPromise) {
            console.log(new Date(), 'about to await');
            await this.notificationPromise;
            console.log(new Date(), 'unblocked');
        } else {
            throw new Error('cannot wait for notification');
        }
    }

    /**
     * cancel listening for events
     */
    async cancelListening() {
        clearTimeout(this.timeoutHandle);
        for (const hub of this.connectedHubs) {
            hub.unregisterTxEvent(this.txId);
        }
    }
}

module.exports = DefaultCommitHandler;
