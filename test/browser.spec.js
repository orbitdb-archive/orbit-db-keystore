import path from 'path'
import isNode from 'is-node'
import signingKeys from './fixtures/signingKeys/signing.json' assert { type: 'json' }
import getPublicKeys from './fixtures/signingKeys/getPublic.json' assert { type: 'json' }

// This file will be picked up by webpack into the
// tests bundle and the code here gets run when imported
// into the browser tests index through browser/run.js
if (!isNode) {
  const levelup = await (await import('levelup')).default
  const leveljs = await (await import('level-js')).default
  const leveljs4 = await (await import('level-js4')).default

  // If in browser, put the fixture keys in local storage
  // so that Keystore can find them
  const storagePath = path.join('test', 'signingKeys')
  const upgradePath = path.join('test', 'upgrade')

  const signingStore = levelup(leveljs(storagePath))
  const upgradeStore = levelup(leveljs4(upgradePath))
  const copyFixtures = []
  copyFixtures.push(signingStore.open())
  copyFixtures.push(upgradeStore.open())

  copyFixtures.push(signingStore.put('signing', JSON.stringify(signingKeys)))
  copyFixtures.push(signingStore.put('getPublic', JSON.stringify(getPublicKeys)))
  copyFixtures.push(upgradeStore.put('upgrade', JSON.stringify(getPublicKeys)))

  Promise.all(copyFixtures)
}
