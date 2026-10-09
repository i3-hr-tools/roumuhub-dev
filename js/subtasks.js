// ══ 子タスク(サブタスク)管理 ══

function toggleSubInDetail(taskId, subId, checked){
  const t = tasks.find(x=>x.id===taskId);
  if(!t) return;
  const s = (t.subtasks||[]).find(x=>x.id===subId);
  if(s){ s.status = checked?'done':'todo'; }
  saveTasks(); renderTasks(); renderStats();
  showTaskDetail(taskId); // 詳細を更新
  if(isGasEnabled()) syncData(true, true);
}

function stRowHTML(parentId,s){
  const member=MEMBERS.find(m=>m.id===s.assignee);
  const stChkHtml = `<input type="checkbox" class="st-bulk-chk" data-parent="${parentId}" data-sub="${s.id}"
    onclick="event.stopPropagation();updateStBulkBar('${parentId}')"
    style="margin-top:3px;width:14px;height:14px;accent-color:var(--accent);flex-shrink:0;cursor:pointer">`;
  const ts=fmt(T);
  const dc=s.due&&s.status!=='done'?(s.due<ts?'overdue':s.due===ts?'today-due':Math.floor((new Date(s.due)-T)/86400000)<=3?'soon':''):'';
  const urlHTML=s.url?`<a href="${s.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="font-size:10px;color:var(--accent);text-decoration:none;display:flex;align-items:center;gap:2px">🔗 ${s.urlLabel||'リンク'}</a>`:'';
  return `<div class="st-row${s.status==='done'?' done-row':''}" id="strow-${parentId}-${s.id}"
    ondblclick="openSubtaskModal(event,'${parentId}','${s.id}')"
    data-sub-id="${s.id}" data-parent-id="${parentId}"
    draggable="true"
    ondragstart="stDragStart(event,${parentId},'${s.id}')"
    ondragover="stDragOver(event)"
    ondragleave="stDragLeave(event)"
    ondrop="stDrop(event,${parentId},'${s.id}')"
    ondragend="stDragEnd(event)"
    onclick="event.stopPropagation()">
    <!-- メイン行 -->
    <div class="st-row-main">
      ${stChkHtml}
      <div class="st-handle" title="ドラッグで並び替え">⠿</div>
      <input type="checkbox" ${s.status==='done'?'checked':''} onchange="toggleSubtaskDone(${parentId},'${s.id}')" style="width:16px;height:16px;accent-color:var(--green);cursor:pointer;flex-shrink:0" title="完了にする">
      <div style="flex:1;min-width:0">
        <div id="st-title-wrap-${parentId}-${s.id}" class="st-name" ondblclick="startStInlineEdit(event,${parentId},'${s.id}')" title="ダブルクリックでタイトル編集" style="cursor:text">${escHtml(s.title)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:3px;align-items:center">
          ${member?`<span style="font-size:10px;color:var(--text2);display:flex;align-items:center;gap:3px"><span style="width:7px;height:7px;border-radius:50%;background:${member.color};display:inline-block"></span>${member.name}</span>`:''}
          ${s.due?`<span class="due-label ${dc}" style="font-size:10px">📅 ${s.due.replace(/-/g,'/')}</span>`:''}
          ${bizDayBadge(s.due, s.status==='done')}
          ${urlHTML}
          ${s.note?`<span style="font-size:10px;color:var(--text3)">📝 ${s.note.slice(0,20)}${s.note&&s.note.length>20?'…':''}</span>`:''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:3px;flex-shrink:0">
        <select class="form-input" style="padding:2px 5px;font-size:10px;width:auto;height:auto;border-radius:5px" onchange="changeSubtaskStatus(${parentId},'${s.id}',this.value)">
          <option value="todo" ${s.status==='todo'?'selected':''}>未着手</option>
          <option value="inprogress" ${s.status==='inprogress'?'selected':''}>進行中</option>
          <option value="done" ${s.status==='done'?'selected':''}>完了</option>
        </select>
        <button onclick="stQuickEditToggle(event,${parentId},'${s.id}')" style="background:none;border:none;color:var(--text2);cursor:pointer;padding:2px 5px;border-radius:4px;font-size:11px" title="クイック編集">⚡</button>
        <button onclick="copySubtask(event,${parentId},'${s.id}')" style="background:none;border:none;color:var(--text2);cursor:pointer;padding:2px 5px;border-radius:4px;font-size:11px" title="コピー">📋</button>
        <button onclick="openSubtaskModal(event,${parentId},'${s.id}')" style="background:none;border:none;color:var(--text2);cursor:pointer;padding:2px 5px;border-radius:4px;font-size:11px" title="詳細編集">✏️</button>
        <button onclick="deleteSubtask(event,${parentId},'${s.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px 4px;border-radius:3px;font-size:11px" title="削除">✕</button>
      </div>
    </div>
    <!-- クイック編集バー -->
    <div class="st-qe-bar" id="st-qe-${parentId}-${s.id}">
      <div><span class="st-qe-label">期限日</span><input class="st-qe-input" id="stqe-due-${parentId}-${s.id}" type="datetime-local" value="${(s.due&&s.due.length>=16)?s.due.slice(0,16):''}" style="width:130px"></div>
      <div><span class="st-qe-label">担当者</span>
        <select class="st-qe-input" id="stqe-assignee-${parentId}-${s.id}" style="width:110px">
          <option value="">未割り当て</option>
          ${MEMBERS.map(m=>`<option value="${escHtml(m.id)}" ${s.assignee===m.id?'selected':''}>${escHtml(m.name)}</option>`).join('')}
        </select>
      </div>
      <div><span class="st-qe-label">メモ</span><input class="st-qe-input" id="stqe-note-${parentId}-${s.id}" value="${(s.note||'').replace(/"/g,'&quot;')}" placeholder="メモ" style="width:150px"></div>
      <button class="qe-save" style="font-size:11px;padding:5px 12px" onclick="saveStQuickEdit(${parentId},'${s.id}')">保存</button>
      <button class="qe-cancel" style="font-size:11px;padding:5px 9px" onclick="stQuickEditToggle(event,${parentId},'${s.id}')">✕</button>
    </div>
  </div>`;
}

