// ══ 休暇管理機能（産休・育休・休職・ガントチャート） ══

// 「完了済み」セクションの開閉状態（画面を離れるとリセットされる一時的な状態）
let leaveChecklistShowDone = false;

function setLeaveView(v){
  leaveView = v;
  ['gantt','table'].forEach(id=>{
    const btn = document.getElementById('lv-'+id);
    if(!btn) return;
    btn.style.background = id===v ? 'var(--accent)' : 'transparent';
    btn.style.color      = id===v ? '#fff'          : 'var(--text2)';
  });
  const ganttBody = document.getElementById('leave-gantt-body');
  const tableBody = document.getElementById('leave-table-body');
  if(ganttBody) ganttBody.style.display = v==='gantt' ? '' : 'none';
  if(tableBody) tableBody.style.display = v==='table' ? '' : 'none';
  if(v==='table') renderLeaveTable();
}

function renderLeaveTable(){
  const el = document.getElementById('leave-table-body');
  if(!el) return;
  if(!leaveRecords.length){
    el.innerHTML = '<div style="padding:24px;text-align:center;font-size:12px;color:var(--text3)">「＋ 追加」から休職者を登録してください</div>';
    return;
  }

  // 全レコードをフラット展開
  const rows = [];
  leaveRecords.forEach((r, idx) => {
    const exts    = r.extensions || [];
    const lastEnd = exts.length ? exts[exts.length-1].end : (r.end || '');
    const nowMs   = new Date().setHours(0,0,0,0);
    const startMs = r.start ? new Date(r.start).getTime() : NaN;
    const endMs   = lastEnd ? new Date(lastEnd).getTime() : NaN;
    const elapsed = !isNaN(startMs) ? Math.max(0, Math.floor((nowMs - startMs) / 86400000)) : null;
    const remain  = !isNaN(endMs)   ? Math.max(0, Math.floor((endMs   - nowMs ) / 86400000)) : null;
    rows.push({ r, idx, lastEnd, elapsed, remain });
  });

  const W = ['60px','100px','80px','90px','110px','110px','60px','70px','90px'];
  const headers = ['社員番号','氏名','所属','種別','開始日','終了予定日','経過','残り','操作'];

  el.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--accent);color:#fff">
            ${headers.map((h,i)=>`<th style="padding:8px 10px;text-align:left;font-weight:700;white-space:nowrap;width:${W[i]}">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(({r,idx,lastEnd,elapsed,remain},ri)=>{
            const type = LEAVE_TYPES[r.type]||LEAVE_TYPES.other;
            const linkedCnt = tasks.filter(t=>t.leavePersonLink===r.name).length;
            const bg = ri%2===0?'#fff':'#f8fafc';
            return `<tr style="background:${bg};border-bottom:1px solid #e2e8f0;transition:background .1s"
              onmouseover="this.style.background='var(--accent-light)'"
              onmouseout="this.style.background='${bg}'">
              <td style="padding:8px 10px;font-family:var(--mono);color:var(--text2)">${r.empId||'-'}</td>
              <td style="padding:8px 10px;font-weight:700;cursor:pointer;color:var(--accent)"
                onclick="jumpToPersonTasks('${r.name}')" title="タスクを表示">
                ${r.name}${linkedCnt?`<span style="font-size:10px;margin-left:4px;color:var(--accent)">🔗${linkedCnt}</span>`:''}
              </td>
              <td style="padding:8px 10px;color:var(--text2)">${r.dept||'-'}</td>
              <td style="padding:8px 10px">
                <span style="background:${type.light};color:${type.color};padding:2px 8px;border-radius:8px;font-weight:700;font-size:11px;border:1px solid ${type.color}33">${type.icon} ${type.label}</span>
              </td>
              <td style="padding:8px 10px;font-family:var(--mono)">${r.start}</td>
              <td style="padding:8px 10px;font-family:var(--mono);color:${lastEnd?'var(--text)':'#f59e0b'};font-weight:${lastEnd?'400':'700'}">${lastEnd||'未定'}</td>
              <td style="padding:8px 10px;font-family:var(--mono);color:var(--text3)">${elapsed!==null?elapsed+'日':'—'}</td>
              <td style="padding:8px 10px;font-family:var(--mono);color:${remain!==null&&remain<30?'var(--red)':remain!==null&&remain<90?'#f59e0b':'var(--text2)'};font-weight:${remain!==null&&remain<30?'700':'400'}">${remain!==null?remain+'日':'—'}</td>
              <td style="padding:6px 8px">
                <div style="display:flex;gap:4px">
                  <button onclick="openExtendModal(${idx})" style="font-size:10px;padding:3px 6px;border-radius:5px;border:1px solid #16a34a;background:#f0fdf4;color:#16a34a;cursor:pointer;white-space:nowrap"
                    onmouseover="this.style.background='#16a34a';this.style.color='#fff'"
                    onmouseout="this.style.background='#f0fdf4';this.style.color='#16a34a'">延長</button>
                  <button onclick="openLeaveModal(${idx})" style="font-size:10px;padding:3px 6px;border-radius:5px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer"
                    onmouseover="this.style.borderColor='var(--accent)'"
                    onmouseout="this.style.borderColor='var(--border)'">✏️</button>
                  <button onclick="deleteLeaveRecord(${idx})" style="font-size:10px;padding:3px 6px;border-radius:5px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer"
                    onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
                    onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function downloadChecklistCsvTemplate(type){
  const labels = { join:'入社', leave:'退職', maternity:'産休', childcare:'育休', sick:'休職' };
  const label = labels[type] || type;
  // デフォルト項目をサンプルとして出力
  const defaultItems = type==='join'||type==='leave'
    ? ONBOARDING_TEMPLATES[type]
    : LEAVE_CHECKLISTS[type]?.items || [];
  const bom = '\uFEFF';
  const rows = [
    CHECKLIST_CSV_HEADERS,
    ...defaultItems.map((item,i) => [item, '', i===0?'5':'']),
  ];
  const csv = bom + rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=u; a.download=`checklist_${label}_tasks.csv`; a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
  toast(`⬇ ${label}チェックリストCSVをダウンロードしました`);
}

function importChecklistCsv(event, type, listKind){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      let text = e.target.result;
      if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
      const lines = text.split(/\r?\n/).filter(l=>l.trim());
      if(lines.length < 2){ toast('⚠ データが見つかりません',true); return; }

      const header = parseCsvLine(lines[0]);
      const customItems = [];
      const today = new Date(); today.setHours(0,0,0,0);

      for(let i=1; i<lines.length; i++){
        const row = parseCsvLine(lines[i]);
        if(!row.length) continue;
        const vals = {};
        header.forEach((h,j)=>vals[h]=row[j]||'');

        const title   = (vals['タスク名']||'').trim();
        const dueDate = (vals['期限日（YYYY-MM-DD）']||'').trim();
        const bizN    = parseInt(vals['営業日後（期限日の代わりに指定）']||'');

        if(!title) continue;

        // 期限日の計算（営業日優先）
        let resolvedDue = dueDate;
        if(!resolvedDue && bizN > 0){
          const result = addBusinessDays(new Date(today), bizN);
          resolvedDue = `${result.getFullYear()}-${String(result.getMonth()+1).padStart(2,'0')}-${String(result.getDate()).padStart(2,'0')}`;
        }

        customItems.push({ title, due: resolvedDue });
      }

      if(!customItems.length){ toast('⚠ タスクが見つかりませんでした',true); return; }

      // 対象のチェックリスト種別にカスタム項目を保存
      const storageKey = `checklist_custom_${type}`;
      localStorage.setItem(storageKey, JSON.stringify(customItems));

      // 再描画
      if(listKind==='onboarding') renderOnboarding();
      else renderLeaveChecklist();

      event.target.value='';
      toast(`✅ ${customItems.length}件のタスクを取込みました。新規追加時にこの項目が使われます`);
    }catch(err){
      toast('⚠ CSVの読み込みに失敗しました: '+err.message, true);
    }
  };
  reader.readAsText(file,'UTF-8');
}

