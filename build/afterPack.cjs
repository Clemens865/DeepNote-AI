const { execSync } = require('child_process')

exports.default = async function (context) {
  const appOutDir = context.appOutDir
  console.log('afterPack: cleaning resource forks and quarantine attrs from', appOutDir)
  try {
    // Remove all extended attributes recursively — this includes com.apple.provenance
    // and com.apple.quarantine which cause "resource fork, Finder information, or
    // similar detritus not allowed" errors during codesign
    execSync(`find "${appOutDir}" -exec xattr -c {} +`, { stdio: 'inherit' })
    // Also run dot_clean to merge/remove ._ resource fork files
    execSync(`dot_clean "${appOutDir}"`, { stdio: 'inherit' })
  } catch (e) {
    console.warn('afterPack: cleanup warning:', e.message)
  }
}
