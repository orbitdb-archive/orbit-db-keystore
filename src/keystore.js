'use strict'
const levelup = require('levelup')
const crypto = require('libp2p-crypto')
const secp256k1 = require('secp256k1')
const LRU = require('lru')
const Buffer = require('safe-buffer/').Buffer
const { verifier } = require('./verifiers')

class Keystore {
  constructor (store) {
    this._store = store
    this._cache = new LRU(100)
  }

  async open () {
    const status = this._store._db.status
    if (status === 'opening' || status === 'open') {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      this._store.open((err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }

  async close () {
    if (this._store._db.status === 'closed') {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      this._store.close((err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }

  async hasKey (id) {
    if (!id) {
      throw new Error('id needed to check a key')
    }
    if (!this._store || this._store._db.status === 'closed') {
      await this.open()
    }
    if (this._store.status && this._store.status !== 'open') {
      return Promise.resolve(null)
    }

    let hasKey = false
    try {
      let storedKey = this._cache.get(id) || await this._store.get(id)
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
    if (!this._store || this._store._db.status === 'closed') {
      await this.open()
    }
    if (this._store.status && this._store.status !== 'open') {
      return Promise.resolve(null)
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
    const decompressedKey = secp256k1.publicKeyConvert(keys.public.marshal(), false)
    const key = {
      publicKey: decompressedKey.toString('hex'),
      privateKey: keys.marshal().toString('hex')
    }

    try {
      await this._store.put(id, JSON.stringify(key))
    } catch (e) {
      console.log(e)
    }
    this._cache.set(id, key)

    return keys
  }

  async getKey (id) {
    if (!id) {
      throw new Error('id needed to get a key')
    }
    if (!this._store || this._store._db.status === 'closed') {
      await this.open()
    }
    if (this._store.status && this._store.status !== 'open') {
      return Promise.resolve(null)
    }

    const cachedKey = this._cache.get(id)
    let storedKey
    try {
      storedKey = cachedKey || await this._store.get(id)
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

  async sign (key, data) {
    if (!key) {
      throw new Error('No signing key given')
    }

    if (!data) {
      throw new Error('Given input data was undefined')
    }

    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data)
    }

    return new Promise((resolve, reject) => {
      key.sign(data, (err, signature) => {
        if (!err) {
          resolve(signature.toString('hex'))
        }
        reject(err)
      })
    })
  }

  getPublic(keys, options = {}) {
    const formats = ['hex', 'buffer']
    const decompress = options.decompress || true
    const format = formats[options.format || 'hex']
    let pubKey = keys.public.marshal()
    if (decompress) {
      pubKey = secp256k1.publicKeyConvert(pubKey, false)
    }
    return format === 'buffer' ? pubKey : pubKey.toString('hex')
  }

  async verify (signature, publicKey, data, v = 'v1') {
    return Keystore.verify(signature, publicKey, data, v)
  }

  static async verify (signature, publicKey, data, v = 'v1') {
    return verifier(v).verify(signature, publicKey, data)
  }
}

module.exports = (storage, mkdir) => {
  return {
    create: (directory = './keystore') => {
      // If we're in Node.js, mkdir module is expected to passed
      // and we need to make sure the directory exists
      if (mkdir) { // TODO: What is mkdir.c??
        mkdir.sync(directory)
      }

      const store = levelup(storage(directory))
      const keystore = new Keystore(store)
      return keystore
    },
    destroy: () => {
      return new Promise((resolve, reject) => {
        storage.destroy(directory, (err) => {
          if (err) {
            return reject(err)
          }
          resolve()
        })
      })
    },
    verify: Keystore.verify
  }
}