function getChecklistItems(type, listKind){
  const storageKey = `checklist_custom_${type}`;
  const custom = localStorage.getItem(storageKey);
  if(custom){
    try{ return JSON.parse(custom); } catch(e){}
  }
  // デフォルト項目をオブジェクト形式に変換
  const defaults = listKind==='onboarding'
    ? ONBOARDING_TEMPLATES[type]
    : LEAVE_CHECKLISTS[type]?.items || [];
  return defaults.map(title=>({ title, due:'' }));
}

function saveLeaveChecklistPersons(){ localStorage.setItem('leave_checklist_persons', JSON.stringify(leaveChecklistPersons)); }

// 全項目チェック済みの対象者を「完了済み」として判定する（自動で一覧から畳む）
function isLeaveChecklistComplete(p){
  const mk = LEAVE_TYPE_TO_MASTER[p.type] || 'kyushoku';
  const items = getMasterItems(mk);
  const state = p.checks || {};
  const doneCount = items.filter((_,i)=>state[i]).length;
  return items.length>0 && doneCount===items.length;
}

function renderLeaveChecklist(){
  const el = document.getElementById('leave-checklist-area');
  if(!el) return;
  // 産休・育休・休職を1つの「休職用マスタ(kyushoku)」に共通化。種別はバッジで識別
  const allPersons = leaveChecklistPersons;
  // 全項目完了した対象者は自動的にメイン一覧から外し、下の「完了済み」に畳んでおく
  const persons = allPersons.filter(p => !isLeaveChecklistComplete(p));
  const completedPersons = allPersons.filter(p => isLeaveChecklistComplete(p));

  const section = `<div style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow-sm)">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border)">
      <span style="font-size:14px;font-weight:700">🤱 産休・育休・パパ育休・休職 チェックリスト</span>
      <div style="display:flex;gap:5px">
        <button onclick="openMasterManager()" class="btn btn-ghost" style="font-size:11px;padding:4px 8px">⚙️ マスタ管理</button>
        <button onclick="openLeaveChecklistModal('maternity')" class="btn btn-primary" style="font-size:11px;padding:4px 10px">＋ 対象者を追加</button>
      </div>
    </div>
    <div style="padding:12px 16px">
      ${persons.length===0
        ? `<div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">「＋ 対象者を追加」から登録してください</div>`
        : persons.map(p => renderLeaveChecklistCard(p)).join('')
      }
    </div>
  </div>`;

  const completedSection = completedPersons.length ? `<div style="margin-top:10px">
    <div onclick="toggleLeaveChecklistDoneSection()" style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text3);font-weight:700;padding:4px 2px">
      <span id="lc-done-arrow">${leaveChecklistShowDone?'▲':'▼'}</span> ✅ 完了済み（${completedPersons.length}件）
    </div>
    <div id="lc-done-list" style="display:${leaveChecklistShowDone?'block':'none'};margin-top:6px">
      ${completedPersons.map(p => renderLeaveChecklistCard(p)).join('')}
    </div>
  </div>` : '';

  el.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:6px">
      ✅ 対応チェックリスト
    </div>
    <div style="margin-bottom:16px">
      ${section}
      ${completedSection}
    </div>`;
}

function toggleLeaveChecklistDoneSection(){
  leaveChecklistShowDone = !leaveChecklistShowDone;
  renderLeaveChecklist();
}

