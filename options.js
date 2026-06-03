// FocusPulse - Options
const DEFAULTS={focusDuration:25,breakDuration:5,longBreakDuration:15,sessionsBeforeLongBreak:4,autoStartBreaks:false,autoStartFocus:false,notifications:true};
document.addEventListener('DOMContentLoaded',async()=>{
  const{settings}=await chrome.storage.sync.get('settings');
  const s=settings||DEFAULTS;
  document.getElementById('focus-duration').value=s.focusDuration||25;
  document.getElementById('break-duration').value=s.breakDuration||5;
  document.getElementById('long-break').value=s.longBreakDuration||15;
  document.getElementById('sessions-before').value=s.sessionsBeforeLongBreak||4;
  document.getElementById('notifications').checked=s.notifications!==false;
  document.getElementById('auto-start-break').checked=s.autoStartBreaks||false;
  document.getElementById('auto-start-focus').checked=s.autoStartFocus||false;
  document.getElementById('save').addEventListener('click',async()=>{
    const btn=document.getElementById('save');btn.disabled=true;btn.textContent='保存中...';
    await chrome.storage.sync.set({settings:{
      focusDuration:parseInt(document.getElementById('focus-duration').value)||25,
      breakDuration:parseInt(document.getElementById('break-duration').value)||5,
      longBreakDuration:parseInt(document.getElementById('long-break').value)||15,
      sessionsBeforeLongBreak:parseInt(document.getElementById('sessions-before').value)||4,
      autoStartBreaks:document.getElementById('auto-start-break').checked,
      autoStartFocus:document.getElementById('auto-start-focus').checked,
      notifications:document.getElementById('notifications').checked
    }});
    btn.disabled=false;btn.textContent='保存设置';
    const el=document.getElementById('status');el.textContent='✓ 已保存!';el.style.display='inline';
    setTimeout(()=>el.style.display='none',2000);
  });
});
