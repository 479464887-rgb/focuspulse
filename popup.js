// ==================== ExtPay Integration ====================
let extpay;
try {
  extpay = ExtPay('focuspulse');
  
  extpay.getUser().then(user => {
    if (user && user.paid) {
      document.body.classList.add('pro-user');
      const badge = document.querySelector('.pro-badge');
      if (badge) badge.style.display = 'inline-block';
    } else {
      document.body.classList.add('free-user');
    }
  }).catch(e => console.error('ExtPay: getUser failed', e));
  
  window.openUpgrade = () => {
    try { extpay.openPaymentPage(); }
    catch(e) { console.error('ExtPay: payment failed', e); }
  };
  window.openLogin = () => {
    try { extpay.openLoginPage(); }
    catch(e) { console.error('ExtPay: login failed', e); }
  };
} catch(e) {
  console.error('focuspulse: ExtPay init failed', e);
}

const timeEl = document.getElementById('time');
const modeEl = document.getElementById('mode');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const todayMin = document.getElementById('today-min');
const sessionsEl = document.getElementById('sessions');

function formatTime(s) { const m=Math.floor(s/60), sec=s%60; return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }

startBtn.addEventListener('click', () => {
  const mode = startBtn.textContent === 'Pause' ? 'pause' : (startBtn.textContent === 'Resume' ? 'resume' : 'start');
  if (mode === 'start') chrome.runtime.sendMessage({action:'start',mode:'focus'});
  else if (mode === 'pause') chrome.runtime.sendMessage({action:'pause'});
  else chrome.runtime.sendMessage({action:'resume'});
  navigator.serviceWorker?.ready?.then(r=>r.active?.postMessage({action:'keepAlive'}));
});

stopBtn.addEventListener('click', () => { chrome.runtime.sendMessage({action:'stop'}); loadStatus(); });

// Listen for updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'timerUpdate') render(msg.state);
  if (msg.action === 'timerComplete') loadStats();
});

function render(state) {
  timeEl.textContent = formatTime(state.remaining);
  modeEl.textContent = state.mode.toUpperCase();
  if (state.running) { startBtn.textContent = 'Pause'; startBtn.className = 'btn btn-secondary'; }
  else if (state.remaining !== state.total) { startBtn.textContent = 'Resume'; startBtn.className = 'btn btn-primary'; }
  else { startBtn.textContent = 'Start'; startBtn.className = 'btn btn-primary'; }
}

function loadStatus() {
  chrome.runtime.sendMessage({action:'status'}, state => { if (state) render(state); });
}

function loadStats() {
  chrome.runtime.sendMessage({action:'getStats'}, data => {
    if (data) {
      todayMin.textContent = data.today || 0;
      sessionsEl.textContent = data.sessions.length || 0;
    }
  });
}

document.getElementById('focus-dur').addEventListener('change',e=>chrome.storage.local.set({focusDuration:parseInt(e.target.value)||25}));
document.getElementById('break-dur').addEventListener('change',e=>chrome.storage.local.set({breakDuration:parseInt(e.target.value)||5}));

loadStatus();
loadStats();
setInterval(() => { chrome.runtime.sendMessage({action:'status'}, state => { if(state && state.running) render(state); }); }, 3000);
