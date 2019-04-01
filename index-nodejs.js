const level = require('leveldown')
const mkdirp = require('mkdirp')
const Keystore = require('./src/keystore')
module.exports = Keystore(level, mkdirp)
