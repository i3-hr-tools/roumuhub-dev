// ══ タスク管理（CRUD・表示・検索・CSV） ══

function renderTodayTasks(){
  const ts=fmt(T);
  const list=tasks.filter(t=>t.status!=='done'&&t.due&&t.due.startsWith(ts));
  const el=document.getElementById('today-tasks-list');
  const badge=document.getElementById('today-tasks-count');
  if(!el)return;
  if(badge)badge.textContent=list.length?`${list.length}件`:'';
  if(!list.length){
    el.innerHTML='<div style="font-size:11px;color:var(--text3)">今日期限のタスクなし ✓</div>';
    return;
  }
  el.innerHTML=list.map(t=>{
    const member=MEMBERS.find(m=>m.id===t.assignee);
    return `<div style="padding:6px 8px;border-radius:6px;background:#fff;border:1px solid var(--border);margin-bottom:4px;cursor:pointer;transition:all .12s"
      onclick="highlightTask(${t.id})"
      onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="font-size:11px;font-weight:600;color:var(--text);line-height:1.3;margin-bottom:2px">${escHtml(t.title)}</div>
      <div style="display:flex;align-items:center;gap:5px">
        ${member?`<span style="font-size:10px;color:var(--text2);display:flex;align-items:center;gap:3px"><span style="width:6px;height:6px;border-radius:50%;background:${escHtml(member.color)};display:inline-block"></span>${escHtml(member.name)}</span>`:''}
        <span class="tag tag-${t.status}" style="font-size:9px">${escHtml(STATUS_LABELS[t.status])}</span>
      </div>
    </div>`;
  }).join('');
}

function highlightTask(id){
  const allTab=document.querySelector('.cat-tab');
  if(allTab)setMajorCat('all',allTab);
  setTimeout(()=>{
    const card=document.getElementById('card-'+id);
    if(card){
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.style.outline='2px solid var(--red)';
      setTimeout(()=>card.style.outline='',1500);
    }
  },120);
}

function focusTask(id){
  showTaskDetail(id);
}

function setMajorCat(cat,el){
  majorCat=cat;
  filt='all'; statusFilt='all';
  document.querySelectorAll('.cat-tab,.cat-tab-sub').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');

  const isNews=(cat==='news');
  const isLinks=(cat==='links');
  const isDocs=(cat==='docs');
  const isAdmin=(cat==='admin');
  const isArchive=(cat==='archive');
  const isMain=(!isNews&&!isLinks&&!isDocs&&!isAdmin&&cat!=='annual'&&!isArchive);

  document.getElementById('main-panel').style.display=isMain?'':'none';
  document.getElementById('news-panel').style.display=isNews?'flex':'none';
  document.getElementById('links-panel').style.display=isLinks?'flex':'none';
  document.getElementById('docs-panel').style.display=isDocs?'flex':'none';
  document.getElementById('admin-panel').style.display=isAdmin?'flex':'none';
  const archivePanel=document.getElementById('archive-panel');
  if(archivePanel) archivePanel.style.display=isArchive?'flex':'none';
  // layoutグリッド（サイドバー・メイン・右パネル）はメイン表示時のみ表示
  const layout=document.querySelector('.layout');
  if(layout)layout.style.display=isMain?'grid':'none';
  const rp=document.querySelector('.right-panel');
  if(rp)rp.style.display=isMain?'':'none';

  if(isNews){if(!newsLoaded)loadNews();}
  else if(isLinks){renderLinks();}
  else if(isDocs){renderDocList();renderDocTagFilter();}
  else if(isAdmin){
    renderMembersPanel();
    renderLogStats();
    const badge=document.getElementById('mc-admin');
    if(badge)badge.textContent=approvalLogs.length;
    switchAdminTab('members');
  }
  else{
    renderTasks();renderStats();
    if(cat==='sankyuiku') { renderLeaveGantt(); renderLeaveChecklist(); }
    const clEl = document.getElementById('leave-checklist-area');
    if(clEl) clEl.style.display = cat==='sankyuiku' ? 'block' : 'none';
    if(cat==='nyutai') renderOnboarding();
    const onbEl=document.getElementById('onboarding-area');
    if(onbEl) onbEl.style.display = cat==='nyutai' ? 'block':'none';
    // 年次プロジェクト
    const annualEl = document.getElementById('annual-area');
    if(annualEl){ annualEl.style.display = cat==='annual' ? 'block':'none'; if(cat==='annual') renderAnnualProjects(); }
    // annualタブ時はmain-panelを非表示・annual専用レイアウトを表示
    const annualPanel = document.getElementById('annual-panel');
    if(annualPanel) annualPanel.style.display = cat==='annual' ? 'flex' : 'none';
    // アーカイブ描画
    if(isArchive) renderArchivePanel();
  }
}

function renderCatTabCounts(){
  // チームタスク＋個人タスク（自分のもの）を集計対象に統一
  const privTasks = currentUser ? getPrivateTasks() : [];
  const allTasks = [...tasks, ...privTasks].filter(t =>
    !t.private || (currentUser && (t.assignee === currentUser.id || t.assignee===''||!t.assignee))
  );
  const pending = allTasks.filter(t=>t.status!=='done');
  document.getElementById('mc-all').textContent=pending.length;
  document.getElementById('mc-kyuyo').textContent=pending.filter(t=>t.cat==='kyuyo').length;
  document.getElementById('mc-sankyuiku').textContent=pending.filter(t=>t.cat==='sankyuiku').length;
  document.getElementById('mc-nyutai').textContent=pending.filter(t=>t.cat==='nyutai').length;
  document.getElementById('mc-other').textContent=pending.filter(t=>t.cat==='other').length;
}

function getThisWeekRange(){
  const today = new Date(T);
  today.setHours(0,0,0,0);
  const dow = today.getDay(); // 0=日, 1=月...
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow===0 ? 6 : dow-1)); // 月曜に合わせる
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: fmt(monday), end: fmt(sunday) };
}

function renderStats(){
  const ts = fmt(T);
  const {start:wStart, end:wEnd} = getThisWeekRange();
  const setEl = (id,val) => { try { const e=document.getElementById(id); if(e) e.textContent=val; } catch(e){} };

  // ダッシュボードと同じ集計基準に統一
  // チームビュー：チームタスク＋個人タスク両方
  // 個人ビュー：自分のタスクのみ
  const privTasks = currentUser ? getPrivateTasks().map(t=>({...t,_isPrivate:true})) : [];
  let base;
  if(viewMode === 'personal' && currentUser){
    // 個人ビュー：自分のタスクのみ
    base = [...tasks, ...privTasks].filter(t => t.assignee === currentUser.id);
  } else {
    // チームビュー：チーム＋個人（privateは自分のもののみ）
    const all = [...tasks, ...privTasks];
    base = all.filter(t => !t.private || (currentUser && (t.assignee === currentUser.id || t.assignee===''||!t.assignee)));
  }

  const pending = base.filter(t => t.status !== 'done');
  setEl('b-all',    pending.length);
  setEl('b-today',  pending.filter(t => t.due && t.due.split('T')[0] === ts).length);
  setEl('b-week',   pending.filter(t => t.due && t.due.split('T')[0] >= wStart && t.due.split('T')[0] <= wEnd).length);

}

function renderMemberList(){
  const el=document.getElementById('member-list');
  if(!el)return;
  el.innerHTML=`<div class="member-item ${memberFilt==='all'?'active':''}" onclick="setMemberFilt('all',this)">
    <div class="member-avatar" style="background:var(--text3)">全</div>
    <div class="member-info"><div class="member-name">全員</div></div>
  </div>`+MEMBERS.map(m=>`
    <div class="member-item ${memberFilt===m.id?'active':''}" onclick="setMemberFilt('${escHtml(m.id)}',this)">
      <div class="member-avatar" style="background:${escHtml(m.color)}">${escHtml(m.initial)}</div>
      <div class="member-info">
        <div class="member-name">${escHtml(m.name)}</div>
        <div class="member-count">${tasks.filter(t=>t.assignee===m.id&&t.status!=='done').length}件 未完了</div>
      </div>
    </div>`).join('');
}

function setMemberFilt(id,el){
  memberFilt=id;
  document.querySelectorAll('.member-item').forEach(i=>i.classList.remove('active'));
  el.classList.add('active');
  renderTasks();
}

function getCheckedIds(){
  return [...document.querySelectorAll('.task-chk:checked')].map(el=>String(el.dataset.id));
}

function onTaskCheck(){
  const ids = getCheckedIds();
  const bulkArea = document.getElementById('bulk-actions');
  const countEl  = document.getElementById('selected-count');
  const allChk   = document.getElementById('select-all-chk');
  const total    = document.querySelectorAll('.task-chk').length;
  const cont     = document.getElementById('task-container');
  const banner   = document.getElementById('select-mode-banner');
  const bannerTxt= document.getElementById('select-mode-text');
  if(ids.length > 0){
    bulkArea.style.display = 'flex';
    countEl.textContent = `${ids.length}件選択`;
    if(cont) cont.classList.add('select-mode');
    if(banner){ banner.classList.add('on'); }
    if(bannerTxt) bannerTxt.textContent = `選択モード（${ids.length}件選択中）`;
  } else {
    bulkArea.style.display = 'none';
    if(cont) cont.classList.remove('select-mode');
    if(banner) banner.classList.remove('on');
  }
  if(allChk) allChk.indeterminate = ids.length > 0 && ids.length < total;
  if(allChk && ids.length === total && total > 0) allChk.checked = true;
  if(allChk && ids.length === 0) allChk.checked = false;
}

function enterSelectMode(e, taskId, action){
  if(e && e.stopPropagation) e.stopPropagation();
  const chk = document.querySelector('.task-chk[data-id="'+String(taskId)+'"]');
  if(chk){ chk.checked = true; onTaskCheck(); }
  if(action === 'delete') bulkDelete();
  if(action === 'copy')   bulkDuplicate();
}

function cancelSelectMode(){
  document.querySelectorAll('.task-chk').forEach(el => el.checked = false);
  onTaskCheck();
  const allChk = document.getElementById('select-all-chk');
  if(allChk) allChk.checked = false;
}

function toggleSelectAll(checked){
  document.querySelectorAll('.task-chk').forEach(el => el.checked = checked);
  onTaskCheck();
}

function bulkDelete(){
  const ids = getCheckedIds();
  if(!ids.length){ toast('⚠ タスクを選択してください',true); return; }
  if(!confirm('選択した'+ids.length+'件のタスクを削除しますか？')) return;
  // カレンダーからも削除
  ids.forEach(id => {
    const t = tasks.find(t=>String(t.id)===String(id));
    if(t && t.assignee && isGasEnabled()){
      const member = MEMBERS.find(m=>m.id===t.assignee);
      if(member && member.email) autoDeleteTaskFromCalendar(id, t.title, member);
    }
  });
  // チームタスクから削除
  const beforeTeam = tasks.length;
  tasks = tasks.filter(t => !ids.includes(String(t.id)));
  if(tasks.length < beforeTeam) saveTasks();
  // 個人タスクから削除（カレンダーからも削除）
  if(currentUser){
    const priv = getPrivateTasks();
    priv.forEach(t => {
      if(ids.includes(String(t.id)) && t.assignee && isGasEnabled()){
        const member = MEMBERS.find(m=>m.id===t.assignee);
        if(member && member.email) autoDeleteTaskFromCalendar(t.id, t.title, member);
      }
    });
    const newPriv = priv.filter(t => !ids.includes(String(t.id)));
    if(newPriv.length < priv.length) savePrivateTasks(newPriv);
  }
  renderAll();
  const allChk = document.getElementById('select-all-chk');
  if(allChk) allChk.checked = false;
  const bulkArea = document.getElementById('bulk-actions');
  if(bulkArea) bulkArea.style.display = 'none';
  toast('🗑 '+ids.length+'件を削除しました');
  if(isGasEnabled()) immediateSync();
}

function bulkDuplicate(){
  const ids = getCheckedIds();
  if(!ids.length){ toast('⚠ タスクを選択してください',true); return; }
  const newTasks = ids.map(id => {
    const t = tasks.find(t=>String(t.id)===String(id));
    if(!t) return null;
    return JSON.parse(JSON.stringify({ ...t, id: 'task_'+String(Date.now())+'_'+Math.random().toString(36).substring(2,9), title: t.title+' (コピー)', status:'todo', comments:[], files:[] }));
  }).filter(Boolean);
  tasks.push(...newTasks);
  saveTasks(); renderAll();
  document.getElementById('select-all-chk').checked = false;
  document.getElementById('bulk-actions').style.display = 'none';
  toast(`📋 ${newTasks.length}件を複製しました`);
  if(isGasEnabled()) syncData(true, true);
}

