'use strict'

const mkdirp = require('mkdirp')
const EC = require('elliptic').ec
const ec = new EC('secp256k1')
// const LRU = require('lru')
const crypto = require('libp2p-crypto').keys

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

  async createKey(id) {
    return new Promise((resolve, reject) => {
      // console.log(crypto)
      crypto.generateKeyPair('RSA', 1024, (err, key) => {
        // console.log("PUB :", err, key.public.bytes.toString('hex'))
        // console.log("PRIV:", err, key.bytes.toString('hex'))
        // crypto.marshalPublicKey(key, 'ed25519', (err, bytes) => {
        //   console.log("KEYS:", err, bytes)
        // })

        const bytes = Buffer.from(key.public.bytes.toString('hex'), 'hex')
        // console.log(crypto.keysPBM.PublicKey.decode(bytes))
        const pubKey = crypto.unmarshalPublicKey(bytes)
          // console.log("PUB2:", err, pubKey.bytes.toString('hex'))
          // console.log("PRIV:", err, key.bytes.toString('hex'))
          
          const keyPair = {
            getPublic: (encoding) => pubKey.bytes.toString(encoding),
            publicKey: pubKey,
            privateKey: key,
          }
          
          this._storage.setItem(id, key.bytes.toString('hex'))
          resolve(keyPair)
        // })
      })
      // const key = ec.genKeyPair()
      // const publicKey = key.getPublic('hex')
      // const privateKey = key.getPrivate('hex')
      // this._storage.setItem(id, JSON.stringify({ publicKey: publicKey, privateKey: privateKey }))
    })
  }

  getKey(id) {
    return new Promise((resolve, reject) => {
      let key = this._storage.getItem(id)

      if (!key)
        resolve()

      const bytes = Buffer.from(key, 'hex')
      crypto.unmarshalPrivateKey(bytes, (err, key) => {
        const keyPair = {
          getPublic: (encoding) => key.public.bytes.toString(encoding),
          publicKey: key.public,
          privateKey: key,
        }
        // console.log("GETKEY:", keyPair)
        resolve(keyPair)
      })
    })
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
    return new Promise(resolve => {
      const bytes = Buffer.from(key, 'hex')
      const pubKey = crypto.unmarshalPublicKey(bytes)
      // console.log("PUB2:", err, pubKey.bytes.toString('hex'))
        // console.log("PRIV:", err, key.bytes.toString('hex'))
        
      const keyPair = {
        getPublic: (encoding) => pubKey.bytes.toString(encoding),
        publicKey: pubKey,
        privateKey: null,
      }

      resolve(keyPair)
    })
    // return Promise.resolve(ec.keyFromPublic(key, 'hex'))
  }

  importPrivateKey(key) {
    return Promise.resolve(ec.keyFromPrivate(key, 'hex'))
  }

  sign(key, data) {
    return new Promise(resolve => {
      key.privateKey.sign(data, (err, sig) => {
        resolve(sig)
      })
    })
    // const sig = ec.sign(data, key)
    // return Promise.resolve(sig.toDER('hex'))
  }

  verify(signature, key, data) {
    return new Promise(resolve => {
      key.publicKey.verify(data, signature, (err, ok) => {
        resolve(true)
      })
    })
    // let res = false
    // res = ec.verify(data, signature, key)
    // return Promise.resolve(res)
  }
}

module.exports = Keystore
