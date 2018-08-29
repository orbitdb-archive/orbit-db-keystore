'use strict'

const EC = require('elliptic').ec
const ec = new EC('secp256k1')

class Keystore {
  constructor (storage) {
    this._storage = storage
  }

  hasKey (id) {
    if (!id) throw new Error('id needed to check a key')
    let hasKey = false
    let storedKey = this._storage.getItem(id)
    try {
      hasKey = storedKey !== undefined && storedKey !== null
    } catch (e) {
      // Catches 'Error: ENOENT: no such file or directory, open <path>'
      console.error('Error: ENOENT: no such file or directory')
    }
    return hasKey
  }

  createKey (id) {
    if (!id) throw new Error('id needed to create a key')

    const keyPair = ec.genKeyPair()

    const key = {
      publicKey: keyPair.getPublic('hex'),
      privateKey: keyPair.getPrivate('hex'),
    }

    this._storage.setItem(id, JSON.stringify(key))

    return keyPair
  }

  getKey (id) {
    if (!id) throw new Error('id needed to get a key')

    const storedKey = this._storage.getItem(id)

    if (!storedKey)
      return

    const deserializedKey = JSON.parse(storedKey)

    if (!deserializedKey)
      return

    const key = ec.keyPair({
      pub:  deserializedKey.publicKey,
      priv: deserializedKey.privateKey,
      pubEnc: 'hex',
      privEnc: 'hex',
    })

    return key
  }

  sign(key, data) {
    if (!key) throw new Error('No signing key given')
    if (!data) throw new Error('Given input data was undefined')
    const sig = ec.sign(data, key)
    return Promise.resolve(sig.toDER('hex'))
  }

  verify(signature, publicKey, data) {
    if (!signature) throw new Error('No signature given')
    if (!publicKey) throw new Error('Given publicKey was undefined')
    if (!data) throw new Error('Given input data was undefined')
    let res = false
    const key = ec.keyPair({
      pub:  publicKey,
      pubEnc: 'hex',
    })
    try {
      res = ec.verify(data, signature, key)
    } catch (e) {
      // Catches 'Error: Signature without r or s'
    }
    return Promise.resolve(res)
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
    }
  }
}
