import { firmwareAPI, HARDENED } from './bitbox02';

const getCoinFromChainId = chainId => {
    switch(chainId) {
        case 1:
            return firmwareAPI.messages.ETHCoin.ETH;
        case 3:
            return firmwareAPI.messages.ETHCoin.RopstenETH;
        case 4:
        case 42:
            return firmwareAPI.messages.ETHCoin.RinkebyETH;
        default:
            throw new Error('Unsupported network');
    }
}

/**
 * @param pathString keypath in string format e.g. m/44'/1'/0'/0
 * @returns keypath as array e.g. [2147483692, 2147483649, 2147483648, 0]
 */
export const getPathFromString = pathString => {
    const levels = pathString.toLowerCase().split('/');
    if (levels[0] !== 'm') throw new Error('Invalid keypath');
    return levels.flatMap(level => {
        if (level === 'm' || level === '') {
            return [];
        }
        if (level.substring(level.length - 1) === "'") {
            level = +level.substring(0, level.length - 1) + HARDENED;
        }
        level = parseInt(level);
        if (isNaN(level) || level < 0) throw new Error('Invalid keypath');
        return level;
    })
}

/**
 * @param pathArray keypath as an array of ints e.g. [44, 1, 0, 0]; or hardened [2147483692, 2147483649, 2147483648, 0]
 * FIXME: This is a slight hack until the device is provided with the network by the integrating service
 * The only noticeable consequence is that when using the Rinkeby testnet, the user would see 'Ropsten' on device
 * @returns ETHCoin.ETH for mainnet ([44, 60]) and ETHCoin.RopstenETH for testnets ([44, 1])
 */
export const getCoinFromPath = pathArray => {
    if (pathArray[0] !== 44 && pathArray[0] !== 44 + HARDENED) {
        throw new Error('Invalid keypath');
    }
    switch(pathArray[1]) {
        case 60:
        case 60 + HARDENED:
            return firmwareAPI.messages.ETHCoin.ETH;
        case 1:
        case 1 + HARDENED:
            return firmwareAPI.messages.ETHCoin.RopstenETH;
        default:
            throw new Error('Invalid keypath');
    }
}

/**
 * Sanitizes signature data provided by the 'ethereumjs' library's Transaction type
 * https://github.com/ethereumjs/ethereumjs-tx/blob/master/src/transaction.ts
 * and returns them in the format needed by BB02's AsyncETHSign
 *
 * @param sigData should include the following:
 *
 * ```
 * const signatureData = {
 *     account: id,      // id: number, account number in the ETH keypath m/44'/60'/0'/0/<id>
 *     recipient: tx.to, // Buffer(Uint8Array(20))
 *     tx: {
 *       value           // hex
 *       data            // hex
 *       chainId         // number
 *       nonce           // hex
 *       gasLimit        // hex
 *       gasPrice        // hex
 *      },
 *     data: tx.data // Buffer(Uint8Array)
 *   }
 * ```
 */
export const sanitizeEthTransactionData = sigData => {
    try {
        let sanitizedData = {};
        sanitizedData.nonce = 0;
        sanitizedData.value = '0';
        sanitizedData.coin = getCoinFromChainId(sigData.tx.chainId);
        sanitizedData.path = getPathFromString(sigData.path);
        if (sigData.tx.nonce) {
            sanitizedData.nonce = parseInt(sigData.tx.nonce, 16)
        }
        sanitizedData.gasPrice = parseInt(sigData.tx.gasPrice, 16).toString();
        sanitizedData.gasLimit = parseInt(sigData.tx.gasLimit, 16);
        sanitizedData.recipient = new Buffer(sigData.recipient);
        if (sigData.tx.value) {
            sanitizedData.value = parseInt(sigData.tx.value, 16).toString();
        }
        sanitizedData.data = new Buffer(sigData.data);
        sanitizedData.chainId = sigData.tx.chainId;
        return sanitizedData;
    } catch (e) {
        throw new Error('ethTx data sanitization failed: ', e);
    }
}