function _findParentTask(parentId){
  let t = tasks.find(t=>String(t.id)===String(parentId));
  let isPriv = false;
  let privArr = [];
  if(!t){
    privArr = getPrivateTasks();
    t = privArr.find(t=>String(t.id)===String(parentId));
    isPriv = true;
  }
  return {t, isPriv, privArr};
}

function _saveParentTask(isPriv, privArr){
  if(isPriv){ savePrivateTasks(privArr); } else { saveTasks(); }
}

function quickAddSubtask(parentId){
  const inp=document.getElementById('st-inp-'+parentId);
  if(!inp)return;
  const title=inp.value.trim();
  if(!title){inp.focus();return;}
  // チームタスク・個人タスク両方からString型で検索
  let t=tasks.find(t=>String(t.id)===String(parentId));
  let isPriv=false;
  let priv=[];
  if(!t){
    priv=getPrivateTasks();
    t=priv.find(t=>String(t.id)===String(parentId));
    isPriv=true;
  }
  if(!t)return;
  if(!t.subtasks)t.subtasks=[];
  t.subtasks.push({id:'s'+Date.now(),title,assignee:currentUser?.id||'',due:'',status:'todo'});
  if(isPriv){savePrivateTasks(priv);}else{saveTasks();}
  rerenderInlineSubtasks(parentId);
  inp.value='';inp.focus();
  renderStats();renderCatTabCounts();
  toast('✅ 子タスクを追加しました');
}