function renderLeaveChecklistCard(p){
  // 産休/育休/パパ育休/休職それぞれ独立したマスタを使用。種別はバッジで識別
  const mk = LEAVE_TYPE_TO_MASTER[p.type] || 'kyushoku';
  const items = getMasterItems(mk);
  const meta = CHECKLIST_MASTERS[mk];
  const subBadge = `<span style="font-size:10px;padding:1px 7px;border-radius:8px;background:${meta.light};color:${meta.color};border:1px solid ${meta.border};font-weight:700">${meta.icon} ${meta.label}</span>`;
  const state = p.checks || {};
  const doneCount = items.filter((_,i)=>state[i]).length;
  const pct = items.length ? Math.round(doneCount/items.length*100) : 0;
  const isComplete = items.length>0 && doneCount===items.length;

  return `<div style="border:1px solid ${isComplete?'var(--green)':'var(--border)'};border-radius:8px;overflow:hidden;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:${isComplete?'var(--green-light)':'var(--surface2)'};cursor:pointer"
      onclick="toggleLeaveChecklistCard('${p.id}')">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${subBadge}
          <span style="font-size:12px;font-weight:700;color:${isComplete?'var(--green)':'var(--text)'}">${escHtml(p.name)}</span>
          ${p.date?`<span style="font-size:10px;font-family:var(--mono);color:var(--text3)">${p.date}</span>`:''}
          <span style="font-size:10px;padding:1px 6px;border-radius:8px;background:${isComplete?'var(--green)':'var(--surface)'};color:${isComplete?'#fff':'var(--text3)'};border:1px solid ${isComplete?'var(--green)':'var(--border)'};font-weight:600">${isComplete?'✅完了':`${doneCount}/${items.length}`}</span>
        </div>
        <div style="height:3px;background:var(--border);border-radius:4px;margin-top:5px;overflow:hidden">
          <div style="height:100%;background:${isComplete?'var(--green)':'var(--accent)'};width:${pct}%;transition:width .3s"></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        <button onclick="event.stopPropagation();createLeaveChecklistTasks('${p.id}')"
          style="font-size:10px;padding:2px 7px;border-radius:5px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent);cursor:pointer;font-family:var(--font)"
          onmouseover="this.style.background='var(--accent)';this.style.color='#fff'"
          onmouseout="this.style.background='var(--accent-light)';this.style.color='var(--accent)'">📋</button>
        <button onclick="event.stopPropagation();deleteLeaveChecklistPerson('${p.id}')"
          style="font-size:10px;padding:2px 7px;border-radius:5px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer"
          onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
          onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑</button>
        <span style="font-size:11px;color:var(--text3)">${p.open?'▲':'▼'}</span>
      </div>
    </div>
    ${p.open ? `<div style="padding:8px 12px">
      ${items.map((item,i)=>{
        const t=typeof item==='object'?item:{title:item,due:''};
        const today=new Date().toISOString().split('T')[0];
        const isOver=t.due&&t.due<today&&!state[i];
        const impBadge = t.importance==='must'
          ? `<span style="font-size:9px;padding:0 5px;border-radius:6px;background:var(--red-light);color:var(--red);font-weight:700;flex-shrink:0">必須</span>`
          : t.importance==='recommend'
          ? `<span style="font-size:9px;padding:0 5px;border-radius:6px;background:var(--yellow-light);color:var(--yellow);font-weight:700;flex-shrink:0">推奨</span>` : '';
        return `<label style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <input type="checkbox" ${state[i]?'checked':''} onchange="toggleLeaveChecklistItem('${p.id}',${i},this.checked)"
            style="width:14px;height:14px;accent-color:var(--accent);flex-shrink:0;margin-top:1px">
          <span style="flex:1;font-size:11px;color:${state[i]?'var(--text3)':'var(--text)'};text-decoration:${state[i]?'line-through':'none'};line-height:1.4">
            <span style="display:flex;align-items:center;gap:6px">${impBadge}<span>${escHtml(t.title)}</span></span>
            ${t.desc?`<span style="display:block;font-size:10px;color:var(--text3);margin-top:2px">${escHtml(t.desc)}</span>`:''}
          </span>
          ${t.due?`<span style="font-size:10px;font-family:var(--mono);padding:1px 5px;border-radius:5px;background:${isOver?'#fef2f2':'var(--surface2)'};color:${isOver?'var(--red)':'var(--text3)'};border:1px solid ${isOver?'#fecaca':'var(--border)'};white-space:nowrap">${t.due}</span>`:''}
        </label>`;
      }).join('')}
    </div>` : ''}
  </div>`;
}

function toggleLeaveChecklistCard(id){
  const p = leaveChecklistPersons.find(x=>x.id===id);
  if(p){ p.open=!p.open; saveLeaveChecklistPersons(); renderLeaveChecklist(); }
}

function toggleLeaveChecklistItem(id, idx, checked){
  const p = leaveChecklistPersons.find(x=>x.id===id);
  if(!p) return;
  if(!p.checks) p.checks={};
  p.checks[idx]=checked;
  saveLeaveChecklistPersons(); renderLeaveChecklist();
}

function deleteLeaveChecklistPerson(id){
  if(!confirm('このチェックリストを削除しますか？')) return;
  leaveChecklistPersons = leaveChecklistPersons.filter(x=>x.id!==id);
  saveLeaveChecklistPersons(); renderLeaveChecklist();
  toast('🗑 削除しました');
}

