const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const pkg = require(path.join(root, 'package.json'))
const [code, version] = fs.readFileSync(path.join(root, 'service/assets/version'), 'utf8').trim().split('|')
assert.equal(pkg.name, 'leon-panel')
assert.equal(code, '10', 'Backup format compatibility code must remain 10')
assert.match(pkg.version, /^1\.3\.0\+leon\.[1-9]\d*$/)
assert.equal(version, pkg.version, 'Frontend and backend versions must match')
const imageTag = version.replace('+', '-')
if (process.argv.includes('--image-tag')) {
  console.log(imageTag)
} else {
  if (process.env.GITHUB_REF_TYPE === 'tag')
    assert.equal(process.env.GITHUB_REF_NAME, `v${imageTag}`, 'Release tag must match the code version')
  console.log(`Leon Panel ${version} (image tag ${imageTag})`)
}
