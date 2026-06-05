// FocusPulse — Background Service Worker
// Timer state management

let timerState = {
  running: false,
  mode: 'focus', // focus | break
  remaining: 25 * 60, // seconds
  total: 25 * 60,
  endTime: null,
};

const DEFAULT_FOCUS = 25 * 60;
const DEFAULT_BREAK = 5 * 60;
const LONG_BREAK = 15 * 60;

function loadSettings() {
  return chrome.storage.local.get(['focusDuration', 'breakDuration', 'longBreakInterval', 'pro']).then(data => ({
    focus: (data.focusDuration || 25) * 60,
    break: (data.breakDuration || 5) * 60,
    longBreak: 15 * 60,
    longInterval: data.longBreakInterval || 4,
    pro: data.pro || false
  }));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') { startTimer(request.mode || 'focus'); sendResponse(timerState); }
  if (request.action === 'pause') { pauseTimer(); sendResponse(timerState); }
  if (request.action === 'resume') { resumeTimer(); sendResponse(timerState); }
  if (request.action === 'stop') { stopTimer(); sendResponse(timerState); }
  if (request.action === 'status') { sendResponse(timerState); }
  if (request.action === 'getStats') {
    chrome.storage.local.get(['sessions', 'totalFocus', 'today'], data => {
      sendResponse({ sessions: data.sessions || [], totalFocus: data.totalFocus || 0, today: data.today || 0 });
    });
    return true;
  }
});

async function startTimer(mode) {
  const settings = await loadSettings();
  timerState.mode = mode;
  timerState.running = true;
  timerState.total = mode === 'focus' ? settings.focus : settings.break;
  timerState.remaining = timerState.total;
  timerState.endTime = Date.now() + timerState.total * 1000;
  startTick();
  timerState.startedAt = Date.now();
}

function pauseTimer() {
  timerState.running = false;
  timerState.pausedAt = timerState.remaining;
  broadcast();
}

function resumeTimer() {
  timerState.running = true;
  timerState.endTime = Date.now() + timerState.remaining * 1000;
  startTick();
  broadcast();
}

function stopTimer() {
  timerState.running = false;
  timerState.remaining = timerState.total;
  broadcast();
}

let tickInterval = null;
function startTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    if (!timerState.running) { clearInterval(tickInterval); tickInterval = null; return; }
    const remaining = Math.max(0, Math.ceil((timerState.endTime - Date.now()) / 1000));
    timerState.remaining = remaining;
    broadcast();
    if (remaining <= 0) {
      clearInterval(tickInterval); tickInterval = null;
      timerState.running = false;
      timerComplete();
    }
  }, 1000);
}

function broadcast() {
  chrome.runtime.sendMessage({ action: 'timerUpdate', state: timerState }).catch(() => {});
}

async function timerComplete() {
  chrome.runtime.sendMessage({ action: 'timerComplete', mode: timerState.mode }).catch(() => {});
  // Record session
  const data = await chrome.storage.local.get(['sessions', 'totalFocus', 'today']);
  const sessions = data.sessions || [];
  const session = {
    mode: timerState.mode,
    duration: timerState.total,
    completedAt: Date.now(),
    date: new Date().toISOString().split('T')[0]
  };
  sessions.push(session);
  const totalFocus = (data.totalFocus || 0) + (timerState.mode === 'focus' ? timerState.total : 0);
  const todayMinutes = session.date === new Date().toISOString().split('T')[0] ? (data.today || 0) + Math.floor(timerState.total / 60) : Math.floor(timerState.total / 60);
  await chrome.storage.local.set({ sessions: sessions.slice(-100), totalFocus, today: todayMinutes });

  // Notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    title: timerState.mode === 'focus' ? 'Focus Complete!' : 'Break Over!',
    message: timerState.mode === 'focus' ? 'Great work! Time for a break.' : 'Ready to focus again?'
  });
}
