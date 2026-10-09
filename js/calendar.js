// ══ カレンダー機能（月表示・Googleカレンダー同期） ══

async function fetchTodayGcal(){
  const el = document.getElementById('gcal-list');
  const btn = document.getElementById('gcal-refresh-btn');
  if(!el) return;

  if(!isGasEnabled()){
    el.innerHTML = '<div style="font-size:11px;color:var(--text3)">GAS設定後に表示されます</div>';
    return;
  }

  // ログイン中メンバーのメール・カレンダーID確認
  const member = currentUser ? MEMBERS.find(m=>m.id===currentUser.id) : null;
  const email = member?.email || '';
  const calId = member?.calendarId || 'primary';

  // メールアドレス未設定の場合は案内を表示
  if(!email){
    el.innerHTML = `<div style="font-size:11px;color:var(--text3);line-height:1.7">
      Googleアカウント未設定<br>
      <button onclick="setMajorCat('admin',document.getElementById('tab-admin'));setTimeout(()=>switchAdminTab('members'),100)"
        style="font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;padding:0;font-family:var(--font);text-decoration:underline">
        メンバー管理で設定する →
      </button>
    </div>`;
    return;
  }

  el.innerHTML = '<div style="font-size:11px;color:var(--text3)">取得中...</div>';
  if(btn){btn.textContent='⏳';btn.disabled=true;}
  try{
    const today = fmt(T);
    const params = new URLSearchParams({action:'calendar', date:today, calendarId:calId, email:email});
    if(gAccessToken) params.append('token', gAccessToken);
    const res = await fetch(`${getGasUrl()}?${params}`);
    const data = await res.json();
    if(data.error) throw new Error(data.error);
    renderGcalList(data.events||[]);
  }catch(e){
    el.innerHTML = `<div style="font-size:11px;color:var(--red)">取得失敗<br><span style="color:var(--text3);font-size:10px">${e.message||''}</span></div>`;
  }finally{
    if(btn){btn.textContent='🔄';btn.disabled=false;}
  }
}

function renderGcalList(events){
  const el = document.getElementById('gcal-list');
  if(!el) return;
  if(!events.length){
    el.innerHTML = '<div style="font-size:11px;color:var(--text3)">今日の予定なし ✓</div>';
    return;
  }
  const d = new Date();
  const gcalUrl = `https://calendar.google.com/calendar/r/day/${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  el.innerHTML = events.map(ev=>{
    // A案: 時刻を上段・タイトルを下段
    let timeHtml = '';
    if(ev.allDay){
      timeHtml = '<div style="font-size:10px;font-family:var(--mono);color:var(--text3);font-weight:700;margin-bottom:3px">終日</div>';
    } else {
      const startJst = toJstTime(ev.start);
      const endJst   = toJstTime(ev.end);
      timeHtml = `<div style="font-size:11px;font-family:var(--mono);color:var(--accent);font-weight:700;margin-bottom:3px">${startJst} 〜 ${endJst}</div>`;
    }
    const meet = ev.meetUrl
      ? `<a href="${ev.meetUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="font-size:10px;color:var(--blue);text-decoration:none;display:block;margin-top:3px">🎥 Meet参加</a>`
      : '';
    const loc = ev.location ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">📍 ${ev.location}</div>` : '';
    return `<a href="${gcalUrl}" target="_blank" rel="noopener" style="text-decoration:none;display:block;margin-bottom:5px">
      <div style="padding:7px 9px;border-radius:7px;background:#fff;border:1px solid var(--border);transition:all .12s;cursor:pointer"
        onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--accent-light)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.background='#fff'">
        ${timeHtml}
        <div style="font-size:12px;font-weight:600;color:var(--text);line-height:1.3">${escHtml(ev.title||'')}</div>
        ${loc}${meet}
      </div>
    </a>`;
  }).join('');
}

async function autoSyncTaskToCalendar(task){
  if(!isGasEnabled()) return;
  if(!task || !task.due || !task.assignee) return;
  const member = MEMBERS.find(m => m.id === task.assignee);
  if(!member || !member.email || !member.calendarId) return;
  if(task.status === 'done'){
    autoDeleteTaskFromCalendar(task.id, task.title, member);
    return;
  }
  try {
    const params = new URLSearchParams({
      action: 'upsertTaskCalendar',
      task:   JSON.stringify({ id: task.id, title: task.title, due: task.due, cat: task.cat, status: task.status, note: task.note || '' }),
      member: JSON.stringify({ name: member.name, calendarId: member.calendarId, email: member.email }),
    });
    if(gAccessToken) params.append('token', gAccessToken);
    await fetch(`${getGasUrl()}?${params}`, { redirect:'follow' });
  } catch(e) {
    console.warn('autoSyncTaskToCalendar failed:', e);
    setSyncStatus('⚠ カレンダー同期失敗');
  }
}

