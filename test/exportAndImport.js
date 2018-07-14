const Keystore = require('../index-nodejs.js')
const assert = require('assert')

async function test(id, password){ 
  var keystore = Keystore.create('./.storage')
  key = keystore.createKey(id)
  encryptedKeystore = await keystore.exportKeystore(id, password)
  var keystore2 = Keystore.create('./.storage2')
  await keystore2.importKeystore(encryptedKeystore, password)
  key1 = keystore2.getKey(id)
  assert(await keystore.exportPublicKey(key) === await keystore2.exportPublicKey(key1), "Keys don't match")
}

async function runTests(){
  await test(0, 'password')
  await test(1)
  console.log("Tests Passed")
}

runTests()
