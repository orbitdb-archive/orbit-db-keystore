/* globals localStorage */
'use strict'
const crypto = require('libp2p-crypto')
const LRU = require('lru')

class Keystore {
  constructor (storage) {
    this._storage = storage
    this._cache = new LRU(100)
  }

  hasKey (id) {
    if (!id) {
      throw new Error('id needed to check a key')
    }
    let hasKey = false
    let storedKey = this._cache.get(id) || this._storage.getItem(id)
    try {
      hasKey = storedKey !== undefined && storedKey !== null
    } catch (e) {
      // Catches 'Error: ENOENT: no such file or directory, open <path>'
      console.error('Error: ENOENT: no such file or directory')
    }
    return hasKey
  }

  async createKey (id) {
    if (!id) {
      throw new Error('id needed to create a key')
    }

    const genKeyPair = () => new Promise((resolve, reject) => {
      crypto.keys.generateKeyPair('secp256k1', 256, (err, key) => {
        if (!err) {
          resolve(key)
        }
        reject(err)
      })
    })

    const keys = await genKeyPair()

    const key = {
      publicKey: keys.public.marshal().toString('hex'),
      privateKey: keys.marshal().toString('hex')
    }

    this._storage.setItem(id, JSON.stringify(key))
    this._cache.set(id, key)
    return keys
  }

  getKey (id) {
    if (!id) {
      throw new Error('id needed to get a key')
    }
    const cachedKey = this._cache.get(id)
    let storedKey
    try {
      storedKey = cachedKey || this._storage.getItem(id)
    } catch (e) {
      // ignore ENOENT error
    }

    if (!storedKey) {
      return
    }

    const deserializedKey = cachedKey || JSON.parse(storedKey)
    if (!deserializedKey) {
      return
    }

    if (!cachedKey) {
      this._cache.set(id, deserializedKey)
    }

    const genPrivKey = (pk) => new Promise((resolve, reject) => {
      crypto.keys.supportedKeys.secp256k1.unmarshalSecp256k1PrivateKey(pk, (err, key) => {
        if (!err) {
          resolve(key)
        }
        reject(err)
      })
    })

    return genPrivKey(Buffer.from(deserializedKey.privateKey, 'hex'))
  }

  sign (key, data) {
    if (!key) {
      throw new Error('No signing key given')
    }

    if (!data) {
      throw new Error('Given input data was undefined')
    }

    const genSig = () => new Promise((resolve, reject) => {
      key.sign(data, (err, signature) => {
        if (!err) {
          resolve(signature.toString('hex'))
        }
        reject(err)
      })
    })
    return genSig()
  }

  async verify (signature, publicKey, data) {
    return Keystore.verify(signature, publicKey, data)
  }

  static async verify (signature, publicKey, data) {
    if (!signature) {
      throw new Error('No signature given')
    }
    if (!publicKey) {
      throw new Error('Given publicKey was undefined')
    }
    if (!data) {
      throw new Error('Given input data was undefined')
    }

    const isValid = (key, msg, sig) => new Promise((resolve, reject) => {
      key.verify(msg, sig, (err, valid) => {
        if (!err) {
          resolve(valid)
        } else {
          console.warn(err.message)
          resolve(false)
        }
      })
    })

    const pubKey = crypto.keys.supportedKeys.secp256k1.unmarshalSecp256k1PublicKey(Buffer.from(publicKey, 'hex'))
    return isValid(pubKey, data, Buffer.from(signature, 'hex'))
  }
}

module.exports = (LocalStorage, mkdir) => {
  return {
    create: (directory = './keystore') => {
      // If we're in Node.js, mkdir module is expected to passed
      // and we need to make sure the directory exists
      if (mkdir && mkdir.sync) {
        mkdir.sync(directory)
      }
      // In Node.js, we use the injected LocalStorage module,
      // in the browser, we use the browser's localStorage
      const storage = LocalStorage ? new LocalStorage(directory) : localStorage
      return new Keystore(storage)
    },
    verify: Keystore.verify
  }
}
