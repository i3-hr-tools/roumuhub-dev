// ══ 新人オンボーディング機能 ══

function saveOnboardingPersons(){
  localStorage.setItem('onboarding_persons', JSON.stringify(onboardingPersons));
  scheduleAutoSync(); // GASへの同期をスケジュール
}

function saveOnboardingState(){ localStorage.setItem('onboarding_state', JSON.stringify(onboardingState)); }

function renderOnboarding(){
  const el=document.getElementById('onboarding-area'); if(!el)return;

  const joinPersons  = onboardingPersons.filter(p=>p.type==='join');
  const leavePersons = onboardingPersons.filter(p=>p.type==='leave');

  // 入社セクション（新卒/中途バッジ付き）
  const joinSection = `<div style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow-sm)">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border)">
      <span style="font-size:14px;font-weight:700">🚪 入社チェックリスト</span>
      <button onclick="openOnboardingPersonModal('join')" class="btn btn-primary" style="font-size:11px;padding:4px 10px">＋ 入社者を追加</button>
    </div>
    <div style="padding:12px 16px">
      ${joinPersons.length===0
        ? `<div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">「＋ 入社者を追加」から登録してください</div>`
        : joinPersons.map(p => renderPersonCard(p)).join('')
      }
    </div>
  </div>`;

  // 退職セクション（退職用マスタ taishoku を使用）
  const leaveSection = `<div style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow-sm)">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border)">
      <span style="font-size:14px;font-weight:700">👋 退職チェックリスト</span>
      <button onclick="openOnboardingPersonModal('leave')" class="btn btn-primary" style="font-size:11px;padding:4px 10px">＋ 退職者を追加</button>
    </div>
    <div style="padding:12px 16px">
      ${leavePersons.length===0
        ? `<div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">「＋ 退職者を追加」から登録してください</div>`
        : leavePersons.map(p => renderPersonCard(p)).join('')
      }
    </div>
  </div>`;

  // 共通マスタ管理バー（4種別を集約したモーダルを開く）
  const masterBar = `<div style="display:flex;justify-content:flex-end;margin-bottom:12px">
    <button onclick="openMasterManager()" class="btn btn-ghost" style="font-size:11px;padding:6px 12px">⚙️ チェックリスト マスタ管理（新卒/中途/休職/退職）</button>
  </div>`;

  el.innerHTML = masterBar + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    ${joinSection}
    ${leaveSection}
  </div>`;
}

function renderPersonCard(p){
  // 入社者は hireType（新卒/中途）のマスタ、退職者は従来マスタを使用
  const items = (p.type==='join')
    ? getMasterItems(p.hireType || 'chuto')
    : getMasterItems('taishoku');
  const state = p.checks || {};
  const doneCount = items.filter((_,i)=>state[i]).length;
  const pct = items.length ? Math.round(doneCount/items.length*100) : 0;
  const isComplete = items.length>0 && doneCount===items.length;
  const isOpen = p.open;
  // 新卒/中途バッジ
  const meta = (p.type==='join') ? HIRE_TYPE_META[p.hireType || 'chuto'] : null;
  const hireBadge = meta
    ? `<span style="font-size:10px;padding:1px 8px;border-radius:10px;background:${meta.light};color:${meta.color};border:1px solid ${meta.border};font-weight:700">${meta.icon} ${meta.label}</span>`
    : '';

  return `<div style="border:1px solid ${isComplete?'var(--green)':'var(--border)'};border-radius:10px;overflow:hidden;margin-bottom:10px;transition:all .15s">
    <!-- ヘッダー（クリックで展開） -->
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${isComplete?'var(--green-light)':'var(--surface2)'};cursor:pointer"
      onclick="togglePersonCard('${p.id}')">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${hireBadge}
          <span style="font-size:13px;font-weight:700;color:${isComplete?'var(--green)':'var(--text)'}">${escHtml(p.name)}</span>
          ${p.date?`<span style="font-size:11px;font-family:var(--mono);color:var(--text3)">${p.date}</span>`:''}
          ${p.dept?`<span style="font-size:11px;color:var(--text2)">${escHtml(p.dept)}</span>`:''}
          <span style="font-size:11px;padding:1px 8px;border-radius:10px;background:${isComplete?'var(--green)':'var(--surface)'};color:${isComplete?'#fff':'var(--text3)'};border:1px solid ${isComplete?'var(--green)':'var(--border)'};font-weight:600">${isComplete?'✅ 完了':`${doneCount}/${items.length}`}</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:4px;margin-top:6px;overflow:hidden">
          <div style="height:100%;background:${isComplete?'var(--green)':'var(--accent)'};width:${pct}%;transition:width .3s"></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <button onclick="event.stopPropagation();createOnboardingTasksForPerson('${p.id}')" 
          style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent);cursor:pointer;font-family:var(--font)"
          onmouseover="this.style.background='var(--accent)';this.style.color='#fff'"
          onmouseout="this.style.background='var(--accent-light)';this.style.color='var(--accent)'">📋 タスク化</button>
        <button onclick="event.stopPropagation();deleteOnboardingPerson('${p.id}')"
          style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer"
          onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
          onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑</button>
        <span style="font-size:12px;color:var(--text3)">${isOpen?'▲':'▼'}</span>
      </div>
    </div>
    <!-- チェックリスト（展開時のみ） -->
    ${isOpen ? `<div style="padding:10px 16px">
      ${items.map((item,i)=>{
        const t = typeof item==='object'?item:{title:item,due:''};
        const today=new Date().toISOString().split('T')[0];
        const isOver=t.due&&t.due<today&&!state[i];
        const impBadge = t.importance==='must'
          ? `<span style="font-size:9px;padding:0 5px;border-radius:6px;background:var(--red-light);color:var(--red);font-weight:700;flex-shrink:0">必須</span>`
          : t.importance==='recommend'
          ? `<span style="font-size:9px;padding:0 5px;border-radius:6px;background:var(--yellow-light);color:var(--yellow);font-weight:700;flex-shrink:0">推奨</span>` : '';
        return `<label style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <input type="checkbox" ${state[i]?'checked':''} 
            onchange="togglePersonCheck('${p.id}',${i},this.checked)"
            style="width:16px;height:16px;accent-color:var(--accent);flex-shrink:0;margin-top:1px">
          <span style="flex:1;font-size:12px;color:${state[i]?'var(--text3)':'var(--text)'};text-decoration:${state[i]?'line-through':'none'};line-height:1.5">
            <span style="display:flex;align-items:center;gap:6px">${impBadge}<span>${escHtml(t.title)}</span></span>
            ${t.desc?`<span style="display:block;font-size:10px;color:var(--text3);margin-top:2px">${escHtml(t.desc)}</span>`:''}
          </span>
          ${t.due?`<span style="font-size:10px;font-family:var(--mono);padding:1px 6px;border-radius:6px;background:${isOver?'#fef2f2':'var(--surface2)'};color:${isOver?'var(--red)':'var(--text3)'};border:1px solid ${isOver?'#fecaca':'var(--border)'};white-space:nowrap">${t.due}</span>`:''}
        </label>`;
      }).join('')}
    </div>` : ''}
  </div>`;
}

