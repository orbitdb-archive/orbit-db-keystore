'use strict'

const mkdirp = require('mkdirp')
const EC = require('elliptic').ec
const ec = new EC('secp256k1')
// const LRU = require('lru')

// let keystore
// const cache = new LRU(100)

// if (typeof localStorage === "undefined" || localStorage === null) {
//   const LocalStorage = require('node-localstorage').LocalStorage
//   keystore = new LocalStorage('./')
// } else {
//   keystore = localStorage
// }

class Keystore {
  constructor(directory = './keystore') {
    if (typeof localStorage === "undefined" || localStorage === null) {
      mkdirp.sync(directory)
      const LocalStorage = require('node-localstorage').LocalStorage
      this._storage = new LocalStorage(directory)
    } else {
      this._storage = localStorage
    }
    // this._cache = new LRU(100)
  }

  createKey(id) {
    const key = ec.genKeyPair()
    const publicKey = key.getPublic('hex')
    const privateKey = key.getPrivate('hex')
    this._storage.setItem(id, JSON.stringify({ publicKey: publicKey, privateKey: privateKey }))
    return key
  }

  getKey(id) {
    let key = JSON.parse(this._storage.getItem(id))

    if (!key)
      return

    const k = ec.keyPair({ 
      pub:  key.publicKey, 
      priv: key.privateKey,
      privEnc: 'hex',
      pubEnc: 'hex',
    })

    return k
  }

  static importKeyFromIpfs(ipfs, hash) {
    // const cached = cache.get(hash)
    // if (cached)
    //   return Promise.resolve(cached)

    return ipfs.object.get(hash, { enc: 'base58' })
      .then((obj) => JSON.parse(obj.toJSON().Data))
      .then((key) => {
        // cache.set(hash, ec.keyFromPublic(key, 'hex'))
        return OrbitCrypto.importPublicKey(key)
      })
  }

  static exportPublicKeyToIpfs(ipfs, key) {
    const k = key.getPublic('hex')

    // const cached = cache.get(k)
    // if (cached)
    //   return Promise.resolve(cached)

    return OrbitCrypto.exportPublicKey(key)
      .then((k) => JSON.stringify(k, null, 2))
      .then((s) => new Buffer(s))
      .then((buffer) => ipfs.object.put(buffer))
      .then((res) => {
        // cache.set(k, res.toJSON().Hash)
        return res.toJSON().multihash
      })
  }

  static getKey(id) {
    let savedKeys = JSON.parse(keystore.getItem(id))
    let key, publicKey, privateKey

    if(savedKeys) {
      return OrbitCrypto.importPrivateKey(savedKeys.privateKey)
        .then((privKey) => privateKey = privKey)
        .then(() => OrbitCrypto.importPublicKey(savedKeys.publicKey))
        .then((pubKey) => publicKey = pubKey)
        .then(() => {
          // return { publicKey: publicKey, privateKey: privateKey }
          // return key
          return ec.keyPair({ pub: publicKey, priv: privateKey })
        })
    }

    return OrbitCrypto.generateKey()
      .then((keyPair) => key = keyPair)
      .then(() => OrbitCrypto.exportPrivateKey(key))
      .then((privKey) => privateKey = privKey)
      .then(() => OrbitCrypto.exportPublicKey(key))
      .then((pubKey) => publicKey = pubKey)
      .then(() =>{
        keystore.setItem(id, JSON.stringify({ publicKey: publicKey, privateKey: privateKey }))
        // return { publicKey: key, privateKey: key }
        // return ec.keyFromPublic(key, 'hex')
        return ec.keyPair({ pub: publicKey, priv: privateKey })
      })
  }

  generateKey() {
    return Promise.resolve(ec.genKeyPair())
  }

  exportPublicKey(key) {
    return Promise.resolve(key.getPublic('hex'))
  }

  exportPrivateKey(key) {
    return Promise.resolve(key.getPrivate('hex'))
  }

  importPublicKey(key) {
    return Promise.resolve(ec.keyFromPublic(key, 'hex'))
  }

  importPrivateKey(key) {
    return Promise.resolve(ec.keyFromPrivate(key, 'hex'))
  }

  sign(key, data) {
    const sig = ec.sign(data, key)
    return Promise.resolve(sig.toDER('hex'))
  }

  verify(signature, key, data) {
    let res = false
    res = ec.verify(data, signature, key)
    return Promise.resolve(res)
  }
}

module.exports = Keystore
