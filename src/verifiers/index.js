'use strict'

import * as v0 from './verifierv0.js'
import * as v1 from './verifierv1.js'

const verifiers = { v0, v1 }

export const verifier = (v) => {
  return verifiers[v]
}