function updateStBulkBar(parentId){
  const checked = document.querySelectorAll(`.st-bulk-chk[data-parent="${parentId}"]:checked`);
  const bar = document.getElementById(`st-bulk-bar-${parentId}`);
  const countEl = document.getElementById(`st-bulk-count-${parentId}`);
  if(!bar) return;
  if(checked.length > 0){
    bar.style.display = 'flex';
    if(countEl) countEl.textContent = `${checked.length}件選択中`;
  } else {
    bar.style.display = 'none';
  }
  // 全選択ボタンのテキストを更新
  const total = document.querySelectorAll(`.st-bulk-chk[data-parent="${parentId}"]`).length;
  const allBtn = document.getElementById(`st-sel-all-${parentId}`);
  if(allBtn) allBtn.textContent = checked.length === total && total > 0 ? '全解除' : '全選択';
}

function toggleStSelectAll(parentId){
  const all = document.querySelectorAll(`.st-bulk-chk[data-parent="${parentId}"]`);
  const checked = document.querySelectorAll(`.st-bulk-chk[data-parent="${parentId}"]:checked`);
  const shouldCheck = checked.length < all.length;
  all.forEach(chk => {
    chk.checked = shouldCheck;
  });
  updateStBulkBar(parentId);
}

function stBulkComplete(parentId){
  const checked = [...document.querySelectorAll(`.st-bulk-chk[data-parent="${parentId}"]:checked`)];
  if(!checked.length) return;
  const {t, isPriv, privArr} = _findParentTask(parentId);
  if(!t || !t.subtasks) return;
  checked.forEach(chk => {
    const s = t.subtasks.find(s => String(s.id) === String(chk.dataset.sub));
    if(s){ s.status = 'done'; s.completedAt = fmt(T); }
  });
  _saveParentTask(isPriv, privArr);
  rerenderInlineSubtasks(parentId);
  stBulkClear(parentId);
  renderStats(); renderCatTabCounts();
  toast(`✅ ${checked.length}件を完了にしました`);
}

function stBulkSetDue(parentId){
  const checked = [...document.querySelectorAll(`.st-bulk-chk[data-parent="${parentId}"]:checked`)];
  if(!checked.length) return;
  const due = prompt('期限日時を入力してください（例：2026-08-31T17:00）');
  if(!due) return;
  const {t, isPriv, privArr} = _findParentTask(parentId);
  if(!t || !t.subtasks) return;
  checked.forEach(chk => {
    const s = t.subtasks.find(s => String(s.id) === String(chk.dataset.sub));
    if(s) s.due = due;
  });
  _saveParentTask(isPriv, privArr);
  rerenderInlineSubtasks(parentId);
  stBulkClear(parentId);
  toast(`📅 ${checked.length}件の期限を設定しました`);
}

function stBulkDelete(parentId){
  const checked = [...document.querySelectorAll(`.st-bulk-chk[data-parent="${parentId}"]:checked`)];
  if(!checked.length) return;
  if(!confirm(`${checked.length}件の子タスクを削除しますか？`)) return;
  const {t, isPriv, privArr} = _findParentTask(parentId);
  if(!t || !t.subtasks) return;
  const ids = checked.map(chk => String(chk.dataset.sub));
  t.subtasks = t.subtasks.filter(s => !ids.includes(String(s.id)));
  _saveParentTask(isPriv, privArr);
  rerenderInlineSubtasks(parentId);
  renderStats(); renderCatTabCounts();
  toast(`🗑 ${checked.length}件を削除しました`);
}

function stBulkClear(parentId){
  document.querySelectorAll(`.st-bulk-chk[data-parent="${parentId}"]`).forEach(chk => chk.checked = false);
  updateStBulkBar(parentId);
}

