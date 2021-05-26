'use strict'

const path = require('path')

const isNode = require('is-node')
// This file will be picked up by webpack into the
// tests bundle and the code here gets run when imported
// into the browser tests index through browser/run.js
if (!isNode) {
  // If in browser, put the fixture keys in local storage
  // so that Keystore can find them
  const levelup = require('levelup')
  const leveljs = require('level-js')
  const storagePath = path.join('test', 'signingKeys')
  const signingStore = levelup(leveljs(storagePath))

  const copyFixtures = []
  copyFixtures.push(signingStore.open())

  const signingKeys = require('./fixtures/signingKeys/signing')
  const getPublicKeys = require('./fixtures/signingKeys/getPublic')

  copyFixtures.push(signingStore.put('signing', JSON.stringify(signingKeys)))
  copyFixtures.push(signingStore.put('getPublic', JSON.stringify(getPublicKeys)))

  Promise.all(copyFixtures)
}
