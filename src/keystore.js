import level from 'level'
import reachdown from 'reachdown'
import * as crypto from '@libp2p/crypto'
import secp256k1 from 'secp256k1'
import LRU from 'lru'
import { Buffer } from 'safe-buffer'
import { verifier } from './verifiers/index.js'
import fs from 'fs'
import pkg from 'elliptic'
const { ec: EC } = pkg

const ec = new EC('secp256k1')
const unmarshal = crypto.keys.supportedKeys.secp256k1.unmarshalSecp256k1PrivateKey

function createStore (path = './keystore') {
  if (fs && fs.mkdirSync) {
    fs.mkdirSync(path, { recursive: true })
  }

  return level(path)
}

const verifiedCache = new LRU(1000)

export default class Keystore {
  constructor (input = {}) {
    if (typeof input === 'string') {
      this._store = createStore(input)
    } else if (typeof input.open === 'function') {
      this._store = input
    } else if (typeof input.store === 'string') {
      this._store = createStore(input.store)
    } else {
      this._store = input.store || createStore()
    }
    this._cache = input.cache || new LRU(100)
    this._upgraded = null
  }

  async open () {
    if (!this._store) {
      throw new Error('Keystore: No store found to open')
    }
    await this._store.open()
  }

  async close () {
    if (!this._store) return
    await this._upgrade()
    await this._store.close()
  }

  // upgrade level-js to version 5.0.0
  // https://github.com/Level/level-js/blob/master/UPGRADING.md#500
  async _upgrade () {
    const upgradeKey = new Uint8Array([0])

    async function isUpgraded (store) {
      return Boolean(await store.get(upgradeKey).catch(e => false))
    }

    async function setUpgraded (store) {
      await store.put(upgradeKey, '1')
    }

    const db = reachdown(this._store, 'level-js', true)
    if (db && db.upgrade) {
      if (await isUpgraded(this._store)) this._upgraded = true
      if (this._upgraded) { return }
      this._upgraded = new Promise((resolve, reject) => {
        db.upgrade(function (err) {
          if (err) reject(err)
          resolve()
        })
      })
      await this._upgraded
      await setUpgraded(this._store)
    }
  }

  async hasKey (id) {
    if (!id) {
      throw new Error('id needed to check a key')
    }
    if (this._store.status && this._store.status !== 'open') {
      return null
    }
    if (!this._upgraded) {
      await this._upgrade()
    }

    let hasKey = false
    try {
      const storedKey = this._cache.get(id) || await this._store.get(id)
      hasKey = storedKey !== undefined && storedKey !== null
    } catch (e) {
      // Catches 'Error: ENOENT: no such file or directory, open <path>'
      console.error('Error: ENOENT: no such file or directory')
    }

    return hasKey
  }

  async createKey (id, { entropy } = {}) {
    if (!id) {
      throw new Error('id needed to create a key')
    }
    if (this._store.status && this._store.status !== 'open') {
      return null
    }
    if (!this._upgraded) {
      await this._upgrade()
    }

    // Throws error if seed is lower than 192 bit length.
    const privKey = ec.genKeyPair({ entropy }).getPrivate().toArrayLike(Buffer)
    const buf = Buffer.alloc(32)
    privKey.copy(buf, buf.length - privKey.length)

    const keys = await unmarshal(privKey)
    const pubKey = keys.public.marshal()
    const decompressedKey = secp256k1.publicKeyConvert(Buffer.from(pubKey), false)
    const key = {
      publicKey: Buffer.from(decompressedKey).toString('hex'),
      privateKey: Buffer.from(keys.marshal()).toString('hex')
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
    if (!this._store) {
      await this.open()
    }
    if (this._store.status && this._store.status !== 'open') {
      return null
    }
    if (!this._upgraded) {
      await this._upgrade()
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

    return unmarshal(Buffer.from(deserializedKey.privateKey, 'hex'))
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

    return Buffer.from(await key.sign(data)).toString('hex')
  }

  getPublic (keys, options = {}) {
    const formats = ['hex', 'buffer']
    const decompress = typeof options.decompress === 'undefined' ? true : options.decompress
    const format = options.format || 'hex'
    if (formats.indexOf(format) === -1) {
      throw new Error('Supported formats are `hex` and `buffer`')
    }
    let pubKey = keys.public.marshal()
    if (decompress) {
      pubKey = secp256k1.publicKeyConvert(Buffer.from(pubKey), false)
    }
    pubKey = Buffer.from(pubKey)
    return format === 'buffer' ? pubKey : pubKey.toString('hex')
  }

  async verify (signature, publicKey, data, v = 'v1') {
    return Keystore.verify(signature, publicKey, data, v)
  }

  static async verify (signature, publicKey, data, v = 'v1') {
    const cached = verifiedCache.get(signature)
    let res = false
    if (!cached) {
      const verified = await verifier(v).verify(signature, publicKey, data)
      res = verified
      if (verified) {
        verifiedCache.set(signature, { publicKey, data })
      }
    } else {
      const compare = (cached, data, v) => {
        let match
        if (v === 'v0') {
          match = Buffer.compare(Buffer.alloc(30, cached), Buffer.alloc(30, data)) === 0
        } else {
          match = Buffer.isBuffer(data) ? Buffer.compare(cached, data) === 0 : cached === data
        }
        return match
      }
      res = cached.publicKey === publicKey && compare(cached.data, data, v)
    }
    return res
  }
}