function rerenderInlineSubtasks(parentId){
  let t=tasks.find(t=>String(t.id)===String(parentId));
  if(!t){ const priv=getPrivateTasks(); t=priv.find(t=>String(t.id)===String(parentId)); }
  if(!t)return;
  const subs=t.subtasks||[];
  const doneCount=subs.filter(s=>s.status==='done').length;
  const pct=subs.length?Math.round(doneCount/subs.length*100):0;
  const listEl=document.getElementById('st-list-'+parentId);
  if(listEl)listEl.innerHTML=subs.map(s=>stRowHTML(parentId,s)).join('');
  const pfEl=document.getElementById('stpf-'+parentId);
  if(pfEl)pfEl.style.width=`${pct}%`;
  // バッジ更新のためrenderTasksを呼ぶが展開状態を維持
  renderTasks();
  setTimeout(()=>{
    const card=document.getElementById('card-'+parentId);
    if(card){
      card.classList.add('expanded');
      const arrow=document.getElementById('arrow-'+parentId);
      if(arrow)arrow.style.transform='rotate(90deg)';
    }
  },30);
}

function stDragStart(e, parentId, subId){
  dragParentId=parentId; dragSubId=subId;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain', subId);
  setTimeout(()=>e.target.classList.add('dragging'),0);
}

function stDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  const row=e.currentTarget;
  if(row.dataset.subId!==dragSubId) row.classList.add('drag-over');
}

function stDragLeave(e){
  e.currentTarget.classList.remove('drag-over');
}

function stDrop(e, parentId, targetSubId){
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if(dragSubId===targetSubId||dragParentId!==parentId) return;
  const t=tasks.find(t=>String(t.id)===String(parentId));if(!t||!t.subtasks)return;
  const fromIdx=t.subtasks.findIndex(s=>s.id===dragSubId);
  const toIdx=t.subtasks.findIndex(s=>s.id===targetSubId);
  if(fromIdx===-1||toIdx===-1)return;
  // 入れ替え
  const [moved]=t.subtasks.splice(fromIdx,1);
  t.subtasks.splice(toIdx,0,moved);
  saveTasks();
  rerenderInlineSubtasks(parentId);
}

function stDragEnd(e){
  e.target.classList.remove('dragging');
  document.querySelectorAll('.st-row').forEach(r=>r.classList.remove('drag-over','dragging'));
  dragSubId=null; dragParentId=null;
}