function getArchivedTasks(){
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 2);
  const cutoffStr = fmt(cutoff);
  return tasks.filter(t =>
    t.status === 'done' &&
    t.completedAt &&
    t.completedAt <= cutoffStr
  );
}

function renderArchivePanel(){
  const el = document.getElementById('archive-list');
  if(!el) return;

  const q = (document.getElementById('archive-search')?.value||'').toLowerCase().trim();
  let list = getArchivedTasks();

  if(q){
    list = list.filter(t=>
      t.title?.toLowerCase().includes(q) ||
      t.note?.toLowerCase().includes(q) ||
      MEMBERS.find(m=>m.id===t.assignee)?.name?.toLowerCase().includes(q) ||
      (t.cat && CAT_LABELS[t.cat]?.toLowerCase().includes(q))
    );
  }

  // アーカイブ件数バッジを更新
  const badge = document.getElementById('mc-archive');
  if(badge) badge.textContent = getArchivedTasks().length;

  if(list.length === 0){
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">
      <div style="font-size:32px;margin-bottom:8px">🗂</div>
      <div style="font-size:13px">${q ? `「${q}」の検索結果はありません` : 'アーカイブはありません'}</div>
      <div style="font-size:11px;margin-top:4px">完了から2ヶ月経過したタスクがここに表示されます</div>
    </div>`;
    return;
  }

  // 月ごとにグループ化
  const groups = {};
  list.forEach(t=>{
    const key = (t.completedAt||'').slice(0,7); // YYYY-MM
    if(!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  el.innerHTML = Object.entries(groups)
    .sort(([a],[b])=>b.localeCompare(a))
    .map(([month, tasks])=>{
      const [y,m] = month.split('-');
      return `
        <div style="border-bottom:1px solid var(--border)">
          <div style="padding:8px 16px;background:var(--surface2);font-size:11px;font-weight:700;color:var(--text3)">${y}年${parseInt(m)}月 完了（${tasks.length}件）</div>
          ${tasks.map(t=>{
            const member = MEMBERS.find(m=>m.id===t.assignee);
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);opacity:.75"
              onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
              <span style="font-size:16px;flex-shrink:0">✅</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:600;color:var(--text);text-decoration:line-through;margin-bottom:2px">${escHtml(t.title)}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <span style="font-size:10px;color:var(--text3)">${CAT_LABELS[t.cat]||t.cat}</span>
                  ${member?`<span style="font-size:10px;color:var(--text3)">👤 ${member.name}</span>`:''}
                  ${t.due?`<span style="font-size:10px;color:var(--text3);font-family:var(--mono)">期限: ${t.due.split('T')[0]}</span>`:''}
                  ${t.completedAt?`<span style="font-size:10px;color:var(--green);font-family:var(--mono)">完了: ${t.completedAt}</span>`:''}
                  ${t.note?`<span style="font-size:10px;color:var(--text3)">📝 ${t.note.slice(0,30)}${t.note.length>30?'…':''}</span>`:''}
                </div>
              </div>
              <button onclick="restoreFromArchive(${t.id})"
                style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer;white-space:nowrap;flex-shrink:0;font-family:var(--font)"
                onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'"
                title="タスクを未着手に戻す">↩ 元に戻す</button>
              <button onclick="permanentDeleteTask(${t.id})"
                style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;flex-shrink:0;font-family:var(--font)"
                onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
                onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'"
                title="完全削除">🗑</button>
            </div>`;
          }).join('')}
        </div>`;
    }).join('');
}

function restoreFromArchive(id){
  const t = tasks.find(x=>x.id===id);
  if(!t) return;
  t.status = 'todo';
  t.completedAt = '';
  saveTasks(); renderAll(); renderArchivePanel();
  toast('↩ タスクを未着手に戻しました');
}

function permanentDeleteTask(id){
  if(!confirm('このタスクを完全に削除しますか？元に戻せません。')) return;
  const idx = tasks.findIndex(x=>x.id===id);
  if(idx>=0) tasks.splice(idx,1);
  saveTasks(); renderArchivePanel();
  toast('🗑 完全削除しました');
}

function openBulkAssigneeModal(){
  const fromSel = document.getElementById('ba-from');
  const toSel   = document.getElementById('ba-to');
  const memberOpts = MEMBERS.map(m=>`<option value="${escHtml(m.id)}">${escHtml(m.name)}</option>`).join('');
  fromSel.innerHTML = '<option value="">すべての担当者（担当者なし含む）</option>' + memberOpts;
  toSel.innerHTML   = '<option value="">未割り当て</option>' + memberOpts;
  updateBulkAssigneePreview();
  // 変更時にプレビュー更新
  fromSel.onchange = updateBulkAssigneePreview;
  toSel.onchange   = updateBulkAssigneePreview;
  document.getElementById('ba-scope-tasks').onchange     = updateBulkAssigneePreview;
  document.getElementById('ba-scope-tasks-done').onchange= updateBulkAssigneePreview;
  document.getElementById('ba-scope-annual').onchange    = updateBulkAssigneePreview;
  modalShow('bulk-assignee-overlay');
}

function closeBulkAssigneeModal(){
  modalHide('bulk-assignee-overlay');
}

function updateBulkAssigneePreview(){
  const fromId    = document.getElementById('ba-from').value;
  const scopeTasks= document.getElementById('ba-scope-tasks').checked;
  const scopeDone = document.getElementById('ba-scope-tasks-done').checked;
  const scopeAnnual=document.getElementById('ba-scope-annual').checked;
  const preview   = document.getElementById('ba-preview');

  let count = 0;
  const lines = [];

  if(scopeTasks || scopeDone){
    const taskList = tasks.filter(t=>{
      if(fromId && t.assignee !== fromId) return false;
      if(!scopeDone && t.status === 'done') return false;
      return true;
    });
    if(taskList.length){
      count += taskList.length;
      lines.push(`通常タスク: ${taskList.length}件`);
    }
  }

  if(scopeAnnual){
    let annualCount = 0;
    annualProjects.forEach(proj=>{
      proj.tasks.forEach(t=>{
        if(!fromId || t.assignee === fromId || (!t.assignee && !fromId)) annualCount++;
      });
    });
    // プロジェクト自体の担当者も
    annualProjects.forEach(proj=>{
      if(!fromId || proj.assignee === fromId) annualCount++;
    });
    if(annualCount){
      count += annualCount;
      lines.push(`年次業務タスク・プロジェクト: ${annualCount}件`);
    }
  }

  if(count === 0){
    preview.innerHTML = '<span style="color:var(--text3)">対象タスクが見つかりません</span>';
  } else {
    const fromName = fromId ? (MEMBERS.find(m=>m.id===fromId)?.name||'不明') : 'すべて';
    preview.innerHTML = `<div style="font-weight:700;margin-bottom:4px">変更対象: ${count}件</div>`
      + lines.map(l=>`<div>・${l}</div>`).join('')
      + `<div style="margin-top:6px;color:var(--text3)">「${fromName}」→ 変更後の担当者に一括変更します</div>`;
  }
}

function execBulkAssignee(){
  const fromId     = document.getElementById('ba-from').value;
  const toId       = document.getElementById('ba-to').value;
  const scopeTasks = document.getElementById('ba-scope-tasks').checked;
  const scopeDone  = document.getElementById('ba-scope-tasks-done').checked;
  const scopeAnnual= document.getElementById('ba-scope-annual').checked;

  let count = 0;

  // 通常タスク
  if(scopeTasks || scopeDone){
    tasks.forEach(t=>{
      if(fromId && t.assignee !== fromId) return;
      if(!scopeDone && t.status === 'done') return;
      t.assignee = toId;
      count++;
    });
  }

  // 年次業務
  if(scopeAnnual){
    annualProjects.forEach(proj=>{
      // プロジェクト担当者
      if(!fromId || proj.assignee === fromId){
        proj.assignee = toId;
        count++;
      }
      // 各タスク
      proj.tasks.forEach(t=>{
        if(!fromId || t.assignee === fromId){
          t.assignee = toId;
          count++;
        }
      });
    });
    saveAnnualProjects();
  }

  if(count === 0){ toast('⚠ 対象タスクが見つかりませんでした', true); return; }

  saveTasks();
  renderAll();
  if(majorCat === 'annual') renderAnnualProjects();
  closeBulkAssigneeModal();

  const toName = toId ? (MEMBERS.find(m=>m.id===toId)?.name||'不明') : '未割り当て';
  toast(`✅ ${count}件の担当者を「${toName}」に変更しました`);
}

function autoArchiveCheck(){
  // 件数バッジを更新
  const badge = document.getElementById('mc-archive');
  if(badge) badge.textContent = getArchivedTasks().length || '';
}

function updateDeadlineBanner(){
  if(!currentUser) return;
  const ts = fmt(new Date());
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const tmrStr = fmt(tomorrow);

  const overdue = tasks.filter(t=>t.status!=='done'&&t.due&&t.due.split('T')[0]<ts);
  const today   = tasks.filter(t=>t.status!=='done'&&t.due&&t.due.split('T')[0]===ts);
  const tmr     = tasks.filter(t=>t.status!=='done'&&t.due&&t.due.split('T')[0]===tmrStr);

  const banner = document.getElementById('deadline-banner');
  const text   = document.getElementById('deadline-banner-text');
  if(!banner||!text) return;

  const parts = [];
  if(overdue.length) parts.push(`<span style="color:var(--red)">期限超過 ${overdue.length}件</span>`);
  if(today.length)   parts.push(`<span style="color:#d97706">今日期限 ${today.length}件</span>`);
  if(tmr.length)     parts.push(`<span style="color:#b45309">明日期限 ${tmr.length}件</span>`);

  if(parts.length){
    text.innerHTML = parts.join(' ／ ') + ' があります';
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function openCommentModal(taskId){
  const t = tasks.find(x=>x.id===taskId);
  if(!t) return;
  if(!t.comments) t.comments = [];
  const overlay = document.getElementById('comment-modal-overlay');
  document.getElementById('cm-task-title').textContent = t.title;
  document.getElementById('cm-task-id').value = taskId;
  document.getElementById('cm-input').value = '';
  renderComments(t);
  modalShow('comment-modal-overlay');
}

function closeCommentModal(){
  modalHide('comment-modal-overlay');
}

function renderComments(t){
  const list = document.getElementById('cm-list');
  if(!list) return;
  const comments = t.comments || [];
  if(!comments.length){
    list.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text3)">コメントはありません</div>';
    return;
  }
  list.innerHTML = comments.map((c,i)=>`
    <div style="padding:10px;border-radius:8px;background:${c.userId===currentUser?.id?'var(--accent-light)':'var(--surface2)'};border:1px solid ${c.userId===currentUser?.id?'var(--accent)44':'var(--border)'};margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        ${c.userColor?`<span style="width:18px;height:18px;border-radius:50%;background:${c.userColor};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff">${c.userInitial||'?'}</span>`:''}
        <span style="font-size:11px;font-weight:700;color:var(--text)">${c.userName||'不明'}</span>
        <span style="font-size:10px;color:var(--text3);margin-left:auto">${c.at||''}</span>
        ${c.userId===currentUser?.id?`<button onclick="deleteTaskComment(${t.id},${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:11px;padding:0 2px" title="削除">✕</button>`:''}
      </div>
      <div style="font-size:12px;color:var(--text);line-height:1.5;white-space:pre-wrap">${c.text}</div>
    </div>`).join('');
  list.scrollTop = list.scrollHeight;
}

function addCommentToTask(){
  const taskId = String(document.getElementById('cm-task-id').value);
  const text = document.getElementById('cm-input').value.trim();
  if(!text){ toast('⚠ コメントを入力してください',true); return; }
  const t = tasks.find(x=>String(x.id)===taskId);
  if(!t) return;
  if(!t.comments) t.comments = [];
  t.comments.push({
    text, userId: currentUser?.id, userName: currentUser?.name,
    userColor: currentUser?.color, userInitial: currentUser?.initial,
    at: new Date().toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}),
  });
  saveTasks(); renderComments(t);
  document.getElementById('cm-input').value = '';
  if(isGasEnabled()) immediateSync();
}

function deleteTaskComment(taskId, idx){
  const t = tasks.find(x=>x.id===taskId);
  if(!t||!t.comments) return;
  t.comments.splice(idx,1);
  saveTasks(); renderComments(t);
  if(isGasEnabled()) immediateSync();
}

