/**
 * generate-manifest.js
 *
 * Usage:
 *   node scripts/generate-manifest.js <version> <path-to-client.zip>
 *
 * Example:
 *   node scripts/generate-manifest.js 1.0.1 "C:\Users\juani\Desktop\client.zip"
 *
 * Then:
 *   1. Create a GitHub Release tagged "client-v<version>"
 *   2. Upload client.zip and manifest.json to that release
 *   3. Also upload changelog.json if it changed
 */

const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

const { GITHUB_OWNER, GITHUB_REPO } = require('../src/config')

const [,, version, zipPath] = process.argv

if (!version || !zipPath) {
  console.error('Usage: node scripts/generate-manifest.js <version> <path-to-client.zip>')
  console.error('Example: node scripts/generate-manifest.js 1.0.1 "C:\\Users\\juani\\Desktop\\client.zip"')
  process.exit(1)
}

const resolvedZip = path.resolve(zipPath)

if (!fs.existsSync(resolvedZip)) {
  console.error(`File not found: ${resolvedZip}`)
  process.exit(1)
}

console.log(`Generating manifest for v${version}...`)
console.log(`Reading: ${resolvedZip}`)

const stats = fs.statSync(resolvedZip)
const hash = crypto.createHash('sha256')
const stream = fs.createReadStream(resolvedZip)

stream.on('data', d => hash.update(d))
stream.on('end', () => {
  const sha256 = hash.digest('hex')
  const releaseTag = `client-v${version}`
  const downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${releaseTag}/client.zip`

  const manifest = {
    clientVersion: version,
    download: {
      url: downloadUrl,
      hash: sha256,
      size: stats.size,
    },
  }

  const outputPath = path.join(__dirname, '..', 'manifest.json')
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2))

  console.log('\nmanifest.json generated successfully!\n')
  console.log(`  Version : ${version}`)
  console.log(`  SHA-256 : ${sha256}`)
  console.log(`  Size    : ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  URL     : ${downloadUrl}`)
  console.log('\nNext steps:')
  console.log(`  1. Go to GitHub → druvot-launcher → Releases → "Create a new release"`)
  console.log(`  2. Tag: ${releaseTag}`)
  console.log(`  3. Upload: client.zip and manifest.json`)
  console.log(`  4. If changelog changed, upload changelog.json too`)
  console.log(`  5. Publish the release`)
})

stream.on('error', err => {
  console.error('Error reading zip:', err.message)
  process.exit(1)
})