function openSubtaskModal(e,parentId,subtaskId){
  e.stopPropagation();
  const {t}=_findParentTask(parentId);if(!t)return;
  const s=subtaskId?t.subtasks?.find(s=>String(s.id)===String(subtaskId)):null;
  // 担当者select更新
  const sel=document.getElementById('st-assignee');
  sel.innerHTML='<option value="">未割り当て</option>'+MEMBERS.map(m=>`<option value="${escHtml(m.id)}">${escHtml(m.name)}</option>`).join('');
  document.getElementById('st-parent-id').value=parentId;
  document.getElementById('st-sub-id').value=subtaskId||'';
  if(s){
    document.getElementById('st-modal-title').textContent='子タスクを編集';
    document.getElementById('st-title').value=s.title||'';
    document.getElementById('st-assignee').value=s.assignee||'';
    document.getElementById('st-status').value=s.status||'todo';
    document.getElementById('st-due').value=s.due||'';
    document.getElementById('st-url').value=s.url||'';
    document.getElementById('st-url-label').value=s.urlLabel||'';
    document.getElementById('st-note').value=s.note||'';
  } else {
    document.getElementById('st-modal-title').textContent='子タスクを追加';
    ['st-title','st-due','st-url','st-url-label','st-note','st-due-bizday'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const stPrev=document.getElementById('st-bizday-preview');if(stPrev)stPrev.textContent='';
    document.getElementById('st-assignee').value=currentUser?.id||'';
    document.getElementById('st-status').value='todo';
  }
  document.getElementById('subtask-modal-overlay').classList.add('open');
}

function stBizdayPreview(){
  const n = parseInt(document.getElementById('st-due-bizday')?.value);
  const preview = document.getElementById('st-bizday-preview');
  if(!preview) return;
  if(!n || n < 1){ preview.textContent=''; return; }
  const result = getNthBusinessDayOfMonth(n);
  const y = result.getFullYear();
  const mo = String(result.getMonth()+1).padStart(2,'0');
  const d = String(result.getDate()).padStart(2,'0');
  const dow = ['日','月','火','水','木','金','土'][result.getDay()];
  const now = new Date();
  preview.textContent = `→ ${now.getMonth()+1}月の第${n}営業日：${y}/${mo}/${d}（${dow}）`;
}

function applyStBizDay(){
  const n = parseInt(document.getElementById('st-due-bizday')?.value);
  if(!n || n < 1){ toast('⚠ 営業日数を入力してください', true); return; }
  const result = getNthBusinessDayOfMonth(n);
  const y = result.getFullYear();
  const m = String(result.getMonth()+1).padStart(2,'0');
  const d = String(result.getDate()).padStart(2,'0');
  const dueEl = document.getElementById('st-due');
  if(dueEl) dueEl.value = `${y}-${m}-${d}T17:00`;
  const dow = ['日','月','火','水','木','金','土'][result.getDay()];
  const preview = document.getElementById('st-bizday-preview');
  const now = new Date();
  if(preview) preview.textContent = `✅ ${now.getMonth()+1}月の第${n}営業日（${y}/${m}/${d} ${dow}）を設定しました`;
  document.getElementById('st-due-bizday').value = '';
  toast(`📅 ${now.getMonth()+1}月の第${n}営業日（${y}/${m}/${d}）を期限日に設定しました`);
}

function saveSubtaskDetail(){
  const title=document.getElementById('st-title').value.trim();
  if(!title){toast('⚠ 子タスク名を入力してください',true);return;}
  const parentId=String(document.getElementById('st-parent-id').value);
  const subtaskId=document.getElementById('st-sub-id').value;
  const {t,isPriv,privArr}=_findParentTask(parentId);if(!t)return;
  if(!t.subtasks)t.subtasks=[];
  const vals={
    title,
    assignee:document.getElementById('st-assignee').value,
    status:document.getElementById('st-status').value,
    start:'',
    due:document.getElementById('st-due').value,
    url:document.getElementById('st-url').value.trim(),
    urlLabel:document.getElementById('st-url-label').value.trim(),
    note:document.getElementById('st-note').value.trim(),
  };
  if(subtaskId){
    const s=t.subtasks.find(s=>String(s.id)===String(subtaskId));
    if(s)Object.assign(s,vals);
  } else {
    t.subtasks.push({id:'s'+Date.now(),...vals});
  }
  checkParentAutoComplete(t);
  _saveParentTask(isPriv, privArr);
  closeModal('subtask-modal-overlay');
  rerenderInlineSubtasks(parentId);
  renderStats();renderCatTabCounts();
  toast('💾 保存しました');
  if(isGasEnabled()) immediateSync();
}

function switchPanelTab(tab){
  const dash=document.getElementById('ptab-dash');
  const sub=document.getElementById('ptab-sub');
  const panelDash=document.getElementById('panel-dash');
  const panelSub=document.getElementById('panel-sub');
  if(dash)dash.classList.toggle('active',tab==='dash');
  if(sub)sub.classList.toggle('active',tab==='sub');
  if(panelDash)panelDash.style.display=tab==='dash'?'':'none';
  if(panelSub)panelSub.style.display=tab==='sub'?'flex':'none';
}

function openSubPanel(e,parentId){
  e.stopPropagation();
  currentSubParentId=parentId;
  switchPanelTab('sub');
  renderSubPanel();
  // 担当者select更新
  const sel=document.getElementById('sp-assignee');
  if(sel)sel.innerHTML='<option value="">担当者未設定</option>'+MEMBERS.map(m=>`<option value="${escHtml(m.id)}">${escHtml(m.name)}</option>`).join('');
  const dueEl=document.getElementById('sp-due');
  if(dueEl&&!dueEl.value)dueEl.value=fmt(T);
  setTimeout(()=>document.getElementById('sp-title')?.focus(),100);
}

function renderSubPanel(){
  // 子タスクパネルが存在しない場合はスキップ
  if(!document.getElementById('sub-list-area')) return;
  const t=tasks.find(t=>String(t.id)===String(currentSubParentId));
  if(!t){
    const titleEl=document.getElementById('sub-parent-title');
    const listEl=document.getElementById('sub-list-area');
    if(titleEl)titleEl.textContent='—';
    if(listEl)listEl.innerHTML='<div class="empty-state" style="padding:24px 12px"><div class="icon">📎</div>親タスクを選択してください</div>';
    return;
  }
  // 親タスク情報
  const titleEl=document.getElementById('sub-parent-title');
  if(titleEl)titleEl.textContent=t.title;
  const member=MEMBERS.find(m=>m.id===t.assignee);
  const stCls={todo:'tag-todo',inprogress:'tag-inprogress',done:'tag-done'}[t.status]||'tag-todo';
  const metaEl=document.getElementById('sub-parent-meta');
  if(metaEl)metaEl.innerHTML=`
    <span class="tag ${stCls}">${STATUS_LABELS[t.status]}</span>
    <span class="tag tag-cat">${CAT_LABELS[t.cat]||t.cat}</span>
    ${t.due?`<span style="font-size:11px;font-family:var(--mono);color:var(--text3)">📅 ${t.due.replace(/-/g,'/')}</span>`:''}
    ${member?`<span style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${member.color};display:inline-block"></span>${member.name}</span>`:''}
  `;
  // 進捗バー
  const subs=t.subtasks||[];
  const done=subs.filter(s=>s.status==='done').length;
  const pct=subs.length?Math.round(done/subs.length*100):0;
  const progLabel=document.getElementById('sub-prog-label');
  const progBar=document.getElementById('sub-prog-bar');
  const tabCount=document.getElementById('ptab-sub-count');
  if(progLabel)progLabel.textContent=`${done} / ${subs.length}`;
  if(progBar)progBar.style.width=`${pct}%`;
  if(tabCount)tabCount.textContent=subs.length;
  // 子タスク一覧
  const area=document.getElementById('sub-list-area');
  if(!area)return;
  if(!subs.length){
    area.innerHTML='<div class="empty-state" style="padding:24px 12px"><div class="icon">📋</div>子タスクはまだありません<br><span style="font-size:11px">下のフォームから追加してください</span></div>';
    return;
  }
  const groups=[{key:'todo',label:'未着手',icon:'⬜'},{key:'inprogress',label:'進行中',icon:'🔄'},{key:'done',label:'完了',icon:'✅'}];
  area.innerHTML=groups.map(g=>{
    const items=subs.filter(s=>s.status===g.key);
    if(!items.length)return'';
    return `<div style="margin-bottom:14px">
      <div style="font-size:10px;font-family:var(--mono);font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;padding-left:2px">${g.icon} ${g.label}（${items.length}）</div>
      ${items.map(s=>subPanelItemHTML(t.id,s)).join('')}
    </div>`;
  }).join('');
}

function subPanelItemHTML(parentId,s){
  const member=MEMBERS.find(m=>m.id===s.assignee);
  const stChkHtml = `<input type="checkbox" class="st-bulk-chk" data-parent="${parentId}" data-sub="${s.id}"
    onclick="event.stopPropagation();updateStBulkBar('${parentId}')"
    style="margin-top:3px;width:14px;height:14px;accent-color:var(--accent);flex-shrink:0;cursor:pointer">`;
  const ts=fmt(T);
  const dueCls=s.due&&s.status!=='done'?(s.due<ts?'overdue':s.due===ts?'today-due':Math.floor((new Date(s.due)-T)/86400000)<=3?'soon':''):'';
  const isDone=s.status==='done';
  return `<div class="sp-item${isDone?' done':''}">
    <div class="sp-check${isDone?' done':s.status==='inprogress'?' inprogress':''}" onclick="toggleSubtaskDone(${parentId},'${s.id}')"></div>
    <div class="sp-body">
      <div class="sp-title">${escHtml(s.title)}</div>
      <div class="sp-meta">
        ${member?`<span style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${member.color};display:inline-block"></span>${member.name}</span>`:''}
        ${s.due?`<span class="due-label ${dueCls}" style="font-size:11px">📅 ${s.due.replace(/-/g,'/')}</span>`:''}
        <select class="form-input" style="padding:2px 7px;font-size:11px;width:auto;height:auto;border-radius:5px" onchange="changeSubtaskStatus(${parentId},'${s.id}',this.value)">
          <option value="todo" ${s.status==='todo'?'selected':''}>未着手</option>
          <option value="inprogress" ${s.status==='inprogress'?'selected':''}>進行中</option>
          <option value="done" ${s.status==='done'?'selected':''}>完了</option>
        </select>
      </div>
    </div>
    <button class="sp-del" onclick="deleteSubtask(event,${parentId},'${s.id}')">🗑</button>
  </div>`;
}

function addSubtaskFromPanel(){
  if(!currentSubParentId){toast('⚠ 親タスクが選択されていません',true);return;}
  const t=tasks.find(t=>String(t.id)===String(currentSubParentId));if(!t)return;
  const title=document.getElementById('sp-title').value.trim();
  if(!title){toast('⚠ 子タスク名を入力してください',true);return;}
  if(!t.subtasks)t.subtasks=[];
  t.subtasks.push({
    id:'s'+Date.now(),title,
    assignee:document.getElementById('sp-assignee').value,
    due:document.getElementById('sp-due').value,
    status:document.getElementById('sp-status').value,
  });
  saveTasks();
  document.getElementById('sp-title').value='';
  document.getElementById('sp-status').value='todo';
  renderSubPanel();renderTasks();renderStats();renderCatTabCounts();
  toast('✅ 子タスクを追加しました');
  document.getElementById('sp-title')?.focus();
}

function toggleSubtaskDone(parentId,subtaskId){
  const {t,isPriv,privArr}=_findParentTask(parentId);if(!t||!t.subtasks)return;
  const s=t.subtasks.find(s=>String(s.id)===String(subtaskId));if(!s)return;
  s.status=s.status==='done'?'todo':'done';
  checkParentAutoComplete(t);
  // 展開中のカードIDを保持
  const expandedIds=new Set([...document.querySelectorAll('.task-card.expanded')].map(el=>parseInt(el.id.replace('card-',''))));
  saveTasks();renderSubPanel();renderTasks();renderStats();renderCatTabCounts();
  // 展開状態を復元
  expandedIds.forEach(id=>{
    const card=document.getElementById('card-'+id);
    if(card&&!card.classList.contains('expanded')){
      card.classList.add('expanded');
      const arrow=document.getElementById('arrow-'+id);
      if(arrow)arrow.style.transform='rotate(90deg)';
    }
  });
}

function changeSubtaskStatus(parentId,subtaskId,status){
  const {t,isPriv,privArr}=_findParentTask(parentId);if(!t||!t.subtasks)return;
  const s=t.subtasks.find(s=>String(s.id)===String(subtaskId));if(!s)return;
  s.status=status;
  checkParentAutoComplete(t);
  saveTasks();renderSubPanel();renderTasks();renderStats();renderCatTabCounts();
}

function deleteSubtask(e,parentId,subtaskId){
  e.stopPropagation();
  const {t,isPriv,privArr}=_findParentTask(parentId);if(!t||!t.subtasks)return;
  t.subtasks=t.subtasks.filter(s=>String(s.id)!==String(subtaskId));
  saveTasks();renderSubPanel();renderTasks();toast('🗑 削除しました');
}

function checkParentAutoComplete(t){
  if(!t.subtasks||!t.subtasks.length) return;
  // 承認待ち・完了は手動管理（自動変更しない）
  if(t.status==='review') return;
  const doneCount = t.subtasks.filter(s=>s.status==='done').length;
  if(doneCount === t.subtasks.length){
    // 全完了 → 完了
    if(t.status !== 'done'){
      t.status = 'done';
      t.completedAt = new Date().toISOString().split('T')[0];
      toast(`✅「${t.title}」の子タスクがすべて完了 → 自動完了しました`);
    }
  } else if(doneCount > 0){
    // 1件以上完了 → 進行中（未着手のときのみ）
    if(t.status === 'todo') t.status = 'inprogress';
  } else {
    // 全て未完了に戻ったら未着手に戻す
    if(t.status === 'inprogress') t.status = 'todo';
  }
}

function startStInlineEdit(e,parentId,subId){
  e.stopPropagation();
  const wrap=document.getElementById(`st-title-wrap-${parentId}-${subId}`);
  if(!wrap)return;
  const t=tasks.find(t=>String(t.id)===String(parentId));if(!t||!t.subtasks)return;
  const s=t.subtasks.find(s=>s.id===subId);if(!s)return;
  const input=document.createElement('input');
  input.className='st-name-input';
  input.value=s.title;
  wrap.replaceWith(input);
  input.focus();input.select();
  const finish=(save)=>{
    const newTitle=input.value.trim();
    if(save&&newTitle&&newTitle!==s.title){s.title=newTitle;saveTasks();toast('✏️ タイトルを更新しました');}
    rerenderInlineSubtasks(parentId);
  };
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();finish(true);}
    if(e.key==='Escape'){finish(false);}
    e.stopPropagation();
  });
  input.addEventListener('blur',()=>finish(true));
  input.addEventListener('click',e=>e.stopPropagation());
}

function stQuickEditToggle(e,parentId,subId){
  if(e) e.stopPropagation();
  const row=document.getElementById(`strow-${parentId}-${subId}`);
  if(!row)return;
  row.classList.toggle('st-qe-open');
  if(row.classList.contains('st-qe-open')){
    setTimeout(()=>document.getElementById(`stqe-due-${parentId}-${subId}`)?.focus(),50);
  }
}

function saveStQuickEdit(parentId,subId){
  const {t,isPriv,privArr}=_findParentTask(parentId);if(!t||!t.subtasks)return;
  const s=t.subtasks.find(s=>String(s.id)===String(subId));if(!s)return;
  s.start='';
  s.due=document.getElementById(`stqe-due-${parentId}-${subId}`)?.value||'';
  s.assignee=document.getElementById(`stqe-assignee-${parentId}-${subId}`)?.value||'';
  s.note=document.getElementById(`stqe-note-${parentId}-${subId}`)?.value||'';
  _saveParentTask(isPriv,privArr);rerenderInlineSubtasks(parentId);toast('💾 子タスクを更新しました');
}

function copySubtask(e,parentId,subId){
  e.stopPropagation();
  const {t,isPriv,privArr}=_findParentTask(parentId);if(!t||!t.subtasks)return;
  const s=t.subtasks.find(s=>String(s.id)===String(subId));if(!s)return;
  stClipboard={...s};
  const row=document.getElementById(`strow-${parentId}-${subId}`);
  if(row){row.classList.add('st-copied');setTimeout(()=>row.classList.remove('st-copied'),400);}
  toast('📋 子タスクをコピーしました（展開中の親タスクへCtrl+Vでペースト）');
}

function pasteSubtask(parentId){
  if(!stClipboard)return;
  const t=tasks.find(t=>String(t.id)===String(parentId));if(!t)return;
  if(!t.subtasks)t.subtasks=[];
  t.subtasks.push({...stClipboard,id:'s'+Date.now(),title:stClipboard.title+' (コピー)'});
  saveTasks();rerenderInlineSubtasks(parentId);toast('📋 子タスクをペーストしました');
}