function switchRightTab(tab, el){
  ['dash','detail','edit','sub'].forEach(id=>{
    const p=document.getElementById('panel-'+id);
    if(p) p.style.display=id===tab?'':'none';
    const b=document.getElementById('ptab-'+id);
    if(b) b.classList.toggle('active', id===tab);
  });
}

function showTaskDetail(id){
  const t = tasks.find(x=>x.id===id);
  if(!t) return;

  const member   = MEMBERS.find(m=>m.id===t.assignee);
  const approver = MEMBERS.find(m=>m.id===t.approver);
  const dueStr   = t.due ? t.due.split('T')[0] : '';
  const now      = new Date(); const ts = fmt(now);
  const isOverdue= dueStr && dueStr < ts && t.status!=='done';
  const isToday  = dueStr === ts;
  const STATUS_LABELS = {todo:'未着手',inprogress:'進行中',review:'承認待ち',done:'完了'};
  const STATUS_COLORS = {todo:'#94a3b8',inprogress:'#f59e0b',review:'#8b5cf6',done:'#10b981'};
  const CAT_LABELS    = {kyuyo:'給与計算',sankyuiku:'産休・育休・休職',nyutai:'入社・退職',other:'その他'};
  const stColor = STATUS_COLORS[t.status]||'#94a3b8';
  const subs = t.subtasks||[];
  const doneSubCount = subs.filter(s=>s.status==='done').length;

  document.getElementById('task-detail-content').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="font-size:11px;font-family:var(--mono);color:var(--text3)">#${t.id}</span>
      <div style="display:flex;gap:5px">
        <button onclick="editTask(event,'${t.id}')" class="btn btn-ghost" style="font-size:11px;padding:4px 8px">✏️ 編集</button>
        <button onclick="closeTaskDetail()" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--text3);padding:2px 4px" title="閉じる">✕</button>
      </div>
    </div>

    <!-- タイトル -->
    <div style="font-size:14px;font-weight:700;color:var(--text);line-height:1.5;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">
      ${t.private?'<span style="font-size:11px;padding:1px 6px;border-radius:4px;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;margin-right:6px">🔒</span>':''}
      ${escHtml(t.title)}
    </div>

    <!-- ステータス・カテゴリ -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      <span style="font-size:11px;padding:3px 10px;border-radius:10px;background:${stColor}22;color:${stColor};border:1px solid ${stColor}44;font-weight:700">${STATUS_ICON_HTML(t.status)}${STATUS_LABELS[t.status]||'-'}</span>
      <span style="font-size:11px;padding:3px 10px;border-radius:10px;background:var(--surface2);color:var(--text2);border:1px solid var(--border)">${CAT_LABELS[t.cat]||t.cat||'-'}</span>
      ${t.rep?`<span style="font-size:11px;padding:3px 10px;border-radius:10px;background:#ede9fe;color:#7c3aed;border:1px solid #ddd6fe">${t.rep==='monthly'?'🔁 毎月':'🔁 毎週'}</span>`:''}
    </div>

    <!-- 期限日 -->
    <div style="margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:4px">期限日</div>
      <div style="font-size:16px;font-family:var(--mono);font-weight:700;color:${isOverdue?'var(--red)':isToday?'#f59e0b':'var(--text)'}">
        ${dueStr||'未設定'}
        ${isOverdue?'<span style="font-size:11px;color:var(--red);font-weight:700;margin-left:4px">⚠ 超過</span>':''}
        ${isToday?'<span style="font-size:11px;color:#f59e0b;font-weight:700;margin-left:4px">今日</span>':''}
      </div>
    </div>

    <!-- 担当者・承認者 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:4px">担当者</div>
        ${member?`<div style="display:flex;align-items:center;gap:6px">
          <span style="width:24px;height:24px;border-radius:50%;background:${member.color};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff">${member.initial}</span>
          <span style="font-size:12px;font-weight:600">${member.name}</span>
        </div>`:'<span style="font-size:12px;color:var(--text3)">未設定</span>'}
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:4px">承認者</div>
        <span style="font-size:12px;color:var(--text2)">${approver?approver.name:'なし'}</span>
      </div>
    </div>

    <!-- メモ -->
    ${t.note?`<div style="margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:4px">メモ</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.6;padding:8px;background:var(--surface2);border-radius:7px;border:1px solid var(--border)">${t.note}</div>
    </div>`:''}

    <!-- 子タスク -->
    ${subs.length?`<div style="margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:6px">子タスク ${doneSubCount}/${subs.length}</div>
      <div style="height:4px;background:var(--border);border-radius:4px;margin-bottom:8px;overflow:hidden">
        <div style="height:100%;background:var(--accent);width:${subs.length?Math.round(doneSubCount/subs.length*100):0}%;transition:width .3s"></div>
      </div>
      ${subs.map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
        <input type="checkbox" ${s.status==='done'?'checked':''} style="width:14px;height:14px;accent-color:var(--accent)"
          onchange="toggleSubInDetail(${t.id},'${s.id}',this.checked)">
        <span style="font-size:12px;color:${s.status==='done'?'var(--text3)':'var(--text)'};text-decoration:${s.status==='done'?'line-through':'none'}">${escHtml(s.title)}</span>
      </div>`).join('')}
    </div>`:''}

    <!-- ファイル -->
    ${(t.files||[]).length?`<div>
      <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:6px">添付ファイル</div>
      ${t.files.map(f=>`<a href="${f.url}" target="_blank" style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:#fff;text-decoration:none;color:var(--accent);font-size:11px;margin-bottom:4px">
        📎 ${f.name||f.url}
      </a>`).join('')}
    </div>`:''}

    <!-- 完了ボタン -->
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
      <button onclick="toggleTableTaskDone(${t.id}, ${t.status!=='done'}); showTaskDetail(${t.id})"
        style="width:100%;padding:8px;border-radius:8px;border:2px solid ${t.status==='done'?'var(--border)':'var(--green)'};background:${t.status==='done'?'var(--surface2)':'var(--green-light)'};color:${t.status==='done'?'var(--text2)':'var(--green)'};font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font);transition:all .15s"
        onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
        ${t.status==='done'?'↩ 未着手に戻す':'✅ 完了にする'}
      </button>
    </div>`;

  // タブを詳細に切替
  document.getElementById('ptab-detail').style.display = '';
  switchRightTab('detail', document.getElementById('ptab-detail'));
}

function closeTaskDetail(){
  switchRightTab('dash', document.getElementById('ptab-dash'));
  document.getElementById('ptab-detail').style.display = 'none';
}

function updateTaskDueInTable(id, dateVal){
  const t = tasks.find(x=>x.id===id);
  if(!t) return;
  t.due = dateVal ? dateVal+'T17:00' : '';
  saveTasks(); renderTaskTable([...document.querySelectorAll('#task-container tr[data-id]')].map(()=>null).filter(Boolean));
  renderTasks(); renderStats();
  if(isGasEnabled()&&t.assignee&&t.due) autoSyncTaskToCalendar(t);
}

function toggleTableSort(col){
  if(tableSortCol===col) tableSortDir = tableSortDir==='asc'?'desc':'asc';
  else { tableSortCol=col; tableSortDir='asc'; }
  renderTasks();
}

function toggleTableExpand(id){
  const sid = String(id);
  if(tableExpandedIds.has(sid)) tableExpandedIds.delete(sid);
  else tableExpandedIds.add(sid);
  renderTasks();
}

function toggleTableTaskDone(id, checked){
  const t = tasks.find(x=>x.id===id);
  if(!t) return;
  t.status = checked ? 'done' : 'todo';
  saveTasks(); renderTasks(); renderStats();
  if(isGasEnabled()) syncData(true, true);
}

function startTableTitleEdit(event, id){
  event.stopPropagation();
  const span = document.getElementById(`tbl-title-${id}`);
  if(!span) return;
  const t = tasks.find(x=>x.id===id);
  if(!t) return;
  const oldTitle = t.title;
  const input = document.createElement('input');
  input.value = oldTitle;
  input.style.cssText = 'font-size:12px;font-weight:600;border:none;border-bottom:2px solid var(--accent);outline:none;background:transparent;width:100%;font-family:var(--font);padding:0;color:var(--text)';
  span.replaceWith(input);
  input.focus();
  input.select();
  const save = () => {
    const newTitle = input.value.trim();
    if(newTitle && newTitle !== oldTitle){
      t.title = newTitle;
      saveTasks();
      if(isGasEnabled()) syncData(true, true);
      toast('✏️ タイトルを更新しました');
    }
    renderTasks();
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if(e.key==='Enter'){ e.preventDefault(); save(); }
    if(e.key==='Escape'){ renderTasks(); }
  });
}

function tableDragStart(event, id){
  dragSrcId = id;
  event.dataTransfer.effectAllowed = 'move';
  event.currentTarget.classList.add('dnd-dragging');
}

function tableDragOver(event){
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('#task-container tr.dnd-over').forEach(tr=>tr.classList.remove('dnd-over'));
  event.currentTarget.classList.add('dnd-over');
}

function tableDrop(event, targetId){
  event.preventDefault();
  event.currentTarget.classList.remove('dnd-over');
  if(dragSrcId === null || dragSrcId === targetId) return;
  const srcIdx = tasks.findIndex(t=>t.id===dragSrcId);
  const tgtIdx = tasks.findIndex(t=>t.id===targetId);
  if(srcIdx<0||tgtIdx<0) return;
  const [moved] = tasks.splice(srcIdx, 1);
  tasks.splice(tgtIdx, 0, moved);
  saveTasks(); renderTasks();
  if(isGasEnabled()) syncData(true, true);
  dragSrcId = null;
}

function tableDragEnd(event){
  event.currentTarget.classList.remove('dnd-dragging');
  dragSrcId = null;
  document.querySelectorAll('#task-container tr').forEach(tr=>tr.classList.remove('dnd-over','dnd-dragging'));
}

function onTaskSearch(){
  const input = document.getElementById('task-search-input');
  taskSearchQuery = input?.value.trim().toLowerCase() || '';
  const clearBtn = document.getElementById('task-search-clear');
  if(clearBtn) clearBtn.style.display = taskSearchQuery ? 'block' : 'none';
  renderTasks();
}

function clearTaskSearch(){
  taskSearchQuery = '';
  const input = document.getElementById('task-search-input');
  if(input) input.value = '';
  const clearBtn = document.getElementById('task-search-clear');
  if(clearBtn) clearBtn.style.display = 'none';
  const countEl = document.getElementById('task-search-count');
  if(countEl) countEl.textContent = '';
  renderTasks();
}

function setTaskViewMode(mode){
  taskViewMode = mode;
  const listBtn  = document.getElementById('view-list-btn');
  const tableBtn = document.getElementById('view-table-btn');
  if(listBtn){
    listBtn.style.background = mode==='list' ? 'var(--accent)' : 'transparent';
    listBtn.style.color      = mode==='list' ? '#fff' : 'var(--text2)';
  }
  if(tableBtn){
    tableBtn.style.background = mode==='table' ? 'var(--accent)' : 'transparent';
    tableBtn.style.color      = mode==='table' ? '#fff' : 'var(--text2)';
  }
  // テーブル時のみ期限絞り込みを表示
  const dueArea = document.getElementById('due-filter-area');
  if(dueArea) dueArea.style.display = mode==='table' ? 'flex' : 'none';
  renderTasks();
}

