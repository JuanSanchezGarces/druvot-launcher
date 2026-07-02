# deploy.ps1
# Copies manifest.json, changelog.json and background.png to the web server.
# Run this after: node scripts/generate-manifest.js <version> <zip>
#
# Usage: .\scripts\deploy.ps1
# First time: fill in SERVER_USER and SERVER_HOST below.

$SERVER_USER = "ubuntu"
$SERVER_HOST = "132.226.164.159"
$IDENTITY    = "C:\Oracle\ssh-key-2026-01-22.key"
$REMOTE_PATH = "/home/ubuntu/tfs-druvot/web/html/launcher"

$root = Split-Path $PSScriptRoot -Parent

Write-Host "Deploying manifest.json, changelog.json and background.png to $SERVER_HOST..."

ssh -i $IDENTITY "${SERVER_USER}@${SERVER_HOST}" "mkdir -p ${REMOTE_PATH}"
scp -i $IDENTITY "$root\manifest.json"        "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/manifest.json"
scp -i $IDENTITY "$root\changelog.json"       "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/changelog.json"
scp -i $IDENTITY "$root\assets\background.png" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/background.png"

Write-Host "Done. Live at https://druvot.com.br/launcher/manifest.json"