function togglePersonCard(id){
  const p = onboardingPersons.find(x=>x.id===id);
  if(p){ p.open = !p.open; saveOnboardingPersons(); renderOnboarding(); }
}

function togglePersonCheck(id, idx, checked){
  const p = onboardingPersons.find(x=>x.id===id);
  if(!p) return;
  if(!p.checks) p.checks = {};
  p.checks[idx] = checked;
  saveOnboardingPersons(); renderOnboarding();
}

function deleteOnboardingPerson(id){
  if(!confirm('このチェックリストを削除しますか？')) return;
  onboardingPersons = onboardingPersons.filter(x=>x.id!==id);
  saveOnboardingPersons(); renderOnboarding();
  toast('🗑 削除しました');
}

function openOnboardingPersonModal(type){
  modalShow('onboarding-person-modal');
  document.getElementById('ob-type').value = type;
  document.getElementById('ob-modal-title').textContent = type==='join' ? '🚪 入社者を追加' : '👋 退職者を追加';
  document.getElementById('ob-date-label').textContent = type==='join' ? '入社日' : '退職日';
  ['ob-name','ob-dept','ob-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  // 入社時のみ種別セグメント＋プレビューを表示
  const isJoin = type==='join';
  document.getElementById('ob-hire-seg-wrap').style.display = isJoin ? '' : 'none';
  document.getElementById('ob-preview-wrap').style.display  = isJoin ? '' : 'none';
  if(isJoin) setHireType('shinsotsu');
}

function closeOnboardingPersonModal(){ modalHide('onboarding-person-modal'); }

function setHireType(ht){
  document.getElementById('ob-hire-type').value = ht;
  const segS = document.getElementById('ob-seg-shinsotsu');
  const segC = document.getElementById('ob-seg-chuto');
  const on  = (btn,color)=>{ btn.style.background=color; btn.style.color='#fff'; };
  const off = (btn)=>{ btn.style.background='transparent'; btn.style.color='var(--text2)'; };
  if(ht==='shinsotsu'){ on(segS,'#2563eb'); off(segC); } else { on(segC,'#7c3aed'); off(segS); }
  renderHirePreview(ht);
}

function renderHirePreview(ht){
  const items = getHireChecklistItems(ht);
  document.getElementById('ob-preview-count').textContent = `（${items.length}項目）`;
  const el = document.getElementById('ob-preview-list');
  el.innerHTML = items.length===0
    ? `<div style="font-size:11px;color:var(--text3)">項目がありません。マスタ管理から登録してください</div>`
    : items.map(it=>{
        const imp = it.importance==='must'
          ? `<span style="font-size:9px;padding:0 5px;border-radius:6px;background:var(--red-light);color:var(--red);font-weight:700;flex-shrink:0">必須</span>`
          : it.importance==='recommend'
          ? `<span style="font-size:9px;padding:0 5px;border-radius:6px;background:var(--yellow-light);color:var(--yellow);font-weight:700;flex-shrink:0">推奨</span>` : '';
        return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;color:var(--text)">${imp}<span>${escHtml(it.title)}</span></div>`;
      }).join('');
}

function saveOnboardingPerson(){
  const name = document.getElementById('ob-name').value.trim();
  if(!name){ toast('⚠ 氏名を入力してください',true); return; }
  const type = document.getElementById('ob-type').value;
  const rec = {
    id: 'ob'+Date.now(),
    type,
    name,
    dept:  document.getElementById('ob-dept').value.trim(),
    date:  document.getElementById('ob-date').value,
    checks:{},
    open:  true,
  };
  if(type==='join') rec.hireType = document.getElementById('ob-hire-type').value || 'shinsotsu';
  onboardingPersons.push(rec);
  saveOnboardingPersons(); closeOnboardingPersonModal(); renderOnboarding();
  const tag = type==='join' ? `（${HIRE_TYPE_LABELS[rec.hireType]||''}）` : '';
  toast(`✅ ${name}${tag}のチェックリストを作成しました`);
}

function createOnboardingTasksForPerson(id){
  const p = onboardingPersons.find(x=>x.id===id);
  if(!p) return;
  // 入社者は新卒/中途のマスタ、退職者は従来マスタを使用
  const items = (p.type==='join')
    ? getMasterItems(p.hireType || 'chuto')
    : getMasterItems('taishoku');
  const label = p.type==='join'?'入社':'退職';
  const hireLabel = (p.type==='join') ? (HIRE_TYPE_LABELS[p.hireType]||'') : '';
  const due = p.date || `${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}`;
  items.forEach((it,i)=>{
    const t = typeof it==='object' ? it : {title:it};
    const prefix  = hireLabel ? `【${label}・${hireLabel}】` : `【${label}】`;
    // 対象者名はタスク名に既に含まれているため重複表示しない。日付（基準日）のみ残す
    const baseNote = `${p.date?'基準日：'+p.date:''}${t.desc?(p.date?'\n':'')+t.desc:''}`;
    const { title, note } = safeTitleAndNote(`${prefix}${p.name} / ${t.title}`, baseNote);
    tasks.push({
      id:Date.now()+i, title,
      cat:'nyutai', due, status:'todo',
      hireType: p.type==='join' ? (p.hireType||'chuto') : '',   // ← 一覧バッジ・絞り込み用
      assignee:currentUser?.id||'', approver:'', remind:'3',
      note,
      rep:'', comments:[], files:[], subtasks:[],
    });
  });
  saveTasks(); renderTasks(); renderStats();
  if(isGasEnabled()) syncData(true, true);
  const tag = hireLabel?`（${hireLabel}）`:'';
  logActivity('created', {id:'bulk-ob-'+p.id, title:`${p.name}${tag}の${label}手続きチェックリスト`, cat:'nyutai'}, `チェックリストから${items.length}件のタスクを一括作成`);
  toast(`✅ ${p.name}${tag}の${label}手続き ${items.length}件をタスクに追加しました`);
}

function createOnboardingTasks(type){
  createOnboardingTasksForPerson({id:'_tmp',type,name:'',date:'',checks:{}});
}

function resetOnboarding(key){ if(!confirm('リセットしますか?'))return; delete onboardingState[key]; saveOnboardingState();renderOnboarding(); }

function toggleOnboarding(key,idx,checked){ if(!onboardingState[key])onboardingState[key]={}; onboardingState[key][idx]=checked; saveOnboardingState();renderOnboarding(); }

function renderProgress(){
  const el=document.getElementById('progress-area');
  if(!el)return;
  const m=`${T.getFullYear()}-${pad(T.getMonth()+1)}`;
  const cats=[{k:'kyuyo',l:'給与計算'},{k:'sankyuiku',l:'産休・育休・休職'},{k:'nyutai',l:'入社・退職'},{k:'other',l:'その他'}];
  el.innerHTML=cats.map(({k,l})=>{
    const a=tasks.filter(t=>t.cat===k&&t.due&&t.due.startsWith(m));
    const done=a.filter(t=>t.status==='done');
    const p=a.length?Math.round(done.length/a.length*100):0;
    if(!a.length)return'';
    return `<div class="prog-row"><span style="color:var(--text2)">${l}</span><span style="font-family:var(--mono)">${done.length}/${a.length}</span></div><div class="prog-bar"><div class="prog-fill" style="width:${p}%"></div></div>`;
  }).join('');
}

function renderMemberStats(){
  const el=document.getElementById('member-stats');
  if(!el)return;
  el.innerHTML=MEMBERS.map(m=>{
    const my=tasks.filter(t=>t.assignee===m.id&&t.status!=='done');
    const done=tasks.filter(t=>t.assignee===m.id&&t.status==='done');
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div class="member-avatar" style="background:${m.color};width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">${m.initial}</div>
      <div style="flex:1;font-size:11px;font-weight:600">${m.name}</div>
      <span style="font-size:10px;font-family:var(--mono);color:var(--text2)">未完了 ${my.length}　完了 ${done.length}</span>
    </div>`;
  }).join('');
}
