import pkg from 'elliptic'
const { ec } = pkg

export const verify = async (signature, publicKey, data) => {
  if (!signature) {
    throw new Error('No signature given')
  }
  if (!publicKey) {
    throw new Error('Given publicKey was undefined')
  }
  if (!data) {
    throw new Error('Given input data was undefined')
  }
  let res = false
  const key = ec.keyPair({
    pub: publicKey,
    pubEnc: 'hex'
  })
  try {
    res = ec.verify(data, signature, key)
  } catch (e) {
    // Catches 'Error: Signature without r or s'
  }
  return Promise.resolve(res)
}
