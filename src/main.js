const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const crypto = require('crypto')
const { spawn } = require('child_process')
const extractZip = require('extract-zip')
const config = require('./config')

const CLIENT_DIR = path.join(app.getPath('userData'), 'client')
const VERSION_FILE = path.join(app.getPath('userData'), 'version.json')
const TEMP_ZIP = path.join(app.getPath('temp'), 'druvot-client.zip')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: config.WINDOW_WIDTH,
    height: config.WINDOW_HEIGHT,
    resizable: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    title: config.SERVER_NAME,
    show: false,
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    runUpdateFlow()
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

function sendProgress(percent, status) {
  if (mainWindow) {
    mainWindow.webContents.send('progress', { percent: Math.round(percent), status })
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    function doGet(targetUrl) {
      const req = https.get(targetUrl, { headers: { 'User-Agent': 'DruvotLauncher/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doGet(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} ao buscar ${targetUrl}`))
          return
        }
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch (e) { reject(new Error('Resposta inválida do servidor')) }
        })
      })
      req.on('error', reject)
    }
    doGet(url)
  })
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    function doGet(targetUrl) {
      const req = https.get(targetUrl, { headers: { 'User-Agent': 'DruvotLauncher/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doGet(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} ao baixar arquivo`))
          return
        }
        const total = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0
        const file = fs.createWriteStream(dest)

        res.on('data', chunk => {
          downloaded += chunk.length
          if (total && onProgress) onProgress(downloaded / total)
        })

        res.pipe(file)
        file.on('finish', () => file.close(resolve))
        file.on('error', reject)
      })
      req.on('error', reject)
    }
    doGet(url)
  })
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', d => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

function getLocalVersion() {
  if (!fs.existsSync(VERSION_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')).clientVersion
  } catch {
    return null
  }
}

async function runUpdateFlow() {
  try {
    sendProgress(0, 'Verificando atualizações...')

    const [manifest, changelog] = await Promise.all([
      fetchJson(config.MANIFEST_URL),
      fetchJson(config.CHANGELOG_URL).catch(() => []),
    ])

    mainWindow.webContents.send('changelog', changelog)

    const localVersion = getLocalVersion()
    const clientExe = path.join(CLIENT_DIR, 'otclient.exe')
    const upToDate = localVersion === manifest.clientVersion && fs.existsSync(clientExe)

    if (upToDate) {
      sendProgress(100, 'Pronto para jogar!')
      mainWindow.webContents.send('ready', true)
      return
    }

    // Download
    sendProgress(5, `Baixando cliente v${manifest.clientVersion}...`)
    await downloadFile(manifest.download.url, TEMP_ZIP, (pct) => {
      sendProgress(5 + pct * 80, `Baixando... ${Math.round(pct * 100)}%`)
    })

    // Verify hash
    sendProgress(86, 'Verificando integridade...')
    if (manifest.download.hash) {
      const hash = await hashFile(TEMP_ZIP)
      if (hash !== manifest.download.hash) {
        throw new Error('Falha na verificação — o download pode estar corrompido.')
      }
    }

    // Extract
    sendProgress(90, 'Instalando arquivos...')
    fs.mkdirSync(CLIENT_DIR, { recursive: true })
    await extractZip(TEMP_ZIP, { dir: CLIENT_DIR })

    // Save version
    fs.writeFileSync(VERSION_FILE, JSON.stringify({ clientVersion: manifest.clientVersion }))
    fs.rmSync(TEMP_ZIP, { force: true })

    sendProgress(100, 'Pronto para jogar!')
    mainWindow.webContents.send('ready', true)

  } catch (err) {
    console.error(err)
    mainWindow.webContents.send('error', err.message)
  }
}

// IPC handlers
ipcMain.on('launch-game', () => {
  const exePath = path.join(CLIENT_DIR, 'otclient.exe')
  if (!fs.existsSync(exePath)) {
    mainWindow.webContents.send('error', 'Cliente não encontrado. Reinicie o launcher.')
    return
  }
  const child = spawn(exePath, [], {
    detached: true,
    stdio: 'ignore',
    cwd: CLIENT_DIR,
  })
  child.unref()
  app.quit()
})

ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize() })
ipcMain.on('window-close', () => app.quit())

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
