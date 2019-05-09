var assert = require('assert');
const Log = require('ipfs-log')
const level = require('leveldown')
const mkdirp = require('mkdirp')
const Keystore = require('../src/keystore')

const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('orbit-db-test-utils')

Object.keys(testAPIs).forEach((IPFS) => {
  describe(`#open() - ${IPFS}`, async function() {
    let KS, keystore;

    beforeEach(async () => {
      KS = Keystore(level, mkdirp)
      keystore = await KS.create('./keystore')
    })

    afterEach(async () => {
      await keystore.close()
      await KS.destroy()
    })

    it('opens and closes the keystore', async function() {
      await keystore.open()
      assert.equal(keystore._store._db.status, 'opening')

      await keystore.close()
      assert.equal(keystore._store._db.status, 'closed')

      await keystore.open()
      assert.equal(keystore._store.db.status, 'open')
    })

    it('handles multiple calls to open with no problems', async function() {
      await keystore.open()
      await keystore.open()
      await keystore.open()
      await keystore.open()
      await keystore.open()
      await keystore.open()
    })

    it('handles multiple calls to close with no problems', async function() {
      await keystore.close()
      await keystore.close()
      await keystore.close()
      await keystore.close()
      await keystore.close()
    })
  })

});
