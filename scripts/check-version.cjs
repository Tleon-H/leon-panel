const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const pkg = require(path.join(root, 'package.json'))
const [codeRaw, version] = fs.readFileSync(path.join(root, 'service/assets/version'), 'utf8').trim().split('|')
const code = Number(codeRaw)

assert.equal(pkg.name, 'leon-panel')
assert.equal(Number.isInteger(code) && code >= 1, true, 'Version code must be a positive integer')
assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Version must follow SemVer X.Y.Z')
assert.equal(version, pkg.version, 'Frontend and backend versions must match')

const imageTag = version
if (process.argv.includes('--image-tag')) {
  console.log(imageTag)
} else {
  if (process.env.GITHUB_REF_TYPE === 'tag')
    assert.equal(process.env.GITHUB_REF_NAME, `v${imageTag}`, 'Release tag must match the code version')
  console.log(`Leon Panel ${version} (image tag ${imageTag})`)
}
