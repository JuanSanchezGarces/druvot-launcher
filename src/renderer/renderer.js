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

window.launcher.onChangelog((entries) => {
  if (!entries || entries.length === 0) {
    changelogBody.innerHTML = '<div class="loading-text">Sem entradas no changelog.</div>'
    return
  }

  changelogBody.innerHTML = entries.map(entry => `
    <div class="changelog-entry">
      <div class="changelog-date">${entry.date}${entry.version ? ' &mdash; ' + entry.version : ''}</div>
      ${entry.changes.map(c => `<div class="changelog-item">${c}</div>`).join('')}
    </div>
  `).join('')
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