function renderTaskTable(list){
  // 期限日ソート
  list = [...list].sort((a,b)=>{
    const va = a.due||'9999-99-99';
    const vb = b.due||'9999-99-99';
    const cmp = va.localeCompare(vb);
    return tableSortDir==='asc' ? cmp : -cmp;
  });
  const c = document.getElementById('task-container');
  if(!list.length){
    c.innerHTML = '<div class="empty-state"><div class="icon">📋</div>タスクがありません</div>';
    return;
  }

  const now = new Date(); const ts = fmt(now);
  const STATUS_LABELS = {todo:'未着手',inprogress:'進行中',review:'承認待ち',done:'完了'};
  const STATUS_COLORS = {todo:'#94a3b8',inprogress:'#f59e0b',review:'#8b5cf6',done:'#10b981'};
  const CAT_LABELS    = {kyuyo:'給与計算',sankyuiku:'産休・育休・休職',nyutai:'入社・退職',other:'その他'};

  // 親タスク行を生成
  const taskRow = (t, i, isChild=false, hasChildren=false, isExpanded=false) => {
    const member   = MEMBERS.find(m=>m.id===t.assignee);
    const approver = MEMBERS.find(m=>m.id===t.approver);
    const dueStr   = t.due ? t.due.split('T')[0] : '';
    const isOverdue= dueStr && dueStr < ts && t.status!=='done';
    const isToday  = dueStr === ts;
    const stColor  = STATUS_COLORS[t.status]||'#94a3b8';
    const isDone   = t.status==='done';
    const bg       = isChild ? '#f0f9ff' : (i%2===0 ? '#fff' : '#f8fafc');
    const repLabel = t.rep==='monthly'?'毎月':t.rep==='weekly'?'毎週':'';
    return `<tr data-id="${t.id}" draggable="${!isChild}" style="background:${bg};border-bottom:1px solid ${isChild?'#bae6fd':'#e2e8f0'};transition:background .1s;${!isChild?'cursor:pointer':''}"
      onmouseover="this.style.background='${isChild?'#e0f2fe':'var(--accent-light)'}'"
      onmouseout="this.style.background='${bg}'"
      ondblclick="editTask(event,${t.id})"
      ${!isChild?`ondragstart="tableDragStart(event,${t.id})" ondragover="tableDragOver(event)" ondrop="tableDrop(event,${t.id})" ondragend="tableDragEnd(event)"`:''}>
      <td style="padding:${isChild?'6px 12px 6px 36px':'8px 12px'}">
        ${!isChild
          ? `<div style="display:flex;align-items:center;gap:6px">
              <span style="cursor:grab;color:var(--text3);font-size:14px;user-select:none" title="ドラッグで並び替え">⠿</span>
              <input type="checkbox" class="task-chk" data-id="${t.id}" onchange="onTaskCheck()" style="width:14px;height:14px;accent-color:var(--accent)">
            </div>`
          : '<span style="color:#7dd3fc;font-size:12px">└</span>'
        }
      </td>
      <!-- 完了チェック -->
      <td style="padding:${isChild?'6px 4px':'8px 4px'};width:28px">
        <input type="checkbox" ${isDone?'checked':''} title="完了にする"
          onchange="toggleTableTaskDone(${t.id},this.checked)"
          style="width:15px;height:15px;accent-color:var(--green);cursor:pointer;flex-shrink:0">
      </td>
      <td style="padding:${isChild?'6px 8px':'8px 12px'};max-width:260px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${!isChild&&hasChildren?`<span onclick="event.stopPropagation();toggleTableExpand(${t.id})" style="cursor:pointer;color:var(--text3);font-size:12px;transition:transform .2s;display:inline-block;transform:${isExpanded?'rotate(90deg)':'rotate(0deg)'};user-select:none" title="子タスクを展開">▶</span>`:''}
          ${isChild?'<span style="font-size:11px;color:#0369a1;margin-right:2px">▸</span>':''}
          <span id="tbl-title-${t.id}"
            style="font-weight:${isChild?'500':'600'};color:${isChild?'#0369a1':isDone?'var(--text3)':'var(--text)'};font-size:${isChild?'11px':'12px'};line-height:1.4;text-decoration:${isDone?'line-through':'none'}"
            >${escHtml(t.title)}</span>
          ${!isChild&&t.private?'<span style="font-size:10px;padding:1px 5px;border-radius:4px;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1">🔒</span>':''}
          ${!isChild&&t.rep?`<span style="font-size:10px;padding:1px 5px;border-radius:4px;background:#ede9fe;color:#7c3aed;border:1px solid #ddd6fe">${repLabel}</span>`:''}
        </div>
        ${!isChild&&t.note?`<div style="font-size:11px;color:var(--text3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px">${t.note}</div>`:''}
      </td>
      <td style="padding:${isChild?'6px 8px':'8px 12px'};white-space:nowrap">
        ${!isChild?`<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:var(--surface2);color:var(--text2);border:1px solid var(--border)">${CAT_LABELS[t.cat]||t.cat||'-'}</span>`:''}
      </td>
      <td style="padding:${isChild?'6px 8px':'8px 12px'};white-space:nowrap">
        ${member?`<div style="display:flex;align-items:center;gap:5px">
          <span style="width:${isChild?'16px':'20px'};height:${isChild?'16px':'20px'};border-radius:50%;background:${member.color};display:flex;align-items:center;justify-content:center;font-size:${isChild?'9px':'10px'};font-weight:800;color:#fff;flex-shrink:0">${member.initial}</span>
          <span style="font-size:${isChild?'11px':'12px'}">${member.name}</span>
        </div>`:'<span style="color:var(--text3)">-</span>'}
      </td>
      <td style="padding:${isChild?'6px 6px':'6px 8px'};white-space:nowrap" onclick="event.stopPropagation()">
        ${!isChild
          ? `<input type="date" value="${dueStr||''}"
              onchange="updateTaskDueInTable(${t.id},this.value)"
              style="border:1px solid ${isOverdue?'var(--red)':isToday?'#f59e0b':'var(--border)'};border-radius:6px;padding:4px 6px;font-size:12px;font-family:var(--mono);font-weight:${isOverdue||isToday?'700':'500'};color:${isOverdue?'var(--red)':isToday?'#f59e0b':'var(--text)'};background:${isOverdue?'#fef2f2':isToday?'#fffbeb':'#fff'};cursor:pointer;width:130px">
             ${isOverdue?'<div style="font-size:10px;color:var(--red);font-weight:700">⚠ 期限超過</div>':''}
             ${isToday?'<div style="font-size:10px;color:#f59e0b;font-weight:700">📅 今日</div>':''}`
          : `<span style="font-size:11px;font-family:var(--mono);color:var(--text3)">${dueStr||'-'}</span>`
        }
      </td>
      <td style="padding:${isChild?'6px 8px':'8px 12px'};white-space:nowrap">
        <span style="font-size:11px;padding:3px 10px;border-radius:10px;background:${stColor}22;color:${stColor};border:1px solid ${stColor}44;font-weight:700">${STATUS_ICON_HTML(t.status)}${STATUS_LABELS[t.status]||'-'}</span>
      </td>
      <td style="padding:${isChild?'6px 8px':'8px 12px'};white-space:nowrap;font-size:12px;color:var(--text2)">
        ${!isChild?(approver?approver.name:'-'):''}
      </td>
      <td style="padding:${isChild?'6px 8px':'8px 12px'};white-space:nowrap;font-size:11px;color:var(--text3)">
        ${!isChild?(repLabel||'-'):''}
      </td>
      <td style="padding:6px 8px;white-space:nowrap;text-align:center">
        ${!isChild?`<div style="display:flex;gap:3px;justify-content:center">
          <button onclick="editTask(event,'${t.id}')" style="font-size:11px;padding:3px 7px;border-radius:5px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer"
            onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">✏️</button>
          <button onclick="delTask(event,'${t.id}')" style="font-size:11px;padding:3px 7px;border-radius:5px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer"
            onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
            onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑</button>
        </div>`:''}
      </td>
    </tr>`;
  };

  c.innerHTML = `
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px;background:#fff;box-shadow:var(--shadow-sm)">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--surface2);border-bottom:2px solid var(--border)">
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:var(--text2);white-space:nowrap;width:30px">
              <input type="checkbox" id="table-select-all" onchange="toggleSelectAll(this.checked)" style="width:14px;height:14px;accent-color:var(--accent)">
            </th>
            <th style="padding:10px 8px;text-align:left;font-weight:700;color:var(--text2);white-space:nowrap;width:28px">✅</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:var(--text2)">タイトル</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:var(--text2);white-space:nowrap">カテゴリ</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:var(--text2);white-space:nowrap">担当者</th>
            <th onclick="toggleTableSort('due')" style="padding:10px 12px;text-align:left;font-weight:700;color:var(--text2);white-space:nowrap;cursor:pointer;user-select:none"
              onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text2)'" title="クリックで日付順ソート">
              期限日 ${tableSortDir==='asc'?'▲':'▼'}
            </th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:var(--text2);white-space:nowrap">ステータス</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:var(--text2);white-space:nowrap">承認者</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:var(--text2);white-space:nowrap">繰り返し</th>
            <th style="padding:10px 12px;text-align:center;font-weight:700;color:var(--text2);white-space:nowrap">操作</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((t,i)=>{
            // 子タスクをstatusFilterで絞り込む
            let subs = (t.subtasks||[]);
            if(statusFilt!=='all') subs = subs.filter(s=>s.status===statusFilt);
            // 親タスクが展開中かどうか
            const isExpanded = tableExpandedIds.has(String(t.id));
            const parentRow = taskRow(t, i, false, subs.length>0, isExpanded);
            const subRows = isExpanded ? subs.map(s => taskRow(s, i, true)).join('') : '';
            return parentRow + subRows;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderTasks(){
  const gantt = document.getElementById('leave-gantt-area');
  if(gantt) gantt.style.display = majorCat==='sankyuiku' ? 'block' : 'none';
  // 入社種別フィルタは「入社・退職」タブのときだけ表示
  const hireFilterArea = document.getElementById('hire-filter-area');
  if(hireFilterArea) hireFilterArea.style.display = (majorCat==='nyutai') ? 'flex' : 'none';
  // トピックはすべてタブのみ表示
  const topicSection = document.getElementById('topic-section');
  if(topicSection) topicSection.style.display = majorCat==='all' ? '' : 'none';
  // チームタスク＋個人タスク（ログイン中のみ）を結合
  const privateTasks = currentUser ? getPrivateTasks().map(t=>({...t,_isPrivate:true})) : [];
  // アーカイブ対象（完了から2ヶ月超）を除外
  const archiveCutoff = new Date(); archiveCutoff.setMonth(archiveCutoff.getMonth()-2);
  const archiveCutoffStr = fmt(archiveCutoff);
  let list=[...tasks, ...privateTasks].filter(t=>
    !(t.status==='done' && t.completedAt && t.completedAt<=archiveCutoffStr)
  );
  // チームビューではtasks内のprivateタスクを非表示（自分のもののみ表示）
  if(viewMode==='team'){
    list = list.filter(t => !t.private || (currentUser && (t.assignee===currentUser.id || t.assignee===''||!t.assignee)));
  }
  const ts=fmt(T);
  const {start:wkStart, end:wkEnd} = getThisWeekRange();
  // 個人ビューは自分のタスクのみ強制
  if(viewMode==='personal'&&currentUser){
    list=list.filter(t=>t.assignee===currentUser.id);
    list=list.filter(t=>t.status!=='done');
  } else {
    if(view==='mine')list=list.filter(t=>t.assignee===(currentUser?.id));
    else if(view==='today')list=list.filter(t=>t.status!=='done'&&t.due===ts);
    else if(view==='week')list=list.filter(t=>t.status!=='done'&&t.due&&t.due.split('T')[0]>=wkStart&&t.due.split('T')[0]<=wkEnd);
    else if(view==='review')list=list.filter(t=>t.status==='review');
    else if(view==='done')list=list.filter(t=>t.status==='done');
    else list=list; // すべて：完了も含む
    if(memberFilt!=='all')list=list.filter(t=>t.assignee===memberFilt);
  }
  if(filt!=='all')list=list.filter(t=>t.cat===filt);
  if(hireFilt!=='all') list=list.filter(t=>t.hireType===hireFilt);
  if(majorCat!=='all'&&!['news','approvallog','links','docs','members'].includes(majorCat))
    list=list.filter(t=>t.cat===majorCat);
  if(statusFilt!=='all'){
    if(statusFilt==='done'){
      list=list.filter(t=>t.status==='done');
    } else if(view!=='done'){
      list=list.filter(t=>t.status===statusFilt);
    }
  }

  // 検索フィルタ
  if(taskSearchQuery){
    list=list.filter(t=>
      t.title?.toLowerCase().includes(taskSearchQuery) ||
      t.note?.toLowerCase().includes(taskSearchQuery) ||
      MEMBERS.find(m=>m.id===t.assignee)?.name?.toLowerCase().includes(taskSearchQuery)
    );
    const countEl = document.getElementById('task-search-count');
    if(countEl) countEl.textContent = `${list.length}件ヒット`;
  }

  // 期限超過フィルター
  if(overdueFilter){
    const ts2 = fmt(new Date());
    list = list.filter(t=>t.status!=='done'&&t.due&&t.due.split('T')[0]<ts2);
  }

  // 期限絞り込み（テーブル表示時のみ）
  if(taskViewMode==='table'){
    const dueFilt = document.getElementById('due-filter-select')?.value || 'all';
    if(dueFilt !== 'all'){
      const now = new Date(); now.setHours(0,0,0,0);
      const ts  = fmt(now);
      const {start:weekStr2, end:weekStr} = getThisWeekRange();
      const monthEnd = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(new Date(now.getFullYear(),now.getMonth()+1,0).getDate())}`;
      const nextMonthStart = `${now.getFullYear()}-${pad(now.getMonth()+2)}-01`;
      const nextMonthEnd   = `${now.getFullYear()}-${pad(now.getMonth()+2)}-${pad(new Date(now.getFullYear(),now.getMonth()+2,0).getDate())}`;
      list = list.filter(t=>{
        const d = t.due ? t.due.split('T')[0] : '';
        if(dueFilt==='overdue')    return d && d < ts && t.status!=='done';
        if(dueFilt==='today')      return d === ts;
        if(dueFilt==='week')       return d && d >= weekStr2 && d <= weekStr;
        if(dueFilt==='month')      return d && d >= ts && d <= monthEnd;
        if(dueFilt==='next_month') return d && d >= nextMonthStart && d <= nextMonthEnd;
        if(dueFilt==='no_due')     return !d;
        return true;
      });
    }
  }

  list.sort((a,b)=>{
    // 完了タスクは末尾へ
    if(a.status==='done' && b.status!=='done') return 1;
    if(a.status!=='done' && b.status==='done') return -1;
    if(a.due&&b.due)return a.due.localeCompare(b.due);
    if(a.due)return -1;if(b.due)return 1;return 0;
  });
  const c=document.getElementById('task-container');c.innerHTML='';
  if(!list.length){
    c.innerHTML=`<div class="empty-state"><div class="icon">🎉</div>${viewMode==='personal'?'自分のタスクはありません':'タスクはありません'}</div>`;
    return;
  }
  if(taskViewMode==='table'){ renderTaskTable(list); return; }
  c.innerHTML=list.map(cardHTML).join('');
}

function toggleCardNote(id){
  const t = tasks.find(x=>x.id===id) || getPrivateTasks().find(x=>x.id===id);
  if(!t||!t.note) return;
  const el = document.getElementById(`note-text-${id}`);
  if(!el) return;
  const isExpanded = el.dataset.expanded === '1';
  if(isExpanded){
    el.textContent = t.note.slice(0,25) + (t.note.length>25?'…':'');
    el.style.whiteSpace = 'nowrap';
    el.style.overflow   = 'hidden';
    el.style.maxWidth   = '200px';
    el.dataset.expanded = '0';
  } else {
    el.textContent = t.note;
    el.style.whiteSpace = 'pre-wrap';
    el.style.overflow   = 'visible';
    el.style.maxWidth   = '100%';
    el.dataset.expanded = '1';
  }
}

function cardHTML(t){
  const ts=fmt(T);
  const dc=!t.due||t.status==='done'?'':t.due<ts?'overdue':t.due===ts?'today-due':Math.floor((new Date(t.due)-T)/86400000)<=3?'soon':'';
  const dl=t.due?dueLabel(t.due,t.status==='done'):'';
  const member=MEMBERS.find(m=>m.id===t.assignee);
  const approver=MEMBERS.find(m=>m.id===t.approver);
  const stTag=`<span class="tag tag-${t.status}">${STATUS_ICON_HTML(t.status)}${escHtml(STATUS_LABELS[t.status]||t.status)}</span>`;
  const catTag=`<span class="tag tag-cat">${escHtml(CAT_LABELS[t.cat]||t.cat)}</span>`;
  const privateTag = t._isPrivate ? `<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;font-weight:700;flex-shrink:0">🔒 個人</span>` : '';
  const approvalTag=t.approver&&t.status==='review'?`<span class="tag tag-review">承認待ち</span>`:'';
  const hireMeta = t.hireType ? HIRE_TYPE_META[t.hireType] : null;
  const hireTag = hireMeta ? `<span class="tag" style="background:${hireMeta.light};color:${hireMeta.color};border:1px solid ${hireMeta.border};font-weight:700">${hireMeta.icon} ${hireMeta.label}</span>` : '';
  const leaveMk = t.leaveType ? LEAVE_TYPE_TO_MASTER[t.leaveType] : null;
  const leaveMeta = leaveMk ? CHECKLIST_MASTERS[leaveMk] : null;
  const leaveTag = leaveMeta ? `<span class="tag" style="background:${leaveMeta.light};color:${leaveMeta.color};border:1px solid ${leaveMeta.border};font-weight:700">${leaveMeta.icon} ${leaveMeta.label}</span>` : '';
  const filesHTML=t.files&&t.files.length?`<div class="file-list">${t.files.map(f=>{
    const hasName = f.name && f.name !== f.url && f.name.trim();
    const label = hasName ? escHtml(f.name) : 'リンクを開く';
    const icon = hasName ? '📎' : '🔗';
    const safeUrl = /^https?:\/\//.test(f.url) ? f.url : '#';
    return `<div class="file-item"><span class="file-icon">${icon}</span><span class="file-name" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span><a class="file-link" href="${escHtml(safeUrl)}" target="_blank" rel="noopener">開く →</a></div>`;
  }).join('')}</div>`:'';
  const subs=t.subtasks||[];
  const doneCount=subs.filter(s=>s.status==='done').length;
  const pct=subs.length?Math.round(doneCount/subs.length*100):0;
  const subtasksHTML=`
    <div class="subtask-inline" id="sub-inline-${t.id}">
      <div class="subtask-inline-inner">
        ${subs.length?`
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <button onclick="event.stopPropagation();toggleStSelectAll('${t.id}')" id="st-sel-all-${t.id}"
            style="font-size:10px;padding:2px 8px;border-radius:5px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer;font-family:var(--font)">全選択</button>
        </div>
        <div id="st-bulk-bar-${t.id}" style="display:none;padding:6px 8px;background:var(--accent-light);border-radius:7px;margin-bottom:6px;align-items:center;gap:6px;flex-wrap:wrap">
          <span id="st-bulk-count-${t.id}" style="font-size:11px;color:var(--accent);font-weight:700"></span>
          <button onclick="event.stopPropagation();stBulkComplete('${t.id}')" style="font-size:11px;padding:3px 10px;border-radius:5px;border:none;background:var(--green);color:#fff;cursor:pointer;font-family:var(--font);font-weight:600">✅ 一括完了</button>
          <button onclick="event.stopPropagation();stBulkSetDue('${t.id}')" style="font-size:11px;padding:3px 10px;border-radius:5px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-family:var(--font);font-weight:600">📅 一括期限設定</button>
          <button onclick="event.stopPropagation();stBulkDelete('${t.id}')" style="font-size:11px;padding:3px 10px;border-radius:5px;border:none;background:var(--red);color:#fff;cursor:pointer;font-family:var(--font);font-weight:600">🗑 一括削除</button>
          <button onclick="event.stopPropagation();stBulkClear('${t.id}')" style="font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer;font-family:var(--font)">× 解除</button>
        </div>
        <div class="st-prog-bar"><div class="st-prog-fill" id="stpf-${t.id}" style="width:${pct}%"></div></div>`:''}
        <div id="st-list-${t.id}">${subs.map(s=>stRowHTML(t.id,s)).join('')}</div>
        <div class="st-add-row" onclick="event.stopPropagation()">
          <input class="st-add-input" id="st-inp-${t.id}" placeholder="子タスクを追加..." onkeydown="if(event.key==='Enter'){event.preventDefault();quickAddSubtask(${t.id})}">
          <button class="st-add-btn" onclick="quickAddSubtask(${t.id})">追加</button>
        </div>
      </div>
    </div>`;
  return `<div class="task-card status-${t.status}" id="card-${t.id}"
    onclick="toggleCard('${t.id}',event)"
    onkeydown="handleCardKey(event,${t.id})">
    <div class="task-card-top">
      <!-- チェックボックス -->
      <div onclick="event.stopPropagation()" style="padding-top:2px;flex-shrink:0">
        <input type="checkbox" class="task-chk" data-id="${t.id}"
          onchange="onTaskCheck()"
          style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer">
      </div>
      <div class="task-body">
        <div class="task-title" id="title-wrap-${t.id}">
          <span id="arrow-${t.id}" onclick="event.stopPropagation();expandCard('${t.id}')" style="font-size:11px;color:var(--text3);margin-right:5px;display:inline-block;transition:transform .2s;cursor:pointer;padding:2px 4px;border-radius:3px" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'" title="子タスクを展開">▶</span>
          <span id="title-text-${t.id}" ondblclick="startInlineEdit(event,${t.id})" title="ダブルクリックでタイトル編集" style="cursor:text">${escHtml(t.title)}</span>
          ${t.private?'<span style="font-size:10px;padding:1px 5px;border-radius:5px;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;margin-left:4px">🔒 個人</span>':''}
          ${subs.length?`<span style="font-size:10px;font-family:var(--mono);font-weight:600;padding:1px 7px;border-radius:10px;margin-left:6px;background:${doneCount===subs.length&&subs.length>0?'var(--accent-light)':'var(--surface2)'};color:${doneCount===subs.length&&subs.length>0?'var(--accent)':'var(--text3)'}">${doneCount}/${subs.length}</span>`:''}
          ${privateTag}
        </div>
        <div class="task-meta">
          ${stTag}${catTag}${hireTag}${leaveTag}
          ${dl?`<span class="due-label ${dc}">${DUE_ICON_HTML(dc)} ${dl}</span>`:''}
          ${bizDayBadge(t.due, t.status==='done')}
          ${approvalTag}
          ${t.rep?`<span class="tag" style="background:var(--surface2);color:var(--text3)">${t.rep==='monthly'?'毎月':'毎週'}${t.repBizDay?` 第${t.repBizDay}営業日`:''}</span>`:''}
          ${t.deadlineRule&&t.deadlineRule!=='fixed'?`<span style="font-size:10px;color:var(--blue);font-family:var(--mono);background:var(--blue-light);padding:1px 6px;border-radius:4px">${ruleLabel(t.deadlineRule)}</span>`:''}
        </div>
        <div class="assignee-row">
          ${member?`<div class="assignee-chip"><div class="assignee-dot" style="background:${escHtml(member.color)}"></div>${escHtml(member.name)}</div>`:'<div class="assignee-chip">未割り当て</div>'}
          ${approver?`<div class="assignee-chip" style="background:var(--purple-light);color:var(--purple)">承認: ${escHtml(approver.name)}</div>`:''}
          ${t.note?`<span onclick="event.stopPropagation();toggleCardNote('${t.id}')" ondblclick="event.stopPropagation();editTask(event,'${t.id}')" title="クリックでメモ全文 / ダブルクリックで編集" style="font-size:10px;color:var(--text3);cursor:pointer" id="note-chip-${t.id}">📝 <span id="note-text-${t.id}">${escHtml(t.note.slice(0,25))}${t.note.length>25?'…':''}</span></span>`:''}
        </div>
      </div>
      <div class="task-actions" onclick="event.stopPropagation()">
        <!-- 完了チェックボックス -->
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:4px 6px;border-radius:6px;border:1px solid ${t.status==='done'?'var(--green)':'var(--border)'};background:${t.status==='done'?'var(--green-light)':'#fff'};transition:all .15s"
          title="完了にする"
          onmouseover="this.style.borderColor='var(--green)'"
          onmouseout="this.style.borderColor='${t.status==='done'?'var(--green)':'var(--border)'}'">
          <input type="checkbox" ${t.status==='done'?'checked':''} onchange="changeStatus(${t.id},this.checked?'done':'todo')"
            style="width:15px;height:15px;accent-color:var(--green);cursor:pointer;flex-shrink:0">
          <span style="font-size:10px;font-weight:700;color:${t.status==='done'?'var(--green)':'var(--text3)'};white-space:nowrap">${t.status==='done'?'完了':'完了'}</span>
        </label>
        <button class="icon-btn" onclick="quickEditToggle(event,${t.id})" title="クイック編集（期限・担当者）" style="font-size:13px">⚡</button>
        <button class="icon-btn" onclick="enterSelectMode(event,${t.id},'copy')" title="複製">📋</button>
        <button class="icon-btn" onclick="event.stopPropagation();openCommentModal(${t.id})" title="コメント" style="position:relative">💬${(t.comments||[]).length?`<span style="position:absolute;top:-3px;right:-3px;min-width:14px;height:14px;border-radius:7px;background:var(--accent);color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 2px">${(t.comments||[]).length}</span>`:''}</button>
        <button class="icon-btn" onclick="editTask(event,'${t.id}')" title="編集">✏️</button>
        <button class="icon-btn" onclick="enterSelectMode(event,${t.id},'delete')" title="削除">🗑</button>
      </div>
    </div>
    <!-- クイック編集バー -->
    <div class="quick-edit-bar" id="qe-${t.id}" onclick="event.stopPropagation()">
      <div class="qe-group">
        <span class="qe-label">期限日</span>
        <input class="qe-input" id="qe-due-${t.id}" type="datetime-local" value="${(t.due&&t.due.length>=16)?t.due.slice(0,16):''}" style="width:140px">
      </div>
      <div class="qe-group">
        <span class="qe-label">担当者</span>
        <select class="qe-input" id="qe-assignee-${t.id}" style="width:120px">
          <option value="">未割り当て</option>
          ${MEMBERS.map(m=>`<option value="${escHtml(m.id)}" ${t.assignee===m.id?'selected':''}>${escHtml(m.name)}</option>`).join('')}
        </select>
      </div>
      <div class="qe-group">
        <span class="qe-label">承認者</span>

      </div>
      <div class="qe-group">
        <span class="qe-label">メモ</span>
        <input class="qe-input" id="qe-note-${t.id}" value="${(t.note||'').replace(/"/g,'&quot;')}" placeholder="メモ" style="width:160px">
      </div>
      <button class="qe-save" onclick="saveQuickEdit(${t.id})">保存</button>
      <button class="qe-cancel" onclick="quickEditToggle(event,${t.id})">✕</button>
    </div>
    ${filesHTML?`<div style="padding:0 14px 8px">${filesHTML}</div>`:''}
    ${subtasksHTML}
  </div>`;
}

function expandCard(id){
  const card = document.getElementById('card-'+id);
  if(!card) return;
  const expanded = card.classList.toggle('expanded');
  const arrow = document.getElementById('arrow-'+id);
  if(arrow) arrow.style.transform = expanded ? 'rotate(90deg)' : 'rotate(0deg)';
  if(expanded){
    setTimeout(()=>document.getElementById('st-inp-'+id)?.focus(), 260);
  }
}

function toggleCard(id, event){
  // チェックボックスやボタンからのクリックは上位で stopPropagation 済み
  // カードクリック → 編集モーダルをダイレクトに開く
  // （選択モードはチェックボックスの onchange のみで制御）
  const e = event || window.event || {};
  const target = e.target || e.srcElement;
  // チェックボックス・ボタン・入力要素・子タスク行のクリックは無視
  if(target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON' ||
      target.tagName === 'A' || target.tagName === 'SELECT' ||
      target.tagName === 'TEXTAREA' || target.closest('.task-actions') ||
      target.closest('.quick-edit-bar') || target.closest('.subtask-inline') ||
      target.closest('.st-row') || target.closest('.st-qe-bar') ||
      target.closest('.subtask-wrap'))) return;
  const syntheticEvent = {stopPropagation: ()=>{}};
  editTask(syntheticEvent, id);
}

function changeStatus(id,status){
  event.stopPropagation();
  // プライベートタスクも対応
  let t = tasks.find(t=>String(t.id)===String(id));
  let isPriv = false;
  let priv = [];
  if(!t){
    priv = getPrivateTasks() || [];
    t = priv.find(t=>String(t.id)===String(id));
    isPriv = true;
  }
  if(!t) return;
  t.status = status;
  if(status==='done') t.completedAt = new Date().toISOString().split('T')[0];
  else delete t.completedAt;
  if(status==='done' && t.rep){
    let nextDue = '';
    const now = new Date();
    if(t.rep==='monthly'){
      if(t.repBizDay > 0){
        // 翌月の第N営業日
        const nextMonth = now.getMonth()+1 >= 12 ? 0 : now.getMonth()+1;
        const nextYear  = now.getMonth()+1 >= 12 ? now.getFullYear()+1 : now.getFullYear();
        const result = getNthBusinessDayOfMonth(t.repBizDay, nextYear, nextMonth);
        nextDue = `${result.getFullYear()}-${pad(result.getMonth()+1)}-${pad(result.getDate())}T17:00`;
      } else if(t.due){
        // 固定日：翌月の同日
        const nd = new Date(t.due);
        nd.setMonth(nd.getMonth()+1);
        nextDue = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())}T17:00`;
      }
    } else if(t.rep==='weekly' && t.due){
      const nd = new Date(t.due);
      nd.setDate(nd.getDate()+7);
      nextDue = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())}T17:00`;
    }
    if(nextDue){
      // ① 子タスクのステータスをリセット（チェックなし）
      // ② 開始日も次回の日付に更新
      const nextDueDate = nextDue.split('T')[0];
      const resetSubs = (t.subtasks||[]).map(s=>({
        ...s,
        id: 's'+Date.now()+Math.random(),
        status: 'todo',
        due: s.due ? (() => {
          // 子タスクの期限も同じオフセット分ずらす
          if(t.due && s.due){
            const diff = new Date(nextDueDate) - new Date(t.due.split('T')[0]);
            const nd = new Date(s.due.split('T')[0]);
            nd.setTime(nd.getTime() + diff);
            return `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())}`;
          }
          return s.due;
        })() : '',
      }));
      const newTask = {
        ...t,
        id: String(Date.now())+String(Math.random()).slice(2,7),
        due: nextDue,
        start: nextDueDate, // ② 開始日を次回日付に
        status: 'todo',
        comments: [],
        files: [],
        subtasks: resetSubs, // ① チェックリセット済みの子タスク
      };
      delete newTask.completedAt;
      if(isPriv){ priv.push(newTask); }
      else { tasks.push(newTask); }
      toast(`✅ 完了！次回分（${nextDueDate}）を自動生成しました`);
    }
  }
  if(isPriv){ savePrivateTasks(priv); }
  else { saveTasks(); }
  // 完了になったら完了済みビューへ自動移動
  if(status==='done'){
    const doneNav = document.querySelector('.nav-item[onclick*="done"]');
    if(doneNav){ setView('done', doneNav); }
    const calMsg = (isGasEnabled()&&t.assignee&&t.due) ? '　📅 カレンダー更新中...' : '';
    toast('✅ 完了しました → 完了済みに移動' + calMsg);
  } else {
    toast(`ステータスを「${STATUS_LABELS[status]}」に変更しました`);
  }
  renderAll();
  if(isGasEnabled()&&t.assignee&&t.due) autoSyncTaskToCalendar(t);
  // ステータス変更は重要操作 → 即時同期
  if(isGasEnabled()) immediateSync();
}

function addComment(id){
  if(!currentUser){toast('⚠ ユーザーを選択してください',true);return;}
  const input=document.getElementById('ci-'+id);
  const text=input.value.trim();if(!text)return;
  const t=tasks.find(t=>String(t.id)===String(id));if(!t)return;
  if(!t.comments)t.comments=[];
  const now=new Date();
  t.comments.push({id:'c'+Date.now(),userId:currentUser.id,text,at:`${now.getFullYear()}/${pad(now.getMonth()+1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`});
  saveTasks();
  input.value='';
  // カードを再描画
  const card=document.getElementById('card-'+id);
  const wasExpanded=card.classList.contains('expanded');
  renderTasks();
  if(wasExpanded){
    setTimeout(()=>{
      const newCard=document.getElementById('card-'+id);
      if(newCard){newCard.classList.add('expanded');const ci=document.getElementById('ci-'+id);if(ci)ci.focus();}
    },50);
  }
  toast('💬 コメントを送信しました');
}

function startInlineEdit(e,id){
  e.stopPropagation();
  const span=document.getElementById('title-text-'+id);
  const t=tasks.find(t=>String(t.id)===String(id));if(!t)return;
  const input=document.createElement('input');
  input.className='task-title-input';
  input.value=t.title;
  span.replaceWith(input);
  input.focus();input.select();
  const finish=(save)=>{
    const newTitle=input.value.trim();
    if(save&&newTitle&&newTitle!==t.title){
      t.title=newTitle;saveTasks();
      toast('✏️ タイトルを更新しました');
    }
    renderTasks();
    // 展開状態を維持
    setTimeout(()=>{
      const card=document.getElementById('card-'+id);
      if(card&&document.getElementById('arrow-'+id)?.style.transform==='rotate(90deg)'){
        card.classList.add('expanded');
      }
    },30);
  };
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();finish(true);}
    if(e.key==='Escape'){finish(false);}
    e.stopPropagation();
  });
  input.addEventListener('blur',()=>finish(true));
  input.addEventListener('click',e=>e.stopPropagation());
}

