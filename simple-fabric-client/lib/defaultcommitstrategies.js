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


// Strategy definitions:
// MSPID_SCOPE_ALLFORTX - Listen for all on your org
//   - add all event hubs for that org
//   - wait for all that are still connected, minimum 1) - DEFAULT
// MSPID_SCOPE_ANYFORTX - Listen for any on your org
//   - add all event hubs for that org
//   - wait for first 1
// CHANNEL_SCOPE_ALLFORTX - Listen for all peers in the channel
//   - add all event hubs for the channel
//   - wait for all that are connected, minimum 1 from each org
// CHANNEL_SCOPE_ANYFORTX - Listen for any peers in the channel
//   - add all event hubs for the channel
//   - add all event hubs for the channel, wait for first 1

// ---- COMPLEX strategies -----
// - Listen for any org peer for all orgs in the channel (add all events hubs, wait for 1 from each org)
// - Listen for all leader peers in the channel (if you can determine the leader peers)
// - Listen for any leader peer in the channel (if you can determine the leader peers)

// ---- Chaincode events ------
// strategy scope defines what event hubs will be connected thus all need to be registered for chaincode
// events, need to de-dup somehow. Can't just connect to 1 and if that fails, connect to another as we could
// miss an event. We may be able to cope with that if we track the block number ourselves internally.



module.exports.MSPID_SCOPE_ALLFORTX = 'MSPID_SCOPE_ALLFORTX';
module.exports.MSPID_SCOPE_ANYFORTX = 'MSPID_SCOPE_ANYFORTX';
module.exports.CHANNEL_SCOPE_ALLFORTX = 'CHANNEL_SCOPE_ALLFORTX';
module.exports.CHANNEL_SCOPE_ANYFORTX = 'CHANNEL_SCOPE_ANYFORTX';
