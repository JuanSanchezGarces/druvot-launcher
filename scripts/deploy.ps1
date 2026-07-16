# deploy.ps1
# Stages manifest.json, changelog.json and background.png on the VPS.
# By default this does NOT go live immediately - it lands in a staging folder
# that tfs-druvot/scripts/auto-deploy.sh promotes to the live path at the next
# server-save restart, so the client update reaches players at the exact same
# moment as that day's server-side update (see tfs-druvot README's "O deploy
# agora é automático" section for the server side of this).
#
# Run this after: node scripts/generate-manifest.js <version> <zip>
#
# Usage:
#   .\scripts\deploy.ps1        # stage only - goes live at the next server save
#   .\scripts\deploy.ps1 -Now   # stage AND promote immediately (urgent client-only hotfix)
#
# First time: fill in SERVER_USER and SERVER_HOST below.

param(
    [switch]$Now
)

$SERVER_USER  = "ubuntu"
$SERVER_HOST  = "132.226.164.159"
$IDENTITY     = "C:\Oracle\ssh-key-2026-01-22.key"
$STAGING_PATH = "/home/ubuntu/tfs-druvot/web/launcher-pending"
$LIVE_PATH    = "/home/ubuntu/tfs-druvot/web/html/launcher"

$root = Split-Path $PSScriptRoot -Parent

Write-Host "Staging manifest.json, changelog.json and background.png on $SERVER_HOST..."

ssh -i $IDENTITY "${SERVER_USER}@${SERVER_HOST}" "mkdir -p ${STAGING_PATH}"
scp -i $IDENTITY "$root\manifest.json"         "${SERVER_USER}@${SERVER_HOST}:${STAGING_PATH}/manifest.json"
scp -i $IDENTITY "$root\changelog.json"        "${SERVER_USER}@${SERVER_HOST}:${STAGING_PATH}/changelog.json"
scp -i $IDENTITY "$root\assets\background.png" "${SERVER_USER}@${SERVER_HOST}:${STAGING_PATH}/background.png"

if ($Now) {
    Write-Host "Staged. Promoting immediately (-Now)..."
    ssh -i $IDENTITY "${SERVER_USER}@${SERVER_HOST}" "mkdir -p ${LIVE_PATH} && cp -f ${STAGING_PATH}/manifest.json ${STAGING_PATH}/changelog.json ${STAGING_PATH}/background.png ${LIVE_PATH}/"
    Write-Host "Done. Live NOW at https://druvot.com.br/launcher/manifest.json"
} else {
    Write-Host "Staged - NOT live yet. Will go live automatically at the next server-save restart."
    Write-Host "Need it live right now instead? Re-run with -Now."
}