function openLeaveChecklistModal(type){
  type = type || 'maternity';
  modalShow('lc-modal-overlay');
  document.getElementById('lc-modal-title').textContent = '🤱 休業・休職チェックリストを追加（産休・育休・パパ育休・休職）';
  ['lc-name','lc-dept','lc-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  setLeaveType(type);
}

function setLeaveType(type){
  document.getElementById('lc-type').value = type;
  const cfg={maternity:'#ec4899',childcare:'#f59e0b',papa:'#0ea5e9',sick:'#64748b'};
  ['maternity','childcare','papa','sick'].forEach(t=>{
    const b=document.getElementById('lc-seg-'+t); if(!b)return;
    if(t===type){ b.style.background=cfg[t]; b.style.color='#fff'; b.style.borderColor=cfg[t]; }
    else { b.style.background='transparent'; b.style.color='var(--text2)'; b.style.borderColor='var(--border)'; }
  });
  const lbl=document.getElementById('lc-date-label');
  if(lbl) lbl.textContent = type==='maternity'?'産休開始日':type==='childcare'?'育休開始日':type==='papa'?'パパ育休開始日':'休職開始日';
}

function closeLeaveChecklistModal(){ modalHide('lc-modal-overlay'); }

function saveLeaveChecklistPerson(){
  const name = document.getElementById('lc-name').value.trim();
  if(!name){ toast('⚠ 氏名を入力してください',true); return; }
  const type = document.getElementById('lc-type').value;
  leaveChecklistPersons.push({
    id:'lc'+Date.now(), type, name,
    dept:  document.getElementById('lc-dept').value.trim(),
    date:  document.getElementById('lc-date').value,
    checks:{}, open:true,
  });
  saveLeaveChecklistPersons(); closeLeaveChecklistModal(); renderLeaveChecklist();
  toast(`✅ ${name}のチェックリストを作成しました`);
}

function createLeaveChecklistTasks(id){
  const p = leaveChecklistPersons.find(x=>x.id===id);
  if(!p) return;
  const mk = LEAVE_TYPE_TO_MASTER[p.type] || 'kyushoku';
  const meta = CHECKLIST_MASTERS[mk];
  const items = getMasterItems(mk);
  const due = p.date || `${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}`;
  items.forEach((item,i)=>{
    const t = typeof item==='object'?item:{title:item};
    const itemDue = (typeof item==='object'&&item.due)?item.due:due;
    tasks.push({
      id:Date.now()+i, title:`【${meta.label}】${p.name} / ${t.title}`,
      cat:'sankyuiku', due:itemDue||due, status:'todo',
      leaveType: p.type,   // ← 一覧バッジ用（maternity/childcare/papa/sick）
      assignee:currentUser?.id||'', approver:'', remind:'3',
      note:`対象者：${p.name}${p.date?' / '+p.date:''}${t.desc?'\n'+t.desc:''}`,
      rep:'', comments:[], files:[], subtasks:[], leavePersonLink:p.name,
    });
  });
  saveTasks(); renderTasks(); renderStats();
  if(isGasEnabled()) syncData(true, true);
  toast(`✅ ${p.name}の${meta.label}手続き ${items.length}件をタスクに追加しました`);
}

function saveLeaveRecords(){
  localStorage.setItem('leave_records', JSON.stringify(leaveRecords));
}

function renderLeaveGantt(){
  const area = document.getElementById('leave-gantt-area');
  if(!area){ console.error('leave-gantt-area not found'); return; }
  area.style.display = 'block'; // 確実に表示

  const now = new Date();

  // 表示期間：全レコードの最小開始月〜最大終了月
  let rangeStart, rangeEnd;
  if(leaveRecords.length === 0){
    // データなし時は今月を含む前後3ヶ月
    rangeStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    rangeEnd   = new Date(now.getFullYear(), now.getMonth() + 3, 0);
  } else {
    leaveRecords.forEach(r => {
      const s = new Date(r.start);
      const e = r.end ? new Date(r.end) : new Date(now.getFullYear()+1, now.getMonth(), 0);
      const sMonth = new Date(s.getFullYear(), s.getMonth(), 1);
      const eMonth = new Date(e.getFullYear(), e.getMonth(), 1);
      if(!rangeStart || sMonth < rangeStart) rangeStart = sMonth;
      if(!rangeEnd   || eMonth > rangeEnd  ) rangeEnd   = eMonth;
    });
    // 余白：前1ヶ月・後1ヶ月
    rangeStart = new Date(rangeStart.getFullYear(), rangeStart.getMonth() - 1, 1);
    rangeEnd   = new Date(rangeEnd.getFullYear(),   rangeEnd.getMonth()   + 1, 1);
  }

  // 月リストを生成
  const monthList = [];
  let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const endLimit = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  let safety = 0;
  while(cur <= endLimit && safety < 60){
    monthList.push({ year: cur.getFullYear(), month: cur.getMonth()+1 });
    cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
    safety++;
  }
  if(monthList.length === 0){
    // フォールバック：今月前後3ヶ月
    for(let i=-2; i<=3; i++){
      const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
      monthList.push({ year: d.getFullYear(), month: d.getMonth()+1 });
    }
  }
  const MONTHS = monthList.length;

  // 列幅計算
  const COL_EMP   = 60;
  const COL_NAME  = 80;
  const COL_DEPT  = 70;
  const COL_MONTH = 38;

  const totalW = COL_EMP + COL_NAME + COL_DEPT + COL_MONTH * MONTHS;

  area.innerHTML = `
    <div style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow-sm)">
      <!-- ヘッダー -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:14px;font-weight:700;color:var(--text)">👥 休職者管理</span>
          <span style="font-size:11px;font-family:var(--mono);padding:1px 8px;border-radius:10px;background:var(--surface);border:1px solid var(--border);color:var(--text2)">${leaveRecords.length}名</span>
          <!-- ビュー切替 -->
          <div style="display:flex;gap:3px;margin-left:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:2px">
            <button onclick="setLeaveView('gantt')" id="lv-gantt"
              style="padding:4px 10px;border-radius:6px;border:none;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);background:var(--accent);color:#fff;transition:all .12s">📊 ガント</button>
            <button onclick="setLeaveView('table')" id="lv-table"
              style="padding:4px 10px;border-radius:6px;border:none;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);background:transparent;color:var(--text2);transition:all .12s">📋 テーブル</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          ${Object.entries(LEAVE_TYPES).map(([k,v])=>`
            <span style="font-size:10px;display:flex;align-items:center;gap:3px">
              <span style="width:10px;height:10px;border-radius:2px;background:${v.color};display:inline-block"></span>${v.label}
            </span>`).join('')}
          <button onclick="openLeaveModal()" class="btn btn-primary" style="font-size:11px;padding:5px 10px;margin-left:6px">＋ 追加</button>
        </div>
      </div>

      <!-- チャート本体 -->
      <div id="leave-gantt-body" style="overflow-x:auto">
        <div style="min-width:${totalW}px">
          <!-- 年ラベル行（年またぎの場合のみ） -->
          ${monthList[0].year !== monthList[MONTHS-1].year ? `
          <div style="display:flex;border-bottom:1px solid var(--border);background:var(--surface2)">
            <div style="width:${COL_EMP+COL_NAME+COL_DEPT}px;flex-shrink:0;border-right:1px solid var(--border)"></div>
            ${monthList.map(({year,month},i)=>{
              const isFirst = i===0 || monthList[i-1].year!==year;
              const spanEnd = monthList.findIndex((m,j)=>j>i && m.year!==year);
              const span = spanEnd===-1 ? MONTHS-i : spanEnd-i;
              return isFirst ? `<div style="width:${COL_MONTH*span}px;flex-shrink:0;padding:3px 6px;font-size:10px;font-weight:700;color:var(--text3);border-right:1px solid var(--border)">${year}年</div>` : '';
            }).join('')}
          </div>` : ''}

          <!-- 月ヘッダー -->
          <div style="display:flex;border-bottom:2px solid var(--border);background:var(--surface2)">
            <div style="width:${COL_EMP}px;flex-shrink:0;padding:4px 6px;font-size:9px;font-weight:700;color:var(--text3);border-right:1px solid var(--border)">社員番号</div>
            <div style="width:${COL_NAME}px;flex-shrink:0;padding:4px 6px;font-size:9px;font-weight:700;color:var(--text3);border-right:1px solid var(--border)">氏名</div>
            <div style="width:${COL_DEPT}px;flex-shrink:0;padding:4px 6px;font-size:9px;font-weight:700;color:var(--text3);border-right:1px solid var(--border)">所属</div>
            ${monthList.map(({year,month},i)=>{
              const isNow = year===now.getFullYear() && month===now.getMonth()+1;
              return `<div style="width:${COL_MONTH}px;flex-shrink:0;padding:6px 2px;font-size:11px;font-weight:${isNow?'800':'600'};color:${isNow?'var(--accent)':'var(--text2)'};text-align:center;border-right:1px solid var(--border);background:${isNow?'var(--accent-light)':'transparent'}">${month}月</div>`;
            }).join('')}
          </div>

          <!-- 従業員行 -->
          <div id="leave-rows">
            ${leaveRecords.length === 0
              ? `<div style="padding:24px;text-align:center;font-size:12px;color:var(--text3)">「＋ 追加」から休職者を登録してください</div>`
              : renderGroupedLeaveRows(leaveRecords, monthList, COL_EMP, COL_NAME, COL_DEPT, COL_MONTH, now)
            }
          </div>
        </div>
      </div>
      <!-- テーブル表示 -->
      <div id="leave-table-body" style="display:none"></div>
    </div>

  `;
}

function renderLeaveRow(r, idx, monthList, COL_EMP, COL_NAME, COL_DEPT, COL_MONTH, now){
  const type = LEAVE_TYPES[r.type] || LEAVE_TYPES.other;
  const startDate = new Date(r.start);
  const endDate   = r.end ? new Date(r.end) : null;
  // 延長がある場合は最後の延長終了日を使用
  const extensions = r.extensions || [];
  const lastExt = extensions.length ? extensions[extensions.length-1] : null;
  const finalEnd = lastExt ? new Date(lastExt.end) : endDate;
  const ROW_H = 34, BAR_H = 20;

  const months = monthList.map(({year,month})=>{
    const mStart = new Date(year, month-1, 1);
    const mEnd   = new Date(year, month, 0);
    const effEnd = finalEnd || new Date(year+3, 0, 1);
    const inRange = startDate <= mEnd && effEnd >= mStart;
    const isFirst = inRange && startDate >= mStart && startDate <= mEnd;
    const isLast  = endDate && inRange && endDate >= mStart && endDate <= mEnd;
    const isNow   = year===now.getFullYear() && month===now.getMonth()+1;
    const bg = isNow ? '#dbeafe' : (idx%2===0?'#fff':'#f8fafc');
    if(!inRange){
      return `<div style="width:${COL_MONTH}px;flex-shrink:0;border-right:1px solid #e2e8f0;background:${bg};height:${ROW_H}px"></div>`;
    }
    const rL = isFirst?'8px':'0', rR = isLast?'8px':'0';
    const tip = `${type.label}：${r.start} 〜 ${r.end||'終了未定'}`;
    const pL = isFirst?'3px':'0', pR = isLast?'3px':'0';
    return `<div style="width:${COL_MONTH}px;flex-shrink:0;border-right:1px solid #e2e8f0;background:${bg};height:${ROW_H}px;display:flex;align-items:center;padding-left:${pL};padding-right:${pR}">
      <div style="width:100%;height:${BAR_H}px;background:linear-gradient(180deg,${type.color}ff 0%,${type.color}cc 100%);border-radius:${rL} ${rR} ${rR} ${rL};box-shadow:0 3px 8px ${type.color}55,inset 0 1px 0 rgba(255,255,255,.4);min-width:4px;position:relative;overflow:hidden" title="${tip}">
        <div style="position:absolute;top:0;left:0;right:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,.3) 0%,transparent 100%);border-radius:inherit"></div>
      </div>
    </div>`;
  }).join('');

  const rowBg = idx%2===0?'#fff':'#f8fafc';
  return `<div style="display:flex;border-bottom:1px solid #e2e8f0;align-items:center">
    <div style="width:${COL_EMP}px;flex-shrink:0;padding:4px 6px;font-size:10px;font-family:var(--mono);color:var(--text2);border-right:1px solid #e2e8f0;background:${rowBg};height:${ROW_H}px;display:flex;align-items:center">${r.empId||'-'}</div>
    <div style="width:${COL_NAME}px;flex-shrink:0;padding:6px 8px;font-size:12px;font-weight:700;color:var(--text);border-right:1px solid #e2e8f0;background:${rowBg};height:${ROW_H}px;display:flex;align-items:center;gap:6px">
      <span style="width:10px;height:10px;border-radius:50%;background:${type.color};flex-shrink:0;box-shadow:0 0 0 3px ${type.color}33;display:inline-block"></span>${r.name}
    </div>
    <div style="width:${COL_DEPT}px;flex-shrink:0;padding:4px 6px;font-size:10px;color:var(--text2);border-right:1px solid #e2e8f0;background:${rowBg};height:${ROW_H}px;display:flex;align-items:center">${r.dept||'-'}</div>
    ${months}
  </div>
  <div style="display:flex;background:${rowBg};border-bottom:2px solid #e2e8f0">
    <div style="width:${COL_EMP+COL_NAME+COL_DEPT}px;flex-shrink:0;display:flex;align-items:center;justify-content:flex-end;gap:5px;padding:4px 10px;border-right:1px solid #e2e8f0">
      <button onclick="openLeaveModal(${idx})" style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer;font-family:var(--font)"
        onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">✏️ 編集</button>
      <button onclick="deleteLeaveRecord(${idx})" style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;font-family:var(--font);font-weight:600"
        onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
        onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑 削除</button>
    </div>
    <div style="flex:1;padding:4px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="background:${type.light};color:${type.color};padding:3px 10px;border-radius:12px;font-weight:700;font-size:11px;border:1px solid ${type.color}44">${type.label}</span>
      <span style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--text2)">${r.start} 〜 ${r.end||'終了未定'}</span>
      ${r.note?`<span style="font-size:11px;color:var(--text3)">📝 ${r.note}</span>`:''}
      ${(r.extensions||[]).map((ex,ei)=>`
        <span style="font-size:11px;color:var(--text3)">→</span>
        <span style="background:#f0fdf4;color:#166534;padding:3px 10px;border-radius:12px;font-weight:600;font-size:11px;border:1px solid #bbf7d0">
          延長 〜 ${ex.end}${ex.note?` (${ex.note})`:''}
          <button onclick="deleteExtension(${idx},${ei})" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:11px;margin-left:3px;padding:0" title="この延長を削除">×</button>
        </span>`).join('')}
      <button onclick="openExtendModal(${idx})" style="font-size:11px;padding:3px 10px;border-radius:10px;border:1px solid #16a34a;background:#f0fdf4;color:#16a34a;cursor:pointer;font-family:var(--font);font-weight:700;display:flex;align-items:center;gap:4px"
        onmouseover="this.style.background='#16a34a';this.style.color='#fff'"
        onmouseout="this.style.background='#f0fdf4';this.style.color='#16a34a'">＋ 延長</button>
    </div>
  </div>`;
}

function openExtendModal(idx){
  const r = leaveRecords[idx];
  if(!r) return;
  modalShow('extend-modal-overlay');
  document.getElementById('extend-target-idx').value = idx;
  // 現在の最終終了日を初期値に
  const exts = r.extensions||[];
  const curEnd = exts.length ? exts[exts.length-1].end : r.end||'';
  document.getElementById('extend-end').value = curEnd;
  document.getElementById('extend-note').value = '';
  document.getElementById('extend-modal-name').textContent =
    `${r.name}（${r.start} 〜 ${curEnd||'終了未定'}）`;
}

function closeExtendModal(){
  modalHide('extend-modal-overlay');
}

function saveExtension(){
  const idx = parseInt(document.getElementById('extend-target-idx').value);
  const end = document.getElementById('extend-end').value;
  const note = document.getElementById('extend-note').value.trim();
  if(!end){ toast('⚠ 延長後の終了日を入力してください',true); return; }
  const r = leaveRecords[idx];
  if(!r) return;
  if(!r.extensions) r.extensions = [];
  r.extensions.push({ end, note, at: fmt(T) });
  saveLeaveRecords();
  closeExtendModal();
  renderLeaveGantt();
  toast(`📅 ${r.name}の休職を${end}まで延長しました`);
}

function deleteExtension(idx, extIdx){
  if(!confirm('この延長記録を削除しますか？')) return;
  leaveRecords[idx].extensions.splice(extIdx, 1);
  saveLeaveRecords();
  renderLeaveGantt();
  toast('🗑 延長記録を削除しました');
}

function renderGroupedLeaveRows(records, monthList, COL_EMP, COL_NAME, COL_DEPT, COL_MONTH, now){
  // 氏名でグループ化（同じ名前は1行にまとめる）
  const groups = [];
  const seen = {};
  records.forEach((r, idx) => {
    const key = r.name.trim(); // 氏名のみでグループ化
    if(seen[key] !== undefined){
      groups[seen[key]].records.push({ r, idx });
    } else {
      seen[key] = groups.length;
      groups.push({ key, empId: r.empId, name: r.name, dept: r.dept, records: [{ r, idx }] });
    }
  });

  return groups.map((g, gi) => renderGroupRow(g, gi, monthList, COL_EMP, COL_NAME, COL_DEPT, COL_MONTH, now)).join('');
}

function renderGroupRow(g, gi, monthList, COL_EMP, COL_NAME, COL_DEPT, COL_MONTH, now){
  const ROW_H = 34, BAR_H = 20;
  const rowBg = gi%2===0?'#fff':'#f8fafc';

  // 月セルを描画（複数バーを横に連続表示）
  const months = monthList.map(({year, month}) => {
    const mStart = new Date(year, month-1, 1);
    const mEnd   = new Date(year, month, 0);
    const mDays  = mEnd.getDate();
    const isNow  = year===now.getFullYear() && month===now.getMonth()+1;
    const bg     = isNow ? '#dbeafe' : rowBg;

    // このセルに表示するバーセグメントを収集
    const segments = [];
    g.records.forEach(({r}) => {
      const type      = LEAVE_TYPES[r.type] || LEAVE_TYPES.other;
      const startDate = new Date(r.start);
      const endDate   = r.end ? new Date(r.end) : null;
      const exts      = r.extensions || [];
      const lastExt   = exts.length ? exts[exts.length-1] : null;
      const finalEnd  = lastExt ? new Date(lastExt.end) : endDate;
      const effEnd    = finalEnd || new Date(year+3, 0, 1);
      if(startDate > mEnd || effEnd < mStart) return;

      // このセル内での開始・終了日を計算
      const segStart = startDate > mStart ? startDate : mStart;
      const segEnd   = effEnd   < mEnd   ? effEnd   : mEnd;
      const startDay = segStart.getDate();
      const endDay   = segEnd.getDate();
      const leftPct  = ((startDay - 1) / mDays * 100).toFixed(1);
      const widthPct = ((endDay - startDay + 1) / mDays * 100).toFixed(1);

      const isFirst = startDate >= mStart && startDate <= mEnd;
      const isLast  = finalEnd && finalEnd >= mStart && finalEnd <= mEnd;
      const rL = isFirst ? '6px' : '0';
      const rR = isLast  ? '6px' : '0';
      const tip = `${type.label}：${r.start} 〜 ${r.end||'終了未定'}`;
      segments.push({ type, leftPct, widthPct, rL, rR, tip });
    });

    if(!segments.length){
      return `<div style="width:${COL_MONTH}px;flex-shrink:0;border-right:1px solid #e2e8f0;background:${bg};height:${ROW_H}px"></div>`;
    }

    const barsHtml = segments.map(seg => `
      <div style="position:absolute;left:${seg.leftPct}%;width:${seg.widthPct}%;top:50%;transform:translateY(-50%);height:${BAR_H}px;
        background:linear-gradient(180deg,${seg.type.color}ff 0%,${seg.type.color}cc 100%);
        border-radius:${seg.rL} ${seg.rR} ${seg.rR} ${seg.rL};
        box-shadow:0 2px 6px ${seg.type.color}44,inset 0 1px 0 rgba(255,255,255,.4);
        min-width:4px;overflow:hidden" title="${seg.tip}">
        <div style="position:absolute;top:0;left:0;right:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,.3) 0%,transparent 100%);border-radius:inherit"></div>
      </div>`).join('');

    return `<div style="width:${COL_MONTH}px;flex-shrink:0;border-right:1px solid #e2e8f0;background:${bg};height:${ROW_H}px;position:relative">
      ${barsHtml}
    </div>`;
  }).join('');

  // 情報行（各レコードの詳細）
  const infoRows = g.records.map(({r, idx}) => {
    const type = LEAVE_TYPES[r.type] || LEAVE_TYPES.other;
    const exts = r.extensions || [];
    return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:3px 12px;border-top:1px dashed #e2e8f0">
      <span style="background:${type.light};color:${type.color};padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px;border:1px solid ${type.color}44">${type.label}</span>
      <span style="font-family:var(--mono);font-size:11px;color:var(--text2)">${r.start} 〜 ${r.end||'終了未定'}</span>
      ${exts.map((ex,ei)=>`
        <span style="font-size:11px;color:var(--text3)">→</span>
        <span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:10px;font-size:11px;border:1px solid #bbf7d0;font-weight:600">
          延長 〜 ${ex.end}${ex.note?` (${ex.note})`:''}
          <button onclick="deleteExtension(${idx},${ei})" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:11px;margin-left:2px;padding:0" title="削除">×</button>
        </span>`).join('')}
      ${r.note?`<span style="font-size:11px;color:var(--text3)">📝 ${r.note}</span>`:''}
      <div style="margin-left:auto;display:flex;gap:4px">
        <button onclick="openExtendModal(${idx})" style="font-size:11px;padding:2px 8px;border-radius:8px;border:1px solid #16a34a;background:#f0fdf4;color:#16a34a;cursor:pointer;font-family:var(--font);font-weight:600"
          onmouseover="this.style.background='#16a34a';this.style.color='#fff'"
          onmouseout="this.style.background='#f0fdf4';this.style.color='#16a34a'">＋ 延長</button>
        <button onclick="openLeaveModal(${idx})" style="font-size:11px;padding:2px 8px;border-radius:8px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer;font-family:var(--font)"
          onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
          onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">✏️</button>
        <button onclick="deleteLeaveRecord(${idx})" style="font-size:11px;padding:2px 8px;border-radius:8px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;font-family:var(--font);font-weight:600"
          onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
          onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑</button>
      </div>
    </div>`;
  }).join('');

  // 凡例（複数レコードある場合のみ）
  const legend = g.records.length > 1
    ? `<div style="display:flex;align-items:center;gap:6px;padding:2px 12px">
        ${g.records.map(({r})=>{
          const t=LEAVE_TYPES[r.type]||LEAVE_TYPES.other;
          return `<span style="display:flex;align-items:center;gap:3px;font-size:10px;color:var(--text3)"><span style="width:10px;height:6px;border-radius:2px;background:${t.color};display:inline-block"></span>${t.label}</span>`;
        }).join('')}
      </div>` : '';

  return `<div style="border-bottom:2px solid #cbd5e1">
    <!-- メイン行 -->
    <div style="display:flex;align-items:center">
      <div style="width:${COL_EMP}px;flex-shrink:0;padding:4px 6px;font-size:11px;font-family:var(--mono);color:var(--text2);border-right:1px solid #e2e8f0;background:${rowBg};height:${ROW_H}px;display:flex;align-items:center">${g.empId||'-'}</div>
      <div style="width:${COL_NAME}px;flex-shrink:0;padding:4px 6px;font-size:11px;font-weight:700;color:var(--accent);border-right:1px solid #e2e8f0;background:${rowBg};height:${ROW_H}px;display:flex;align-items:center;gap:5px;cursor:pointer;text-decoration:underline dotted"
        onclick="jumpToPersonTasks('${g.name}')"
        title="${g.name}の関連タスクを表示"
        onmouseover="this.style.background='var(--accent-light)'"
        onmouseout="this.style.background='${rowBg}'">
        <div style="display:flex;flex-direction:column;gap:2px">
          ${g.records.map(({r})=>{const t=LEAVE_TYPES[r.type]||LEAVE_TYPES.other;return `<span style="width:8px;height:8px;border-radius:50%;background:${t.color};box-shadow:0 0 0 2px ${t.color}33;display:inline-block"></span>`;}).join('')}
        </div>
        <div>
          <div>${g.name}</div>
          ${(()=>{const cnt=tasks.filter(t=>t.leavePersonLink===g.name).length;return cnt?`<div style="font-size:10px;color:var(--accent);font-weight:600">🔗 ${cnt}件</div>`:''})()}
        </div>
      </div>
      <div style="width:${COL_DEPT}px;flex-shrink:0;padding:4px 6px;font-size:11px;color:var(--text2);border-right:1px solid #e2e8f0;background:${rowBg};height:${ROW_H}px;display:flex;align-items:center">${g.dept||'-'}</div>
      ${months}
    </div>
    <!-- 追加ボタン -->
    <div style="display:flex;padding:3px 12px;border-top:1px solid #e2e8f0;background:${rowBg};justify-content:flex-end">
      <button onclick="addLeaveForSamePerson(${JSON.stringify(g.records[0].r).replace(/"/g,'&quot;')})" 
        style="font-size:11px;padding:3px 10px;border-radius:8px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent);cursor:pointer;font-family:var(--font);font-weight:600"
        onmouseover="this.style.background='var(--accent)';this.style.color='#fff'"
        onmouseout="this.style.background='var(--accent-light)';this.style.color='var(--accent)'">＋ 産休/育休を追加</button>
    </div>
    <!-- 詳細行 -->
    <div style="background:${gi%2===0?'#f8fafc':'#fff'}">${legend}${infoRows}</div>
  </div>`;
}

function jumpToPersonTasks(name){
  // 名前で紐づけられたタスクを検索（leavePersonLink または assigneeの名前）
  const member = MEMBERS.find(m => m.name === name);
  const linkedTasks = tasks.filter(t => t.leavePersonLink === name);
  const assignedTasks = member ? tasks.filter(t => t.assignee === member.id && !linkedTasks.find(l=>l.id===t.id)) : [];
  const allTasks = [...linkedTasks, ...assignedTasks];

  // すべてタブに切替
  document.querySelectorAll('.cat-tab').forEach(t=>{
    if(t.textContent.includes('産休')) t.classList.add('active');
    else t.classList.remove('active');
  });
  majorCat = 'sankyuiku';

  const layout = document.querySelector('.layout');
  if(layout) layout.style.display = 'grid';
  document.getElementById('main-panel').style.display = '';
  document.getElementById('leave-gantt-area').style.display = 'none';

  const memberColor = member?.color || '#6b7280';
  const memberInitial = member?.initial || name[0];

  const c = document.getElementById('task-container');
  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <div style="width:28px;height:28px;border-radius:50%;background:${memberColor};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0">${memberInitial}</div>
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${name} の関連タスク</div>
        ${linkedTasks.length?`<div style="font-size:11px;color:var(--text3)">🔗 紐づけ ${linkedTasks.length}件 ${assignedTasks.length?`/ 担当 ${assignedTasks.length}件`:''}</div>`:''}
      </div>
      <button onclick="renderLeaveGantt();document.getElementById('task-container').innerHTML=''" 
        style="margin-left:auto;font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer;font-family:var(--font)"
        onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">← ガントチャートに戻る</button>
    </div>
    ${linkedTasks.length ? `
      <div style="font-size:11px;font-weight:700;color:var(--text3);font-family:var(--mono);letter-spacing:1px;margin-bottom:6px">🔗 紐づけられたタスク</div>
      ${linkedTasks.map(cardHTML).join('')}
    ` : ''}
    ${assignedTasks.length ? `
      <div style="font-size:11px;font-weight:700;color:var(--text3);font-family:var(--mono);letter-spacing:1px;margin:${linkedTasks.length?'14px':0} 0 6px">📋 担当タスク</div>
      ${assignedTasks.map(cardHTML).join('')}
    ` : ''}
    ${!allTasks.length ? `<div class="empty-state"><div class="icon">📋</div>${name}の関連タスクはありません<br><span style="font-size:11px">タスク作成時に「休職者との紐づけ」で設定できます</span></div>` : ''}
  `;
  toast(`👤 ${name}の関連タスクを表示しています`);
}