function quickEditToggle(e,id){
  e.stopPropagation();
  const card=document.getElementById('card-'+id);
  const isOpen=card.classList.toggle('quick-open');
  if(isOpen){
    setTimeout(()=>document.getElementById('qe-due-'+id)?.focus(),50);
  }
}

function previewDeadlineRule(){
  const el=document.getElementById('f-deadline-rule');
  const prev=document.getElementById('deadline-rule-preview');
  if(!el||!prev)return;
  const rule=el.value;
  if(rule==='fixed'){prev.textContent='';return;}
  const due=calcDeadlineFromRule(rule,new Date());
  if(due){
    prev.textContent=`→ 今月の期限日: ${due.replace(/-/g,'/')} (${ruleLabel(rule)})`;
    // 期限日フィールドに自動セット
    const dueEl=document.getElementById('f-due');
    if(dueEl)dueEl.value=due;
  }
}

function saveQuickEdit(id){
  const t=tasks.find(t=>String(t.id)===String(id));if(!t)return;
  t.due=document.getElementById('qe-due-'+id)?.value||t.due;
  t.assignee=document.getElementById('qe-assignee-'+id)?.value||'';
  t.approver=document.getElementById('qe-approver-'+id)?.value||'';
  t.note=document.getElementById('qe-note-'+id)?.value||'';
  saveTasks();
  const card=document.getElementById('card-'+id);
  card.classList.remove('quick-open');
  renderAll();
  toast('💾 更新しました');
}

