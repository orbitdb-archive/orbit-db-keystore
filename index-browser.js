const level = require('level-js')
const Keystore = require('./src/keystore')
module.exports = Keystore(level)
