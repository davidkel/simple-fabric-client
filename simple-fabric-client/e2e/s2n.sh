source ./setup.sh
# ---> Dev mode fabric

# standard dev mode single peer
./fabric/startFabric.sh -d
CORE_PEER_LOCALMSPID=${MSPID} CORE_PEER_MSPCONFIGPATH=${MSP} ${PEER} chaincode install -l node -n demo -p ./dummy -v 0.0.1
CORE_CHAINCODE_ID_NAME="demo:0.0.1" node chaincode/simpleChaincode.js --peer.address grpc://localhost:7052 &

# uncomment if you are using 2 peer fabric for dev mode
CORE_PEER_ADDRESS=localhost:8051 CORE_PEER_LOCALMSPID=${MSPID} CORE_PEER_MSPCONFIGPATH=${MSP} ${PEER} chaincode install -l node -n demo -p ./dummy -v 0.0.1
CORE_CHAINCODE_ID_NAME="demo:0.0.1" node chaincode/simpleChaincode.js --peer.address grpc://localhost:8052 &

# <--- Dev mode fabric

# uncomment to use non-development mode fabric and comment dev version out
# ./fabric/startFabric.sh
# CORE_PEER_LOCALMSPID=${MSPID} CORE_PEER_MSPCONFIGPATH=${MSP} ${PEER} chaincode install -l node -n demo -p ${PWD}/dummy/ -v 0.0.1

# uncomment if you are using 2 peer fabric for non dev mode
# CORE_PEER_ADDRESS=localhost:8051 CORE_PEER_LOCALMSPID=${MSPID} CORE_PEER_MSPCONFIGPATH=${MSP} ${PEER} chaincode install -l node -n demo -p ${PWD}/dummy/ -v 0.0.1

sleep 5
CORE_PEER_LOCALMSPID=${MSPID} CORE_PEER_MSPCONFIGPATH=${MSP} ${PEER} chaincode instantiate -o localhost:7050 -C composerchannel -l node -n demo -v 0.0.1 -c '{"Args":["init", "key1", "1", "key2", "2"]}' -P "OR ('Org1MSP.member')"
