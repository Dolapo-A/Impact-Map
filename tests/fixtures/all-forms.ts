import './static'
import './side-effect'

export { helper } from './reexported'

const legacy = require('./required')

async function loadIt() {
  return import('./dynamic')
}

export { legacy, loadIt }
export const notAnImport = 'this string mentions ./some/path but is not an import'