function addLeaveForSamePerson(baseRecord){
  // 同じ人の情報を引き継いでモーダルを開く
  openLeaveModal();
  setTimeout(()=>{
    document.getElementById('leave-emp-id').value = baseRecord.empId||'';
    document.getElementById('leave-name').value   = baseRecord.name||'';
    document.getElementById('leave-dept').value   = baseRecord.dept||'';
    // 育休をデフォルトに
    document.getElementById('leave-type').value   = 'childcare';
    // 前のレコードの終了日の翌日を開始日に
    if(baseRecord.end){
      const next = new Date(baseRecord.end);
      next.setDate(next.getDate()+1);
      document.getElementById('leave-start').value = next.toISOString().split('T')[0];
    }
  }, 50);
}

function openLeaveModal(idx){
  modalShow('leave-modal-overlay');
  document.getElementById('leave-modal-title').textContent = idx!==undefined ? '休職者を編集' : '休職者を追加';
  document.getElementById('leave-edit-id').value = idx!==undefined ? idx : '';
  const r = idx!==undefined ? leaveRecords[idx] : null;
  document.getElementById('leave-emp-id').value = r?.empId||'';
  document.getElementById('leave-name').value   = r?.name||'';
  document.getElementById('leave-dept').value   = r?.dept||'';
  document.getElementById('leave-type').value   = r?.type||'maternity';
  document.getElementById('leave-start').value  = r?.start||'';
  document.getElementById('leave-end').value    = r?.end||'';
  document.getElementById('leave-note').value   = r?.note||'';
}

