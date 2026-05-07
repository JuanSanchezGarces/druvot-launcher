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
    maximizable: false,
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

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    function doGet(targetUrl) {
      const req = https.get(targetUrl, { headers: { 'User-Agent': 'DruvotLauncher/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          res.resume()
          doGet(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          res.resume()
          const err = new Error(`HTTP ${res.statusCode}`)
          err.httpStatus = res.statusCode
          reject(err)
          return
        }
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      req.on('error', reject)
      req.setTimeout(15000, () => { req.destroy(new Error('ETIMEDOUT')) })
    }
    doGet(url)
  })
}

async function withRetry(fn, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries) throw err
      await new Promise(r => setTimeout(r, 1500))
    }
  }
}

async function fetchJson(url) {
  const buf = await httpsGet(url)
  try {
    return JSON.parse(buf.toString('utf8'))
  } catch {
    throw new Error('Resposta inválida do servidor')
  }
}

async function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    function doGet(targetUrl) {
      const req = https.get(targetUrl, { headers: { 'User-Agent': 'DruvotLauncher/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          res.resume()
          doGet(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          res.resume()
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
        res.on('error', reject)
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

// Searches CLIENT_DIR and one level of subdirectories for an otclient executable.
// Prefers the DX build on Windows; falls back to GL or any otclient variant found.
function findClientExe() {
  if (!fs.existsSync(CLIENT_DIR)) return null

  const candidates = ['otclient_dx_x64.exe', 'otclient_gl_x64.exe', 'otclient.exe']

  function searchIn(dir) {
    for (const name of candidates) {
      const p = path.join(dir, name)
      if (fs.existsSync(p)) return p
    }
    return null
  }

  const atRoot = searchIn(CLIENT_DIR)
  if (atRoot) return atRoot

  for (const entry of fs.readdirSync(CLIENT_DIR)) {
    const sub = path.join(CLIENT_DIR, entry)
    if (fs.statSync(sub).isDirectory()) {
      const found = searchIn(sub)
      if (found) return found
    }
  }

  return null
}

function getLocalVersion() {
  if (!fs.existsSync(VERSION_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')).clientVersion
  } catch {
    return null
  }
}

function isNetworkError(err) {
  if (!err) return false
  const OFFLINE_CODES = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'ECONNABORTED']
  return OFFLINE_CODES.includes(err.code) || err.message === 'ETIMEDOUT'
}

async function runUpdateFlow() {
  try {
    sendProgress(0, 'Verificando atualizações...')

    const [manifest, changelog] = await Promise.all([
      withRetry(() => fetchJson(config.MANIFEST_URL)),
      withRetry(() => fetchJson(config.CHANGELOG_URL)).catch(() => []),
    ])

    mainWindow.webContents.send('changelog', changelog)

    const localVersion = getLocalVersion()
    const upToDate = localVersion === manifest.clientVersion && findClientExe() !== null

    if (upToDate) {
      sendProgress(100, 'Pronto para jogar!')
      mainWindow.webContents.send('ready', false)
      return
    }

    // Download
    sendProgress(5, `Baixando cliente v${manifest.clientVersion}...`)
    await withRetry(() => downloadFile(manifest.download.url, TEMP_ZIP, (pct) => {
      sendProgress(5 + pct * 80, `Baixando... ${Math.round(pct * 100)}%`)
    }))

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
    mainWindow.webContents.send('ready', false)

  } catch (err) {
    console.error('Launcher error:', err)

    if (isNetworkError(err) && findClientExe() !== null) {
      sendProgress(100, 'Sem conexão — jogando versão instalada.')
      mainWindow.webContents.send('ready', 'offline')
      return
    }

    mainWindow.webContents.send('error', err.message)
  }
}

// IPC handlers
ipcMain.on('launch-game', () => {
  const exePath = findClientExe()
  if (!exePath) {
    mainWindow.webContents.send('error', 'Cliente não encontrado. Reinicie o launcher.')
    return
  }
  const child = spawn(exePath, [], {
    detached: true,
    stdio: 'ignore',
    cwd: path.dirname(exePath),
  })
  child.unref()
  app.quit()
})

ipcMain.on('retry-update', () => runUpdateFlow())
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize() })
ipcMain.on('window-close', () => app.quit())

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