function pasteAsNew(e,id){
  e.stopPropagation();
  const src=tasks.find(t=>String(t.id)===String(id));if(!src)return;
  clipboard={...src};
  // カードにフラッシュ演出
  const card=document.getElementById('card-'+id);
  card.classList.add('copied');
  setTimeout(()=>card.classList.remove('copied'),400);
  toast('📋 コピーしました（Ctrl+Vでペースト）');
}

function pasteTask(){
  if(!clipboard){toast('⚠ コピーされたタスクがありません',true);return;}
  const newTask={
    ...clipboard,
    id:Date.now(),
    title:clipboard.title+' (コピー)',
    status:'todo',
    comments:[],
    subtasks:[],
    files:[],
  };
  tasks.push(newTask);
  saveTasks();renderAll();
  // 追加したカードにスクロール
  setTimeout(()=>{
    const card=document.getElementById('card-'+newTask.id);
    card?.scrollIntoView({behavior:'smooth',block:'center'});
    card?.classList.add('copied');
    setTimeout(()=>card?.classList.remove('copied'),600);
  },100);
  toast('📋 ペーストしました');
}

function handleCardKey(e,id){
  if((e.ctrlKey||e.metaKey)&&e.key==='c'){
    e.preventDefault();
    pasteAsNew(e,id);
  }
}

