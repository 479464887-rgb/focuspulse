// FocusPulse - Popup
const CIRCUMFERENCE = 2 * Math.PI * 72; // ~452.39

let currentMode = 'focus';
let timerState = null;
let updateInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  startPolling();

  // Mode buttons
  document.querySelectorAll('#mode-select .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#mode-select .mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      if (!timerState?.running) updateDisplay();
    });
  });

  // Start/Pause button
  document.getElementById('btn-start').addEventListener('click', async () => {
    if (timerState?.running) {
      // Pause
      const resp = await chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
      if (resp.success) timerState = resp.state;
    } else if (timerState && !timerState.completed) {
      // Resume
      const resp = await chrome.runtime.sendMessage({ type: 'RESUME_TIMER' });
      if (resp.success) timerState = resp.state;
    } else {
      // Start new
      const resp = await chrome.runtime.sendMessage({ type: 'START_TIMER', mode: currentMode });
      if (resp.success) timerState = resp.state;
    }
    updateDisplay();
  });

  // Stop button
  document.getElementById('btn-stop').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
    timerState = null;
    updateDisplay();
  });

  // Settings
  document.getElementById('btn-settings').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});

function startPolling() {
  updateInterval = setInterval(async () => {
    if (timerState?.running) {
      // Local countdown
      timerState.remaining = Math.max(0, timerState.remaining - 1);
      if (timerState.remaining <= 0) {
        await loadState(); // Reload from storage after completion
      }
      updateDisplay();
    } else if (!timerState) {
      await loadState();
    }
  }, 1000);
}

async function loadState() {
  const resp = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  timerState = resp.state;
  if (resp.stats) {
    document.getElementById('stat-sessions').textContent = resp.stats.sessions || 0;
    document.getElementById('stat-minutes').textContent = resp.stats.totalMinutes || 0;
    document.getElementById('stat-streak').textContent = resp.stats.streak || 0;
  }
  if (timerState) {
    currentMode = timerState.mode;
    document.querySelectorAll('#mode-select .mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === timerState.mode);
    });
  }
  updateDisplay();
}

function updateDisplay() {
  const timeEl = document.getElementById('time-display');
  const modeEl = document.getElementById('mode-label');
  const ring = document.getElementById('progress-ring');
  const startBtn = document.getElementById('btn-start');
  const stopBtn = document.getElementById('btn-stop');
  const textWrap = document.getElementById('timer-text');
  const modeSelect = document.getElementById('mode-select');

  if (timerState?.running) {
    // Running state
    const total = timerState.duration;
    const remaining = timerState.remaining;
    const offset = CIRCUMFERENCE * (1 - remaining / total);
    ring.setAttribute('stroke-dashoffset', offset);
    ring.classList.toggle('break', timerState.mode !== 'focus');

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const labels = { focus: '专注中...', break: '休息中...', longBreak: '长休息...' };
    modeEl.textContent = labels[timerState.mode] || '进行中';

    startBtn.textContent = '⏸ 暂停';
    startBtn.classList.add('pause');
    stopBtn.style.display = 'block';
    textWrap.classList.add('running');
    modeSelect.style.opacity = '0.5';
    modeSelect.style.pointerEvents = 'none';
  } else if (timerState && !timerState.completed) {
    // Paused
    const total = timerState.duration;
    const remaining = timerState.remaining;
    const offset = CIRCUMFERENCE * (1 - remaining / total);
    ring.setAttribute('stroke-dashoffset', offset);

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    modeEl.textContent = '已暂停';

    startBtn.textContent = '▶ 继续';
    startBtn.classList.remove('pause');
    stopBtn.style.display = 'block';
    textWrap.classList.remove('running');
    modeSelect.style.opacity = '0.5';
  } else {
    // Idle or completed
    ring.setAttribute('stroke-dashoffset', '0');
    ring.classList.remove('break');

    // Show default time for selected mode
    const defaults = { focus: 25, break: 5, longBreak: 15 };
    timeEl.textContent = `${String(defaults[currentMode] || 25).padStart(2, '0')}:00`;
    modeEl.textContent = timerState?.completed ? '已完成 ✓' : '准备开始';

    startBtn.textContent = '▶ 开始专注';
    startBtn.classList.remove('pause');
    stopBtn.style.display = 'none';
    textWrap.classList.remove('running');
    modeSelect.style.opacity = '1';
    modeSelect.style.pointerEvents = 'auto';
  }
}
