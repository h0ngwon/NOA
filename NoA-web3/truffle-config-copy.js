// truffle-config.js

const HDWalletProvider = require("truffle-hdwallet-provider-klaytn");

/**
 * Klaytn 네트워크에 컨트랙트를 배포하기 위한 트러플 네트워크 변수입니다.
 */
const NETWORK_ID = "1001";

/**
 * URL: URL for the remote node you will be using
 * PRIVATE_KEY: Private key of the account that pays for the transaction (Change it to your own private key)
 */
const URL = "https://api.baobab.klaytn.net:8651";

// Paste your `Private key` that has enough KLAY to truffle.js
const PRIVATE_KEY =
   

module.exports = {
    networks: {
        klaytn: {
            provider: () => new HDWalletProvider(PRIVATE_KEY, URL),
            network_id: NETWORK_ID,
            gas: "8500000",
            gasPrice: null,
        },
    },

    // Specify the version of compiler, we use 0.5.6
    compilers: {
        solc: {
            version: "0.5.6",
        },
    },
};
