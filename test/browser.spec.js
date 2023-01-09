import path from 'path'
import isNode from 'is-node'

// This file will be picked up by webpack into the
// tests bundle and the code here gets run when imported
// into the browser tests index through browser/run.js
if (!isNode) {
  const { default: signingKeys } = await import('./fixtures/signingKeys/signing.json')
  const { default: getPublicKeys } = await import('./fixtures/signingKeys/getPublic.json')

  const levelup = (await import('levelup')).default
  const leveljs = (await import('level-js')).default

  // If in browser, put the fixture keys in local storage
  // so that Keystore can find them
  const storagePath = path.join('test', 'signingKeys')

  const signingStore = levelup(leveljs(storagePath))
  const copyFixtures = []
  copyFixtures.push(signingStore.open())

  copyFixtures.push(signingStore.put('signing', JSON.stringify(signingKeys)))
  copyFixtures.push(signingStore.put('getPublic', JSON.stringify(getPublicKeys)))

  Promise.all(copyFixtures)
}
