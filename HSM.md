download the source code from https://dist.opendnssec.org/source/softhsm-2.2.0.tar.gz
tar -xvf softhsm-2.2.0.tar.gz
cd softhsm-2.2.0
./configure --disable-gost (would require additional libraries, turn it off unless you need gost algorithm support for the Russian market)
make
sudo make install
set environment variable "SOFTHSM2_CONF" to "./test/fixtures/softhsm2.conf"
create a token to store keys inside slot 0: softhsm2-util --init-token --slot 0 --label "My token 1", you will be prompted two PINs: SO (Security Officer) PIN that can be used to re-initialize the token, and user PIN to be used by applications to access the token for generating and retrieving keys

softhsm2.conf
# SoftHSM v2 configuration file

directories.tokendir = /tmp/
objectstore.backend = file

# ERROR, WARNING, INFO, DEBUG
log.level = INFO

or

# install softhsm
mkdir softhsm
cd softhsm
curl -O https://dist.opendnssec.org/source/softhsm-2.0.0.tar.gz
tar -xvf softhsm-2.0.0.tar.gz
cd softhsm-2.0.0
./configure --disable-non-paged-memory --disable-gost
make
sudo make install

# now configure slot 0 with pin
sudo mkdir -p /var/lib/softhsm/tokens
sudo chmod 777 /var/lib/softhsm/tokens
softhsm2-util --init-token --slot 0 --label "ForComposer" --so-pin 1234 --pin 98765432