function closeLeaveModal(){
  modalHide('leave-modal-overlay');
}

function saveLeaveRecord(){
  const empId = document.getElementById('leave-emp-id').value.trim();
  const name  = document.getElementById('leave-name').value.trim();
  const start = document.getElementById('leave-start').value;
  if(!name||!start){toast('⚠ 氏名と開始日は必須です',true);return;}
  const vals = {
    empId, name,
    dept:  document.getElementById('leave-dept').value.trim(),
    type:  document.getElementById('leave-type').value,
    start,
    end:   document.getElementById('leave-end').value,
    note:  document.getElementById('leave-note').value.trim(),
  };
  const idx = document.getElementById('leave-edit-id').value;
  if(idx!=='') leaveRecords[parseInt(idx)] = vals;
  else leaveRecords.push(vals);
  saveLeaveRecords();
  closeLeaveModal();
  renderLeaveGantt();
  toast('✅ 保存しました');
}

function deleteLeaveRecord(idx){
  if(!confirm('削除しますか？'))return;
  leaveRecords.splice(idx,1);
  saveLeaveRecords();
  renderLeaveGantt();
  toast('🗑 削除しました');
}

function getShunbun(year){ return Math.floor(20.8431 + 0.242194*(year-1980) - Math.floor((year-1980)/4)); }

