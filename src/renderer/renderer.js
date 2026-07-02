const progressFill = document.getElementById('progress-fill')
const statusText = document.getElementById('status-text')
const btnPlay = document.getElementById('btn-play')
const btnRetry = document.getElementById('btn-retry')
const changelogBody = document.getElementById('changelog-body')

window.launcher.onProgress(({ percent, status }) => {
  progressFill.style.width = `${percent}%`
  statusText.textContent = status
  statusText.className = ''
  btnRetry.classList.add('hidden')
})

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatInline(str) {
  return escapeHtml(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

// Tiny markup for changelog.json "changes" strings:
//   "# Title"      -> section heading
//   "- item"       -> bullet
//   "  - item"     -> sub-bullet (indented, 2+ leading spaces)
//   "**bold**"     -> bold (works inside any line type)
//   ""             -> spacer
//   anything else  -> plain text line
function renderChangeLine(line) {
  if (/^#\s+/.test(line)) {
    return `<div class="changelog-heading">${formatInline(line.replace(/^#\s+/, ''))}</div>`
  }
  const subMatch = line.match(/^\s{2,}-\s?(.*)$/)
  if (subMatch) {
    return `<div class="changelog-subitem">${formatInline(subMatch[1])}</div>`
  }
  const topMatch = line.match(/^-\s?(.*)$/)
  if (topMatch) {
    return `<div class="changelog-item">${formatInline(topMatch[1])}</div>`
  }
  if (line.trim() === '') {
    return '<div class="changelog-spacer"></div>'
  }
  return `<div class="changelog-text">${formatInline(line)}</div>`
}

window.launcher.onChangelog((entries) => {
  if (!entries || entries.length === 0) {
    changelogBody.innerHTML = '<div class="loading-text">Sem entradas no changelog.</div>'
    return
  }

  changelogBody.innerHTML = entries.map(entry => `
    <div class="changelog-entry">
      <div class="changelog-date">${escapeHtml(entry.date)}${entry.version ? ' &mdash; ' + escapeHtml(entry.version) : ''}</div>
      ${entry.changes.map(renderChangeLine).join('')}
    </div>
  `).join('')
})

window.launcher.onBackground((dataUrl) => {
  document.documentElement.style.setProperty('--bg-image', `url("${dataUrl}")`)
})

window.launcher.onReady((isOffline) => {
  btnRetry.classList.add('hidden')
  btnPlay.disabled = false
  if (isOffline) {
    statusText.textContent = 'Sem conexão — jogando versão instalada.'
    statusText.className = 'offline'
  } else {
    statusText.textContent = 'Pronto para jogar!'
    statusText.className = 'ready'
  }
})

window.launcher.onError((msg) => {
  statusText.textContent = `Erro: ${msg}`
  statusText.className = 'error'
  btnRetry.classList.remove('hidden')
})

btnPlay.addEventListener('click', () => {
  btnPlay.disabled = true
  btnPlay.textContent = '...'
  window.launcher.launchGame()
})

btnRetry.addEventListener('click', () => {
  btnRetry.classList.add('hidden')
  statusText.className = ''
  window.launcher.retryUpdate()
})

document.getElementById('btn-minimize').addEventListener('click', () => window.launcher.minimize())
document.getElementById('btn-close').addEventListener('click', () => window.launcher.close())