async function autoDeleteTaskFromCalendar(taskId, taskTitle, member){
  if(!isGasEnabled()) return;
  if(!member || !member.email || !member.calendarId) return;
  try {
    const params = new URLSearchParams({
      action:    'deleteTaskCalendar',
      taskId:    String(taskId),
      taskTitle: taskTitle || '',
      member:    JSON.stringify({ calendarId: member.calendarId, email: member.email }),
    });
    if(gAccessToken) params.append('token', gAccessToken);
    await fetch(`${getGasUrl()}?${params}`, { redirect:'follow' });
  } catch(e) {
    console.warn('autoDeleteTaskFromCalendar failed:', e);
    setSyncStatus('⚠ カレンダー削除失敗');
  }
}

function renderCal(){
  document.getElementById('cal-label').textContent=`${cy}年${cm+1}月`;
  const dows=['日','月','火','水','木','金','土'];
  let h=dows.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  const first=new Date(cy,cm,1).getDay(),last=new Date(cy,cm+1,0).getDate();
  // チームタスク＋個人タスク（自分のもの）の期限日に●を表示
  const _allCalTasks = [...tasks, ...(currentUser?getPrivateTasks():[])].filter(t=>
    !t.private || (currentUser && (t.assignee===currentUser.id||t.assignee===''||!t.assignee))
  );
  const tDays=new Set(_allCalTasks.filter(t=>t.status!=='done'&&t.due&&t.due.startsWith(`${cy}-${pad(cm+1)}`)).map(t=>parseInt(t.due.split('-')[2])));
  for(let i=0;i<first;i++)h+='<div class="cal-day empty"></div>';
  for(let d=1;d<=last;d++){
    const ds=`${cy}-${pad(cm+1)}-${pad(d)}`,isT=ds===fmt(T),isH=HOL.includes(ds),dow=(first+d-1)%7;
    let c='cal-day';
    if(isT)c+=' today';else if(isH||dow===0)c+=' holiday';else if(dow===6)c+=' weekend-sat';
    if(tDays.has(d))c+=' has-task';
    h+=`<div class="${c}" onclick="dayClick('${ds}')">${d}</div>`;
  }
  document.getElementById('cal-grid').innerHTML=h;
  bizDays();
}

function chMonth(d){cm+=d;if(cm>11){cm=0;cy++;}if(cm<0){cm=11;cy--;}renderCal();}

function dayClick(dateStr){
  // 今日をクリックした場合は「今日期限」ビューへ
  const isToday=dateStr===fmt(T);
  // ナビアイテムのactiveを更新
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  // タスクを絞り込んで表示
  // チームタスク＋個人タスク（自分のもの）を対象に絞り込み
  const _allDayTasks = [...tasks, ...(currentUser?getPrivateTasks():[])].filter(t=>
    !t.private || (currentUser && (t.assignee===currentUser.id||t.assignee===''||!t.assignee))
  );
  const dayTasks=_allDayTasks.filter(t=>t.status!=='done'&&t.due&&t.due.startsWith(dateStr));
  const label=isToday?'今日期限のタスク':`${dateStr.replace(/-/g,'/')} のタスク`;
  document.getElementById('task-container').innerHTML=
    dayTasks.length
      ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
           <span style="font-size:13px;font-weight:700;color:var(--text)">${label}</span>
           <span style="font-size:11px;font-family:var(--mono);padding:2px 8px;border-radius:10px;background:var(--surface2);color:var(--text2)">${dayTasks.length}件</span>
           <button onclick="resetCalFilter()" style="margin-left:auto;font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer">✕ クリア</button>
         </div>`+dayTasks.map(cardHTML).join('')
      : `<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
           <span style="font-size:13px;font-weight:700;color:var(--text)">${label}</span>
           <button onclick="resetCalFilter()" style="margin-left:auto;font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer">✕ クリア</button>
         </div>
         <div class="empty-state"><div class="icon">✨</div>この日のタスクはありません</div>`;
  // カレンダーの選択日をハイライト（単一選択に修正）
  // まず全日付のoutlineとselectedをリセット
  document.querySelectorAll('.cal-day').forEach(el=>{
    el.classList.remove('selected');
    el.style.outline='';
    el.style.background='';
  });
  // 選択した日付だけをハイライト
  if(!isToday){
    document.querySelectorAll('.cal-day').forEach(el=>{
      if(el.classList.contains('empty')) return;
      const dayNum = parseInt(el.textContent.trim());
      const ds = `${cy}-${pad(cm+1)}-${pad(dayNum)}`;
      if(ds === dateStr){
        el.style.outline = '2px solid var(--accent)';
        el.style.background = 'var(--accent-light)';
      }
    });
  }
}

function resetCalFilter(){
  document.querySelectorAll('.cal-day').forEach(el=>{
    el.style.outline='';
    el.style.background='';
  });
  renderTasks();
}

function bizDays(){
  let n=0,last=new Date(cy,cm+1,0).getDate();
  for(let d=1;d<=last;d++){const ds=`${cy}-${pad(cm+1)}-${pad(d)}`,dow=new Date(cy,cm,d).getDay();if(dow!==0&&dow!==6&&!HOL.includes(ds))n++;}
  document.getElementById('bizday').textContent=n;
}