function getShubun(year) { return Math.floor(23.2488 + 0.242194*(year-1980) - Math.floor((year-1980)/4)); }

function getJapaneseHolidays(year){
  const h = new Set();
  const add = (m,d) => h.add(`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);

  // 固定祝日
  add(1,1);   // 元日
  add(2,11);  // 建国記念の日
  add(2,23);  // 天皇誕生日
  add(4,29);  // 昭和の日
  add(5,3);   // 憲法記念日
  add(5,4);   // みどりの日
  add(5,5);   // こどもの日
  add(8,11);  // 山の日
  add(11,3);  // 文化の日
  add(11,23); // 勤労感謝の日

  // 春分・秋分の日
  add(3, getShunbun(year));
  add(9, getShubun(year));

  // ハッピーマンデー
  const nthMon = (m, n) => {
    const d = new Date(year, m-1, 1);
    let cnt = 0, day = d;
    while(true){ if(day.getDay()===1){ cnt++; if(cnt===n) return day.getDate(); } day.setDate(day.getDate()+1); }
  };
  add(1, nthMon(1,2));  // 成人の日（1月第2月曜）
  add(7, nthMon(7,3));  // 海の日（7月第3月曜）
  add(9, nthMon(9,3));  // 敬老の日（9月第3月曜）
  add(10,nthMon(10,2)); // スポーツの日（10月第2月曜）

  // 振替休日（日曜の翌月曜）
  const hArr = [...h].sort();
  hArr.forEach(dateStr => {
    const d = new Date(dateStr);
    if(d.getDay()===0){
      // 翌日が祝日の場合はさらに翌日
      let next = new Date(d); next.setDate(next.getDate()+1);
      while(h.has(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`)){
        next.setDate(next.getDate()+1);
      }
      h.add(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`);
    }
  });

  // 国民の休日（祝日に挟まれた平日）
  const hArr2 = [...h].sort();
  hArr2.forEach(dateStr => {
    const d = new Date(dateStr);
    const prev = new Date(d); prev.setDate(prev.getDate()-1);
    const next = new Date(d); next.setDate(next.getDate()+1);
    const fmt = x => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
    if(h.has(fmt(prev)) && !h.has(fmt(next)) && next.getDay()!==0 && next.getDay()!==6){
      // nextが祝日でなく土日でもない → 国民の休日
    }
  });

  return h;
}

function isHoliday(date){
  const y = date.getFullYear();
  const holidays = getJapaneseHolidays(y);
  const key = `${y}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  return holidays.has(key);
}

function isBusinessDay(date){
  const dow = date.getDay();
  if(dow===0 || dow===6) return false; // 土日
  if(isHoliday(date)) return false;    // 祝日
  return true;
}

function addBusinessDays(baseDate, n){
  let d = new Date(baseDate);
  d.setHours(0,0,0,0);
  let count = 0;
  while(count < n){
    d.setDate(d.getDate()+1);
    if(isBusinessDay(d)) count++;
  }
  return d;
}