function renderTodaySummary(){
  const el = document.getElementById('today-summary-content');
  if(!el) return;
  const ts = fmt(new Date());
  // viewModeに応じて集計対象を切り替え（左ナビと統一）
  const privTasks2 = currentUser ? getPrivateTasks().map(t=>({...t,_isPrivate:true})) : [];
  let all;
  if(viewMode === 'personal' && currentUser){
    // 個人ビュー：自分のタスクのみ
    all = [...tasks, ...privTasks2].filter(t => t.assignee === currentUser.id);
  } else {
    // チームビュー：チーム＋個人（privateは自分のもののみ）
    const allBase = [...tasks, ...privTasks2];
    all = allBase.filter(t => !t.private || (currentUser && t.assignee === currentUser.id));
  }
  const todayTasks  = all.filter(t=>t.status!=='done'&&t.due&&t.due.split('T')[0]===ts);
  const overdue     = all.filter(t=>t.status!=='done'&&t.due&&t.due.split('T')[0]<ts);
  const inprogress  = all.filter(t=>t.status==='inprogress');
  const doneToday   = all.filter(t=>t.status==='done'&&t.completedAt===ts);
  const now = new Date();
  const greet = now.getHours()<12?'おはようございます':'お疲れさまです';
  el.innerHTML = `
    <div style="padding:12px 14px">
      <!-- チーム/個人切替（ダッシュボードに一本化） -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">
        <button id="db-btn-team" onclick="setViewMode('team')"
          style="padding:8px 6px;border-radius:8px;border:2px solid ${viewMode!=='personal'?'var(--accent)':'var(--border)'};background:${viewMode!=='personal'?'var(--accent)':'#fff'};color:${viewMode!=='personal'?'#fff':'var(--text2)'};font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font);transition:all .15s;text-align:center">
          👥 <span style="font-size:11px">チーム</span>
        </button>
        <button id="db-btn-personal" onclick="setViewMode('personal')"
          style="padding:8px 6px;border-radius:8px;border:2px solid ${viewMode==='personal'?'#0ea5e9':'var(--border)'};background:${viewMode==='personal'?'#0ea5e9':'#fff'};color:${viewMode==='personal'?'#fff':'var(--text2)'};font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font);transition:all .15s;text-align:center">
          👤 <span style="font-size:11px">個人</span>
        </button>
      </div>
      <div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:4px">${greet}${currentUser?'、'+currentUser.name+'さん':''} 👋</div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:10px">${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日（${'日月火水木金土'[now.getDay()]}）</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div onclick="jumpToView('today')" style="background:#fff;border-radius:8px;padding:8px 10px;border:1px solid var(--border);cursor:pointer;transition:all .12s"
          onmouseover="this.style.borderColor='#f59e0b';this.style.background='#fffbeb'"
          onmouseout="this.style.borderColor='var(--border)';this.style.background='#fff'">
          <div style="font-size:18px;font-weight:800;color:${todayTasks.length?'#f59e0b':'var(--text3)'}">${todayTasks.length}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:1px">今日期限</div>
        </div>
        <div onclick="jumpToView('overdue')" style="background:#fff;border-radius:8px;padding:8px 10px;border:1px solid var(--border);cursor:pointer;transition:all .12s"
          onmouseover="this.style.borderColor='var(--red)';this.style.background='#fef2f2'"
          onmouseout="this.style.borderColor='var(--border)';this.style.background='#fff'">
          <div style="font-size:18px;font-weight:800;color:${overdue.length?'var(--red)':'var(--text3)'}">${overdue.length}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:1px">期限超過</div>
        </div>
        <div onclick="jumpToView('inprogress')" style="background:#fff;border-radius:8px;padding:8px 10px;border:1px solid var(--border);cursor:pointer;transition:all .12s"
          onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--accent-light)'"
          onmouseout="this.style.borderColor='var(--border)';this.style.background='#fff'">
          <div style="font-size:18px;font-weight:800;color:${inprogress.length?'var(--accent)':'var(--text3)'}">${inprogress.length}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:1px">進行中</div>
        </div>
        <div onclick="jumpToView('done')" style="background:#fff;border-radius:8px;padding:8px 10px;border:1px solid var(--border);cursor:pointer;transition:all .12s"
          onmouseover="this.style.borderColor='var(--green)';this.style.background='#f0fdf4'"
          onmouseout="this.style.borderColor='var(--border)';this.style.background='#fff'">
          <div style="font-size:18px;font-weight:800;color:${doneToday.length?'var(--green)':'var(--text3)'}">${doneToday.length}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:1px">今日完了</div>
        </div>
      </div>
    </div>`;
}

