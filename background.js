// ExtPay - Payment integration
importScripts('ExtPay.js');
const extpay = ExtPay('focuspulse');
extpay.startBackground();

// FocusPulse - Background Service Worker
const DEFAULTS = {
  focusDuration: 25,     // minutes
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  notifications: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.sync.get('settings');
  if (!settings) await chrome.storage.sync.set({ settings: DEFAULTS });

  const today = new Date().toDateString();
  const { dailyStats } = await chrome.storage.local.get('dailyStats');
  if (!dailyStats || dailyStats.date !== today) {
    await chrome.storage.local.set({
      timerState: null,
      dailyStats: { date: today, sessions: 0, totalMinutes: 0, streak: 0 }
    });
  }
});

// ===== Timer Alarm =====
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'timer-tick') {
    await handleTimerTick();
  }
});

async function handleTimerTick() {
  const { timerState, dailyStats, settings } = await chrome.storage.local.get(['timerState', 'dailyStats', 'settings']);
  const s = settings || DEFAULTS;
  if (!timerState || !timerState.running) return;

  timerState.remaining--;
  await chrome.storage.local.set({ timerState });

  // Update badge
  const mins = Math.ceil(timerState.remaining / 60);
  chrome.action.setBadgeText({ text: mins.toString() });
  chrome.action.setBadgeBackgroundColor({ color: timerState.mode === 'focus' ? '#238636' : '#58a6ff' });

  if (timerState.remaining <= 0) {
    await onTimerComplete(timerState, dailyStats, s);
  }
}

async function onTimerComplete(state, dailyStats, settings) {
  // Stop alarm
  await chrome.alarms.clear('timer-tick');
  state.running = false;
  state.completed = true;

  if (state.mode === 'focus') {
    // Record session
    const today = new Date().toDateString();
    dailyStats.date = today;
    dailyStats.sessions = (dailyStats.sessions || 0) + 1;
    dailyStats.totalMinutes = (dailyStats.totalMinutes || 0) + (settings.focusDuration || 25);
    dailyStats.streak = (dailyStats.streak || 0) + 1;
    await chrome.storage.local.set({ dailyStats, timerState: state });

    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#3fb950' });

    if (settings.notifications !== false) {
      chrome.notifications.create('focus-done', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '🍅 专注完成！',
        message: `${settings.focusDuration}分钟专注完成。休息一下吧！`,
        priority: 2
      });
    }

    // Auto-start break?
    if (settings.autoStartBreaks) {
      const isLongBreak = dailyStats.sessions % (settings.sessionsBeforeLongBreak || 4) === 0;
      startTimer(isLongBreak ? 'longBreak' : 'break', settings);
    }
  } else {
    await chrome.storage.local.set({ timerState: state });
    chrome.action.setBadgeText({ text: '☕' });

    if (settings.notifications !== false) {
      chrome.notifications.create('break-done', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '☕ 休息结束',
        message: '准备好了吗？开始下一轮专注！',
        priority: 1
      });
    }

    if (settings.autoStartFocus) {
      startTimer('focus', settings);
    }
  }
}

// ===== Start Timer =====
async function startTimer(mode, settings) {
  const s = settings || DEFAULTS;
  const duration = mode === 'focus' ? (s.focusDuration || 25) :
                   mode === 'longBreak' ? (s.longBreakDuration || 15) :
                   (s.breakDuration || 5);

  const state = {
    mode,
    duration: duration * 60,
    remaining: duration * 60,
    running: true,
    startedAt: Date.now(),
    completed: false
  };

  await chrome.storage.local.set({ timerState: state });
  await chrome.alarms.create('timer-tick', { periodInMinutes: 1 / 60 }); // every second

  const badge = mode === 'focus' ? '▶' : '☕';
  chrome.action.setBadgeText({ text: Math.ceil(duration).toString() });
  chrome.action.setBadgeBackgroundColor({ color: mode === 'focus' ? '#238636' : '#58a6ff' });

  return { success: true, state };
}

// ===== Message Routing =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'START_TIMER':
      chrome.storage.sync.get('settings').then(({ settings }) =>
        startTimer(request.mode || 'focus', settings).then(sendResponse)
      );
      return true;
    case 'PAUSE_TIMER':
      pauseTimer().then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'RESUME_TIMER':
      resumeTimer().then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'STOP_TIMER':
      stopTimer().then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'GET_STATE':
      getState().then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'GET_STATS':
      getStats().then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'GET_SETTINGS':
      chrome.storage.sync.get('settings').then(sendResponse);
      return true;
  case 'GET_PAID_STATUS':
    extpay.getUser().then(sendResponse);
    return true;
  case 'OPEN_PAYMENT':
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return false;
  case 'OPEN_LOGIN':
    extpay.openLoginPage();
    sendResponse({ success: true });
    return false;

    case 'SAVE_SETTINGS':
      chrome.storage.sync.set({ settings: request.settings }).then(() => sendResponse({ success: true }));
      return true;
  }
});

async function pauseTimer() {
  const { timerState } = await chrome.storage.local.get('timerState');
  if (!timerState || !timerState.running) return { error: 'No active timer' };
  timerState.running = false;
  timerState.pausedAt = Date.now();
  await chrome.storage.local.set({ timerState });
  await chrome.alarms.clear('timer-tick');
  chrome.action.setBadgeText({ text: '⏸' });
  return { success: true, state: timerState };
}

async function resumeTimer() {
  const { timerState } = await chrome.storage.local.get('timerState');
  if (!timerState) return { error: 'No timer' };
  timerState.running = true;
  timerState.pausedAt = null;
  await chrome.storage.local.set({ timerState });
  await chrome.alarms.create('timer-tick', { periodInMinutes: 1 / 60 });
  const mins = Math.ceil(timerState.remaining / 60);
  chrome.action.setBadgeText({ text: mins.toString() });
  return { success: true, state: timerState };
}

async function stopTimer() {
  const { timerState, dailyStats } = await chrome.storage.local.get(['timerState', 'dailyStats']);
  await chrome.alarms.clear('timer-tick');
  await chrome.storage.local.set({ timerState: null });
  chrome.action.setBadgeText({ text: '' });
  return { success: true };
}

async function getState() {
  const { timerState, dailyStats } = await chrome.storage.local.get(['timerState', 'dailyStats']);
  return { state: timerState, stats: dailyStats };
}

async function getStats() {
  const { dailyStats = {} } = await chrome.storage.local.get('dailyStats');
  const today = new Date().toDateString();
  if (dailyStats.date !== today) {
    return { sessions: 0, totalMinutes: 0, streak: 0, date: today };
  }
  return dailyStats;
}
