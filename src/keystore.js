'use strict'

const EC = require('elliptic').ec
const ec = new EC('secp256k1')
const crypto = require('libp2p-crypto')

class Keystore {
  constructor(storage) {
    this._storage = storage
  }
  static get NumberPasswordIterations(){ return 1000 }
  static get HashingAlgorithm(){ return 'sha2-512' }
  static get IVLen() { return 16 }

  createKey(id) {
    const key = ec.genKeyPair()
    const publicKey = key.getPublic('hex')
    const privateKey = key.getPrivate('hex')
    this._storage.setItem(id, JSON.stringify({
      publicKey: publicKey, 
      privateKey: privateKey 
    }))
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

  async exportKeystore(id, password) {
    var data = Buffer.from(this._storage.getItem(id))
    var res = {id:id, data: data}
    //Need something better than JSON
    if (password) {
      const IV   = crypto.randomBytes(Keystore.IVLen)
      const salt = crypto.randomBytes(8)
      const hashedPass = this.hashPassword(password, salt)
      await crypto.aes.create(hashedPass, IV, async (err, aes) => {
        if (!err) {
          aes.encrypt(data, (err, encBuf) => {
              if (!err) {
                res = {id: id, data: encBuf, IV: IV, salt: salt}
              }
            })
        }
      })   
      return res
    }
    return res
  }

  async importKeystore(exportedKeystore, password) {
    var data = exportedKeystore.data
    const id = exportedKeystore.id
    if (password) {
      const IV  = exportedKeystore.IV
      const salt = exportedKeystore.salt
      const hashedPassword = this.hashPassword(password, salt)
      await crypto.aes.create(hashedPassword, IV, async (err, aes) => {
        if (!err) {
          aes.decrypt(data, (err, decBuf) => {
              if (!err) {
                data = decBuf
              }
          })
        }
      }) 
    }
    this._storage.setItem(id, data.toString())
    return this;
  }

  hashPassword(password, salt) {
    return Buffer.from(crypto.pbkdf2(password, 
                      salt, 
                      Keystore.NumberPasswordIterations, 
                      Keystore.IVLen - salt.length/2, 
                      Keystore.HashingAlgorithm)) 
  }
}

module.exports = (LocalStorage, mkdir) => {
  return {
    create: (directory = './keystore') => {
      // If we're in Node.js, mkdir module is expected to passed
      // and we need to make sure the directory exists
      if (mkdir && mkdir.sync) 
        mkdir.sync(directory)
      // In Node.js, we use the injected LocalStorage module,
      // in the browser, we use the browser's localStorage
      const storage = LocalStorage ? new LocalStorage(directory) : localStorage
      return new Keystore(storage)
    }
  }
}