function renderApprovals(){
  const el=document.getElementById('approval-list');
  const pending=tasks.filter(t=>t.status==='review'&&t.approver);
  if(!pending.length){el.innerHTML='<div style="font-size:11px;color:var(--text3)">承認待ちタスクなし</div>';return;}
  const myApprovals=currentUser?pending.filter(t=>t.approver===currentUser.id):pending;
  if(!myApprovals.length){el.innerHTML='<div style="font-size:11px;color:var(--text3)">あなたの承認待ちなし</div>';return;}
  el.innerHTML=myApprovals.map(t=>{
    const member=MEMBERS.find(m=>m.id===t.assignee);
    const due=t.due?t.due.split('T')[0].replace(/-/g,'/'):'';
    return `<div class="approval-item" style="flex-direction:column;align-items:stretch;cursor:pointer"
      onclick="toggleApprovalDetail(${t.id})">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;font-size:12px;font-weight:600;color:var(--text)">${escHtml(t.title)}</div>
        <button class="appr-btn ok" onclick="event.stopPropagation();approve('${t.id}',true)">✓ 承認</button>
        <button class="appr-btn ng" onclick="event.stopPropagation();approve('${t.id}',false)">✕ 差戻</button>
      </div>
      <!-- 詳細エリア（初期非表示） -->
      <div id="appr-detail-${t.id}" style="display:none;margin-top:8px;padding:8px 10px;background:var(--surface2);border-radius:6px;border:1px solid var(--border)">
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">
          ${member?`<span style="font-size:11px;display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${member.color};display:inline-block"></span>${member.name}</span>`:''}
          ${due?`<span style="font-size:11px;color:var(--text3)">📅 ${due}</span>`:''}
          <span style="font-size:11px;color:var(--text3)">${CAT_LABELS[t.cat]||t.cat}</span>
        </div>
        ${t.note?`<div style="font-size:11px;color:var(--text2);line-height:1.6">📝 ${t.note}</div>`:''}
        ${t.comments&&t.comments.length?`
          <div style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px">
            <div style="font-size:10px;font-family:var(--mono);color:var(--text3);margin-bottom:4px">コメント</div>
            ${t.comments.slice(-2).map(c=>{
              const u=MEMBERS.find(m=>m.id===c.userId);
              return `<div style="font-size:11px;color:var(--text2);margin-bottom:3px">
                <span style="font-weight:600">${u?u.name:'?'}</span>: ${c.text}
              </div>`;
            }).join('')}
          </div>`:''}
        <div style="margin-top:8px;text-align:right">
          <button onclick="event.stopPropagation();focusTask(${t.id})" style="font-size:11px;padding:3px 10px;border-radius:5px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent);cursor:pointer;font-family:var(--font)">タスクを開く →</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleApprovalDetail(id){
  const el=document.getElementById('appr-detail-'+id);
  if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
}

function approve(id,ok,reason){
  const t=tasks.find(t=>String(t.id)===String(id));if(!t)return;
  if(!currentUser){toast('⚠ ユーザーを選択してください',true);return;}

  // 差し戻し時は理由入力ダイアログ
  if(!ok&&reason===undefined){
    const r=prompt('差し戻し理由を入力してください（任意）：','');
    if(r===null)return; // キャンセル
    approve(id,ok,r||'');
    return;
  }

  const prevStatus=t.status;
  t.status=ok?'done':'inprogress';

  // ── 承認ログ記録 ──
  const now=new Date();
  const logEntry={
    id:'log'+Date.now(),
    taskId:t.id,
    taskTitle:t.title,
    taskCat:t.cat,
    action:ok?'approved':'rejected',
    approverName:currentUser.name,
    approverId:currentUser.id,
    assigneeName:MEMBERS.find(m=>m.id===t.assignee)?.name||'未割り当て',
    reason:reason||'',
    prevStatus,
    newStatus:t.status,
    at:now.toISOString(),
    atLabel:`${now.getFullYear()}/${pad(now.getMonth()+1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
  approvalLogs.unshift(logEntry); // 新しい順
  saveLogs();

  saveTasks();renderAll();
  toast(ok?`✅ 承認しました「${t.title}」`:`↩ 差し戻しました「${t.title}」`);
}

function renderReminders(){
  const el=document.getElementById('reminder-list');
  const ts=fmt(T);
  const items=[];

  // 期限切れ（未完了 & due < today）
  tasks.filter(t=>t.status!=='done'&&t.due&&t.due.split('T')[0]<ts).forEach(t=>{
    const d=new Date(t.due.split('T')[0]);d.setHours(0,0,0,0);
    const df=Math.floor((T-d)/86400000);
    items.push({t,df,type:'overdue'});
  });

  // リマインド期間内（未完了 & remind設定あり & due >= today）
  tasks.filter(t=>t.status!=='done'&&t.due&&t.remind&&t.due.split('T')[0]>=ts).forEach(t=>{
    const d=new Date(t.due.split('T')[0]);d.setHours(0,0,0,0);
    const df=Math.floor((d-T)/86400000);
    if(df<=parseInt(t.remind))items.push({t,df,type:'remind'});
  });

  // 期限切れ → 古い順、リマインド → 近い順
  items.sort((a,b)=>{
    if(a.type==='overdue'&&b.type==='overdue') return b.df-a.df; // 超過日数が多い順
    if(a.type==='overdue') return -1;
    if(b.type==='overdue') return 1;
    return a.df-b.df;
  });

  if(!items.length){el.innerHTML='<div style="font-size:11px;color:var(--text3)">リマインドなし ✓</div>';return;}

  el.innerHTML=items.map(({t,df,type})=>{
    const member=MEMBERS.find(m=>m.id===t.assignee);
    if(type==='overdue'){
      const when=df===0?'今日が期限':`${df}日超過`;
      return `<div class="remind-item" onclick="highlightTask(${t.id})" ondblclick="focusTask(${t.id})" style="cursor:pointer" title="クリック:スクロール / ダブルクリック:このタスクのみ表示">
        <div class="remind-dot red"></div>
        <div style="flex:1">
          <div class="remind-text">⚠ ${escHtml(t.title)}</div>
          <div class="remind-who">${when}（${t.due.split('T')[0]}）${member?' · '+member.name:''}</div>
        </div>
      </div>`;
    } else {
      const dot=df===0?'red':df<=2?'yellow':'green';
      const when=df===0?'今日が期限':`あと${df}日`;
      return `<div class="remind-item" onclick="highlightTask(${t.id})" ondblclick="focusTask(${t.id})" style="cursor:pointer" title="クリック:スクロール / ダブルクリック:このタスクのみ表示">
        <div class="remind-dot ${dot}"></div>
        <div style="flex:1">
          <div class="remind-text">${escHtml(t.title)}</div>
          <div class="remind-who">${when}（${t.due.split('T')[0]}）${member?' · '+member.name:''}</div>
        </div>
      </div>`;
    }
  }).join('');
}

function getVals(title){
  return{
    title,
    cat:document.getElementById('f-cat').value,
    start:'',
    due:document.getElementById('f-due').value,
    remind:document.getElementById('f-remind').value,
    note:document.getElementById('f-note').value.trim(),
    rep:document.getElementById('f-rep').value,
    repBizDay: parseInt(document.getElementById('f-rep-biz')?.value||'0')||0,
    private: document.getElementById('f-scope-private')?.checked || false,
    leavePersonLink:document.getElementById('f-leave-person')?.value||'',
    isPrivate: document.getElementById('f-share-private')?.checked || false,
    deadlineRule:(()=>{const el=document.getElementById('f-deadline-rule');return el?el.value:'fixed';})(),
    status:document.getElementById('f-status').value,
    assignee:document.getElementById('f-assignee').value,
    approver:(document.getElementById('f-approver')||{value:''}).value,
    files:editFiles,
  };
}

function saveTask(){
  const title=document.getElementById('f-title').value.trim();
  if(!title){toast('⚠ タスク名を入力してください',true);return;}
  const v=getVals(title);

  const isPrivate = v.isPrivate;
  let savedTask;

  if(editId){
    // 編集：チーム or 個人どちらにあるか探す
    let t = tasks.find(t=>String(t.id)===String(editId));
    if(!t){
      const priv = getPrivateTasks();
      t = priv.find(t=>String(t.id)===String(editId));
      if(t){
        Object.assign(t,v);
        if(!t.comments)t.comments=[];
        savePrivateTasks(priv);
        savedTask=t;
        closeModal('modal-overlay');renderAll();
        toast('🔒 個人タスクを保存しました');
        // 個人タスクのカレンダー同期（自分のカレンダーのみ）
        if(isGasEnabled()&&savedTask.due){
          const selfMember = currentUser ? MEMBERS.find(m=>m.id===currentUser.id) : null;
          if(selfMember && selfMember.email) autoSyncTaskToCalendar({...savedTask, assignee: selfMember.id});
        }
        if(isGasEnabled()) immediateSync();
        return;
      }
    } else {
      Object.assign(t,v);
      if(!t.comments)t.comments=[];
      savedTask=t;
    }
  } else {
    // 重複チェック
    const allTasks = [...tasks, ...(getPrivateTasks()||[])];
    const dups = allTasks.filter(t => t.title.trim() === title);
    if(dups.length > 0){
      const info = dups.map(t => {
        const m = MEMBERS.find(m=>m.id===t.assignee);
        const st = {todo:'未着手',inprogress:'進行中',review:'承認待ち',done:'完了'}[t.status]||t.status;
        const due = t.due ? ' / ' + t.due.split('T')[0] : '';
        return '・' + t.title + '（' + st + (m?' / '+m.name:'') + due + '）';
      }).join('\n');
      if(!confirm('同じタイトルのタスクが' + dups.length + '件あります。\n\n' + info + '\n\n重複して作成しますか？')) return;
    }
    savedTask={id:String(Date.now()),...v,comments:[]};
    if(isPrivate){
      const priv = getPrivateTasks();
      priv.push(savedTask);
      savePrivateTasks(priv);
      closeModal('modal-overlay');renderAll();
      toast('🔒 個人タスクとして保存しました');
      // 個人タスクのカレンダー同期（自分のカレンダーのみ）
      if(isGasEnabled()&&savedTask.due){
        const selfMemberNew = currentUser ? MEMBERS.find(m=>m.id===currentUser.id) : null;
        if(selfMemberNew && selfMemberNew.email) autoSyncTaskToCalendar({...savedTask, assignee: selfMemberNew.id});
      }
      if(isGasEnabled()) immediateSync();
      return;
    }
    tasks.push(savedTask);
  }

  saveTasks();closeModal('modal-overlay');renderAll();
  toast('💾 保存しました');
  // 個人タスクも期限があればカレンダー同期（自分のカレンダーのみ）
  if(isGasEnabled()&&savedTask.due){
    if(!savedTask.private){
      // チームタスク：担当者のカレンダーに同期
      if(savedTask.assignee) autoSyncTaskToCalendar(savedTask);
    } else {
      // 個人タスク：自分のカレンダーのみに同期
      const selfMember = currentUser ? MEMBERS.find(m=>m.id===currentUser.id) : null;
      if(selfMember && selfMember.email) autoSyncTaskToCalendar({...savedTask, assignee: selfMember.id});
    }
  }
  // scheduleAutoSyncが3秒後に自動アップロードするため個別のsyncData不要
  // 削除・ステータス変更の場合は即時同期
  if(editId && isGasEnabled()) immediateSync();
}

function copyTask(e,id){
  e.stopPropagation();
  // String型IDで検索（チームタスク → 個人タスクの順）
  let src = tasks.find(t=>String(t.id)===String(id));
  let isPriv = false;
  let priv = [];
  if(!src){
    priv = getPrivateTasks();
    src = priv.find(t=>String(t.id)===String(id));
    isPriv = true;
  }
  if(!src) return;
  // JSON.parse/stringifyでディープコピー（ネスト参照を完全分離）
  const newTask = JSON.parse(JSON.stringify({...src, id:'task_'+String(Date.now())+'_'+Math.random().toString(36).substring(2,9), title:src.title+' (コピー)', status:'todo', comments:[], files:[]}));
  if(isPriv){
    priv.push(newTask);
    savePrivateTasks(priv);
  } else {
    tasks.push(newTask);
    saveTasks();
  }
  renderAll();
  toast('📋 コピーしました');
}

function editTask(e,id){
  e.stopPropagation();
  // String型IDで検索（チームタスク → 個人タスクの順）
  let t = tasks.find(t=>String(t.id)===String(id));
  let isPrivate = false;
  if(!t){
    t = getPrivateTasks().find(t=>String(t.id)===String(id));
    isPrivate = true;
  }
  if(!t) return;

  // editIdをセット（openModal()を呼ばないため先にセット）
  editId = String(id);
  editFiles = [...(t.files||[])];

  // フォームに値を流し込む
  document.getElementById('modal-title').textContent = 'タスクを編集';
  document.getElementById('f-title').value = t.title || '';
  document.getElementById('f-cat').value = t.cat || 'other';
  document.getElementById('f-status').value = t.status || 'todo';
  document.getElementById('f-remind').value = t.remind || '';
  document.getElementById('f-note').value = t.note || '';
  document.getElementById('f-rep').value = t.rep || '';


  // 期限日時
  const dueParts = (t.due || '').split('T');
  const dueDateEl = document.getElementById('f-due-date');
  const dueTimeEl = document.getElementById('f-due-time');
  const dueHiddenEl = document.getElementById('f-due');
  if(dueDateEl) dueDateEl.value = dueParts[0] || '';
  if(dueTimeEl) dueTimeEl.value = (dueParts[1] || '17:00').substring(0, 5);
  if(dueHiddenEl) dueHiddenEl.value = t.due || '';

  // 繰り返し設定
  const repBizEl = document.getElementById('f-rep-biz');
  if(repBizEl) repBizEl.value = t.repBizDay || '';
  toggleRepOptions();

  // 期限ルール
  const drEl = document.getElementById('f-deadline-rule');
  if(drEl) drEl.value = t.deadlineRule || 'fixed';
  if(typeof previewDeadlineRule === 'function') previewDeadlineRule();

  // 担当者・承認者
  populateAssigneeSelects();
  document.getElementById('f-assignee').value = t.assignee || '';
  const approverEl2=document.getElementById('f-approver');if(approverEl2)approverEl2.value=t.approver||'';
  populateLeavePersonSelect(t.leavePersonLink || '');

  // 公開範囲
  const scopeEl = document.getElementById(t.private ? 'f-scope-private' : 'f-scope-team');
  if(scopeEl){ scopeEl.checked = true; updateScopeStyle(); }

  // 共有設定
  const shareEl = document.getElementById(t.isPrivate ? 'f-share-private' : 'f-share-team');
  if(shareEl){ shareEl.checked = true; onShareChange(); }

  // ファイル添付
  renderEditFiles();

  // 詳細設定を開いた状態にする
  const detailBody = document.getElementById('modal-detail-body');
  const detailArrow = document.getElementById('modal-detail-arrow');
  if(detailBody) detailBody.style.display = 'block';
  if(detailArrow) detailArrow.style.transform = 'rotate(90deg)';

  // コメントセクションを表示
  const cmSection = document.getElementById('modal-comment-section');
  const cmTaskId = document.getElementById('cm-task-id');
  if(cmSection) cmSection.style.display = 'block';
  if(cmTaskId) cmTaskId.value = String(id);
  renderComments(t);

  // モーダルを直接開く（openModal()はeditId=nullにリセットするため呼ばない）
  document.getElementById('modal-overlay').classList.add('open');
}

function delTask(e,id){
  e.stopPropagation();if(!confirm('削除しますか？'))return;
  const t=tasks.find(t=>String(t.id)===String(id));
  // カレンダーから削除（非同期）
  if(t&&t.assignee&&isGasEnabled()){
    const member=MEMBERS.find(m=>m.id===t.assignee);
    if(member&&member.email) autoDeleteTaskFromCalendar(id, t.title, member);
  }
  tasks=tasks.filter(t=>String(t.id)!==String(id));saveTasks();renderAll();toast('🗑 削除しました');
  if(isGasEnabled()) immediateSync();
}

function setView(v,el){
  view=v; statusFilt='all'; overdueFilter=false;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(el) el.classList.add('active');
  renderTasks(); renderStats();
}

function setFilter(f,el){
  statusFilt=f; overdueFilter=false;
  document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderTasks();
}

function openCsvModal(){
  modalShow('csv-modal-overlay');
  document.getElementById('csv-preview').style.display='none';
  document.getElementById('csv-file-input').value='';
  document.getElementById('csv-import-btn').disabled=true;
  document.getElementById('csv-import-btn').style.opacity='.4';
}

function closeCsvModal(){
  modalHide('csv-modal-overlay');
}

function downloadCsvTemplate(){
  const memberNames = MEMBERS.map(m=>m.name).join(' / ');
  const rows = [
    CSV_HEADERS,
    ['勤怠データ確認・修正','給与計算','2026-05-13','2026-05-15','','','1','毎月','打刻漏れ・遅刻早退の確認','打刻データ確認','遅刻・早退リスト作成','','',''],
    ['給与計算','給与計算','2026-05-16','2026-05-20','','','3','毎月','勤怠締め後に開始','計算シート作成','明細確認','振込データ作成','',''],
    ['入社手続き','入社・退職','2026-05-01','2026-05-10','','','3','','当月入社者分','社保加入手続き','雇用保険加入','労働条件通知書交付','',''],
  ];
  const bom = '\uFEFF';
  const csv = bom + rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=u; a.download='roumu-tasks-template.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
  toast('📄 テンプレートをダウンロードしました');
}

function parseCsvLine(line){
  const result=[]; let cur='', inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(inQ&&line[i+1]==='"'){cur+='"';i++;}
      else inQ=!inQ;
    } else if(c===','&&!inQ){result.push(cur.trim());cur='';}
    else cur+=c;
  }
  result.push(cur.trim());
  return result;
}

function previewCsv(event){
  const file = event.target.files[0];
  if(!file) return;

  // UTF-8で読んでBOMなし文字化けしたらShift-JISで再読み込み
  const tryRead = (encoding) => {
    const reader = new FileReader();
    reader.onload = e => {
      let text = e.target.result;
      if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
      // 文字化けチェック（?が多い場合はShift-JIS試行）
      if(encoding==='UTF-8' && (text.match(/\?{3,}/)||[]).length > 3){
        tryRead('Shift-JIS'); return;
      }
      processCsvText(text);
    };
    reader.readAsText(file, encoding);
  };
  tryRead('UTF-8');
}

function processCsvText(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length < 2){ showCsvError('データ行がありません'); return; }

  const header = parseCsvLine(lines[0]);
  const REQUIRED_HEADERS = ['タイトル'];
  const missing = REQUIRED_HEADERS.filter(h=>!header.includes(h));
  if(missing.length){ showCsvError(`列が不足しています: ${missing.join(', ')}`); return; }

  parsedCsvRows = [];
  const errors = [];
  for(let i=1;i<lines.length;i++){
    const vals = parseCsvLine(lines[i]);
    const row = {};
    header.forEach((h,j)=>{ row[h] = vals[j]||''; });
    if(!row['タイトル']){ errors.push(`${i+1}行目: タイトルが空です`); continue; }
    parsedCsvRows.push(row);
  }

  const preview = document.getElementById('csv-preview');
  const table = document.getElementById('csv-preview-table');
  const label = document.getElementById('csv-preview-label');
  label.textContent = `${parsedCsvRows.length}件のタスクを検出`;
  const cols = ['タイトル','カテゴリ','開始日','期限日','担当者'];
  table.innerHTML = '<thead><tr>'+cols.map(c=>`<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border);color:var(--text3);font-weight:600">${c}</th>`).join('')+'</tr></thead><tbody>'+
    parsedCsvRows.slice(0,10).map(r=>'<tr>'+cols.map(c=>`<td style="padding:5px 8px;border-bottom:1px solid var(--border)">${r[c]||'—'}</td>`).join('')+'</tr>').join('')+
    (parsedCsvRows.length>10?`<tr><td colspan="${cols.length}" style="padding:5px 8px;color:var(--text3);text-align:center">… 他${parsedCsvRows.length-10}件</td></tr>`:'')+'</tbody>';

  document.getElementById('csv-errors').innerHTML = errors.map(e=>`⚠ ${escHtml(String(e))}`).join('<br>');
  preview.style.display = 'block';

  const btn = document.getElementById('csv-import-btn');
  if(parsedCsvRows.length > 0){ btn.disabled=false; btn.style.opacity='1'; }
}

function showCsvError(msg){
  document.getElementById('csv-preview').style.display='block';
  document.getElementById('csv-preview-label').textContent='';
  document.getElementById('csv-preview-table').innerHTML='';
  document.getElementById('csv-errors').textContent='⚠ '+msg;
  document.getElementById('csv-import-btn').disabled=true;
  document.getElementById('csv-import-btn').style.opacity='.4';
}

function importCsv(){
  if(!parsedCsvRows.length) return;
  if(!confirm(`既存のタスク${tasks.length}件を削除し、${parsedCsvRows.length}件を取り込みます。よろしいですか？`)) return;

  let nextId = 1;
  tasks = parsedCsvRows.map(row => {
    const memberByName = name => MEMBERS.find(m=>m.name===name.trim())?.id||'';
    const cat = CAT_MAP[row['カテゴリ']] || 'other';
    // 子タスク列（子タスク1〜5）を取り込む
    const subtasks = ['子タスク1','子タスク2','子タスク3','子タスク4','子タスク5']
      .map(k => row[k]?.trim())
      .filter(Boolean)
      .map(title => ({ id:'s'+Date.now()+Math.random(), title, status:'todo' }));
    return {
      id: nextId++,
      title: row['タイトル'],
      cat,
      start: row['開始日']||'',
      due: row['期限日']||'',
      assignee: memberByName(row['担当者']),
      approver: memberByName(row['承認者']),
      remind: row['リマインド']||'',
      rep: REP_MAP[row['繰り返し']]||'',
      note: row['メモ']||'',
      status: 'todo',
      comments: [],
      files: [],
      subtasks,
    };
  });

  saveTasks();
  renderAll();
  closeCsvModal();
  toast(`✅ ${tasks.length}件のタスクを取り込みました`);
}
