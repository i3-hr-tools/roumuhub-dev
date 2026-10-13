// ══ 年間プロジェクト機能 ══

function saveAnnualProjects(){ localStorage.setItem('annual_projects', JSON.stringify(annualProjects)); scheduleAutoSync(); }

function renderAnnualProjects(){
  // 専用パネル内のエリアを使用
  const el = document.getElementById('annual-area-panel') || document.getElementById('annual-area');
  if(!el) return;
  el.innerHTML = `
    <div style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--shadow-sm)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border)">
        <span style="font-size:14px;font-weight:700">📊 年次業務</span>
        <button onclick="openAnnualProjectModal()" class="btn btn-primary" style="font-size:11px;padding:5px 10px">＋ プロジェクト追加</button>
      </div>
      ${annualProjects.length===0
        ? '<div style="padding:32px;text-align:center;font-size:12px;color:var(--text3)">「＋ プロジェクト追加」からプロジェクトを登録してください</div>'
        : annualProjects.map((proj,pi)=>renderAnnualProjectCard(proj,pi)).join('')
      }
    </div>`;
}

function renderAnnualProjectCard(proj,pi){
  const done=proj.tasks.filter(t=>t.status==='done').length;
  const total=proj.tasks.length;
  const pct=total?Math.round(done/total*100):0;
  const status=pct===100?'done':pct>0?'inprogress':'todo';
  const stColor=ANNUAL_STATUS_COLORS[status];
  const stLabel=ANNUAL_STATUS_LABELS[status];
  const member=MEMBERS.find(m=>m.id===proj.assignee);
  const isOpen=proj._open;
  return `
    <div style="border-bottom:1px solid var(--border)">
      <div onclick="toggleAnnualProject(${pi})" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:${status==='done'?'#f0fdf4':status==='inprogress'?'#fffbeb':'#fff'};transition:background .12s"
        onmouseover="this.style.background='var(--accent-light)'" onmouseout="this.style.background='${status==='done'?'#f0fdf4':status==='inprogress'?'#fffbeb':'#fff'}'">
        <span style="font-size:12px;color:var(--text3);transition:transform .2s;display:inline-block;transform:${isOpen?'rotate(90deg)':'rotate(0deg)'}" id="annual-arrow-${pi}">▶</span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <span style="font-size:13px;font-weight:700;color:var(--text)">${proj.name}</span>
            <span style="font-size:11px;font-family:var(--mono);padding:1px 7px;border-radius:8px;background:var(--surface2);color:var(--text3)">${proj.year}年</span>
            <span style="font-size:11px;padding:2px 8px;border-radius:8px;background:${stColor}22;color:${stColor};border:1px solid ${stColor}44;font-weight:700">${stLabel}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="flex:1;max-width:200px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;background:${pct===100?'var(--green)':pct>0?'#f59e0b':'var(--border)'};width:${pct}%;transition:width .3s"></div>
            </div>
            <span style="font-size:11px;font-family:var(--mono);color:var(--text3)">${done}/${total} (${pct}%)</span>
            ${member?`<div style="display:flex;align-items:center;gap:4px"><span style="width:18px;height:18px;border-radius:50%;background:${member.color};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff">${member.initial}</span><span style="font-size:11px;color:var(--text2)">${member.name}</span></div>`:''}
            ${proj.startDate?`<span style="font-size:10px;color:var(--text3);font-family:var(--mono)">開始:${proj.startDate}</span>`:''}
            ${proj.deadline?`<span style="font-size:10px;color:var(--text3);font-family:var(--mono)">期限:${proj.deadline}</span>`:''}
            ${proj.link?`<a href="${proj.link}" target="_blank" style="font-size:10px;padding:1px 8px;border-radius:6px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent);text-decoration:none;white-space:nowrap" onclick="event.stopPropagation()">🔗 ${proj.linkLabel||'資料'}</a>`:''}
          </div>
        </div>
        <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
          <button onclick="pushAnnualToTasks(${pi})" class="btn btn-ghost" style="font-size:11px;padding:4px 8px" title="タスク管理に追加">📋 タスクへ</button>
          <button onclick="openAnnualCsvModal(${pi})" class="btn btn-ghost" style="font-size:11px;padding:4px 8px" title="CSVで取り込む">📥 CSV</button>
          <button onclick="createNextYearProject(${pi})" class="btn btn-ghost" style="font-size:11px;padding:4px 8px" title="来年分を作成">📅 来年分</button>
          <button onclick="editAnnualProject(${pi})" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer"
            onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">✏️</button>
          <button onclick="deleteAnnualProject(${pi})" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer"
            onmouseover="this.style.background='var(--red)';this.style.color='#fff'" onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑</button>
        </div>
      </div>
      ${isOpen?renderAnnualChecklist(proj,pi):''}
    </div>`;
}

function renderAnnualChecklist(proj,pi){
  const member=MEMBERS.find(m=>m.id===proj.assignee);
  return `
    <div style="padding:12px 16px 16px 44px;background:#fafafa;border-top:1px solid var(--border)">
      <!-- 一括操作バー -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed var(--border)">
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;color:var(--text2)">
          <input type="checkbox" id="annual-select-all-${pi}" onchange="toggleSelectAllAnnualTasks(${pi},this.checked)"
            style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer">
          全選択
        </label>
        <span id="annual-selected-count-${pi}" style="font-size:11px;color:var(--text3)"></span>
        <button onclick="bulkDeleteAnnualTasks(${pi})" id="annual-bulk-delete-${pi}"
          style="display:none;font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;font-family:var(--font)"
          onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
          onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑 選択削除</button>
        <span style="margin-left:auto;font-size:10px;color:var(--text3)">☰ ドラッグで並び替え</span>
      </div>
      <!-- タスク一覧 -->
      <div id="annual-task-list-${pi}" ondragover="event.preventDefault()">
      ${proj.tasks.map((t,ti)=>{
        const tm=MEMBERS.find(m=>m.id===t.assignee)||member;
        const isDone=t.status==='done';
        const isOverdue=t.due&&new Date(t.due)<new Date()&&!isDone;
        const memberOpts='<option value="">-</option>'+MEMBERS.map(m=>`<option value="${escHtml(m.id)}" ${t.assignee===m.id?'selected':''}>${escHtml(m.name)}</option>`).join('');
        return `<div class="annual-task-row" draggable="true"
          data-pi="${pi}" data-ti="${ti}"
          ondragstart="annualDragStart(event,${pi},${ti})"
          ondragover="annualDragOver(event,${pi},${ti})"
          ondragleave="annualDragLeave(event)"
          ondrop="annualDrop(event,${pi},${ti})"
          ondragend="annualDragEnd(event)"
          style="border:1px solid ${isDone?'#bbf7d0':'var(--border)'};border-radius:8px;background:${isDone?'#f0fdf4':'#fff'};margin-bottom:6px;overflow:hidden;transition:opacity .15s">
          <div ondblclick="toggleAnnualTaskEdit(${pi},${ti})" style="display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:default">
            <!-- ドラッグハンドル -->
            <span style="color:var(--text3);cursor:grab;font-size:14px;flex-shrink:0;user-select:none" title="ドラッグで並び替え">☰</span>
            <input type="checkbox" class="annual-task-chk-${pi}" data-ti="${ti}"
              onchange="updateAnnualBulkBar(${pi})" onclick="event.stopPropagation()"
              style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;flex-shrink:0">
            <input type="checkbox" ${isDone?'checked':''} onchange="toggleAnnualTask(${pi},${ti},this.checked)"
              style="width:16px;height:16px;accent-color:var(--green);cursor:pointer;flex-shrink:0">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:${isDone?'var(--text3)':'var(--text)'};text-decoration:${isDone?'line-through':'none'}">${escHtml(t.title)}</div>
              <div style="display:flex;gap:8px;margin-top:2px;flex-wrap:wrap">
                ${t.due?`<span style="font-size:10px;color:${isOverdue?'var(--red)':'var(--text3)'};font-family:var(--mono)">📅 ${t.due}${isOverdue?' ⚠':''}</span>`:'<span style="font-size:10px;color:var(--text3)">📅 期限未設定</span>'}
                ${tm?`<span style="font-size:10px;color:var(--text3)">👤 ${tm.name}</span>`:''}
                ${t.note&&!t.note.includes('毎年最初')?`<span onclick='event.stopPropagation();toggleAnnualNote(${pi},${ti})' id='an-chip-${pi}-${ti}' style='font-size:10px;color:var(--text3);cursor:pointer;padding:1px 6px;border-radius:4px;background:var(--surface2);border:1px solid var(--border);display:inline-flex;align-items:center;gap:3px' title='クリックでメモを展開'>📝 <span id='an-text-${pi}-${ti}' style='max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom'>${t.note.slice(0,15)}${t.note.length>15?'…':''}</span> <span id='an-arr-${pi}-${ti}'>▾</span></span><div id='an-exp-${pi}-${ti}' style='display:none'></div>`:''}
                ${t.link?`<a href="${t.link}" target="_blank" onclick="event.stopPropagation()" style="font-size:10px;padding:1px 7px;border-radius:5px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent);text-decoration:none;white-space:nowrap">🔗 ${t.linkLabel||'リンク'}</a>`:''}
              </div>
            </div>
            <select onchange="changeAnnualTaskStatus(${pi},${ti},this.value)" onclick="event.stopPropagation()"
              style="font-size:10px;padding:2px 5px;border:1px solid ${ANNUAL_STATUS_COLORS[t.status]||'#94a3b8'}44;border-radius:6px;background:${ANNUAL_STATUS_COLORS[t.status]||'#94a3b8'}11;color:${ANNUAL_STATUS_COLORS[t.status]||'#94a3b8'};cursor:pointer;font-family:var(--font)">
              ${Object.entries(ANNUAL_STATUS_LABELS).map(([k,v])=>`<option value="${k}" ${t.status===k?'selected':''}>${v}</option>`).join('')}
            </select>
            <button onclick="event.stopPropagation();toggleAnnualTaskEdit(${pi},${ti})"
              style="font-size:11px;padding:3px 7px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text3);cursor:pointer"
              onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
              onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text3)'">✏️</button>
            <button onclick="event.stopPropagation();deleteAnnualTask(${pi},${ti})"
              style="font-size:11px;padding:3px 7px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer"
              onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
              onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑</button>
          </div>
          <div id="annual-edit-${pi}-${ti}" style="display:none;padding:8px 10px;background:var(--surface2);border-top:1px solid var(--border);gap:6px;flex-wrap:wrap">
            <input id="ae-title-${pi}-${ti}" class="form-input" value="${t.title.replace(/"/g,'&quot;')}" placeholder="タイトル" style="flex:2;min-width:160px;font-size:12px">
            <input id="ae-due-${pi}-${ti}" type="date" class="form-input" value="${t.due?t.due.split('T')[0]:''}" style="width:135px;font-size:12px">
            <select id="ae-assignee-${pi}-${ti}" class="form-input" style="width:100px;font-size:12px">${memberOpts}</select>
            <textarea id="ae-note-${pi}-${ti}" class="form-input" placeholder="メモ" rows="2" style="flex:1;min-width:120px;font-size:12px;resize:vertical">${(t.note||'').replace(/</g,'&lt;')}</textarea>
            <input id="ae-link-${pi}-${ti}" class="form-input" value="${t.link||''}" placeholder="🔗 リンクURL (https://...)" style="flex:2;min-width:160px;font-size:12px">
            <input id="ae-link-label-${pi}-${ti}" class="form-input" value="${t.linkLabel||''}" placeholder="ラベル名" style="width:110px;font-size:12px">
            <div style="display:flex;flex-direction:column;gap:4px">
              <button onclick="saveAnnualTaskEdit(${pi},${ti})" class="btn btn-primary" style="font-size:11px;padding:4px 10px">💾</button>
              <button onclick="toggleAnnualTaskEdit(${pi},${ti})" class="btn btn-ghost" style="font-size:11px;padding:4px 8px">✕</button>
            </div>
          </div>
        </div>`;
      }).join('')}
      </div>
      <!-- タスク追加 -->
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <input id="annual-new-task-${pi}" class="form-input" placeholder="タスクを追加..." style="flex:1;min-width:160px;font-size:12px"
          onkeydown="if(event.key==='Enter')addAnnualTask(${pi})">
        <input id="annual-new-due-${pi}" type="date" class="form-input" style="width:140px;font-size:12px" title="期限日">
        <button onclick="addAnnualTask(${pi})" class="btn btn-ghost" style="font-size:11px;padding:5px 10px">追加</button>
      </div>
    </div>`;
}

function annualDragStart(e, pi, ti){
  annualDragSrcPi = pi;
  annualDragSrcTi = ti;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dnd-dragging');
}

function annualDragOver(e, pi, ti){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if(annualDragSrcPi===pi && annualDragSrcTi!==ti){
    e.currentTarget.classList.add('dnd-over');
  }
}

function annualDragLeave(e){
  e.currentTarget.classList.remove('dnd-over');
}

function annualDrop(e, pi, ti){
  e.preventDefault();
  e.currentTarget.classList.remove('dnd-over');
  if(annualDragSrcPi !== pi || annualDragSrcTi === ti) return;
  const tasks = annualProjects[pi].tasks;
  const dragged = tasks.splice(annualDragSrcTi, 1)[0];
  const insertAt = ti > annualDragSrcTi ? ti - 1 : ti;
  tasks.splice(insertAt, 0, dragged);
  saveAnnualProjects(); renderAnnualProjects();
}

function annualDragEnd(e){
  e.currentTarget.classList.remove('dnd-dragging');
  document.querySelectorAll('.dnd-over').forEach(x=>x.classList.remove('dnd-over'));
  annualDragSrcPi = null;
  annualDragSrcTi = null;
}

function toggleAnnualProject(pi){
  annualProjects[pi]._open=!annualProjects[pi]._open;
  saveAnnualProjects(); renderAnnualProjects();
}

function toggleSelectAllAnnualTasks(pi, checked){
  document.querySelectorAll(`.annual-task-chk-${pi}`).forEach(el=>el.checked=checked);
  updateAnnualBulkBar(pi);
}

function updateAnnualBulkBar(pi){
  const chks=[...document.querySelectorAll(`.annual-task-chk-${pi}`)];
  const selected=chks.filter(c=>c.checked);
  const countEl=document.getElementById(`annual-selected-count-${pi}`);
  const btnEl=document.getElementById(`annual-bulk-delete-${pi}`);
  const allChk=document.getElementById(`annual-select-all-${pi}`);
  if(countEl) countEl.textContent=selected.length>0?`${selected.length}件選択中`:'';
  if(btnEl)   btnEl.style.display=selected.length>0?'':'none';
  if(allChk){
    allChk.indeterminate=selected.length>0&&selected.length<chks.length;
    allChk.checked=selected.length>0&&selected.length===chks.length;
  }
}

function bulkDeleteAnnualTasks(pi){
  const chks=[...document.querySelectorAll(`.annual-task-chk-${pi}`)].filter(c=>c.checked);
  if(!chks.length) return;
  if(!confirm(`選択した${chks.length}件のタスクを削除しますか？`)) return;
  const tiList=chks.map(c=>parseInt(c.dataset.ti)).sort((a,b)=>b-a);
  tiList.forEach(ti=>annualProjects[pi].tasks.splice(ti,1));
  saveAnnualProjects(); renderAnnualProjects();
  toast(`🗑 ${chks.length}件のタスクを削除しました`);
}

function toggleAnnualNote(pi, ti){
  const exp = document.getElementById('an-exp-'+pi+'-'+ti);
  const arr = document.getElementById('an-arr-'+pi+'-'+ti);
  const txt = document.getElementById('an-text-'+pi+'-'+ti);
  if(!exp) return;
  const t = annualProjects[pi]?.tasks[ti];
  const open = exp.style.display !== 'none';
  if(open){
    exp.style.display = 'none';
    if(arr) arr.textContent = '▾';
    if(t && txt){ txt.textContent = t.note.slice(0,15)+(t.note.length>15?'…':''); txt.style.maxWidth='120px'; }
  } else {
    if(t) exp.textContent = t.note;
    exp.style.cssText = 'display:block;margin-top:3px;padding:5px 8px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#78350f;line-height:1.7;white-space:pre-wrap;word-break:break-word';
    if(arr) arr.textContent = '▴';
    if(txt){ txt.textContent = ''; txt.style.maxWidth='0'; }
  }
}

function toggleAnnualTaskEdit(pi,ti){
  const el=document.getElementById(`annual-edit-${pi}-${ti}`);
  if(!el) return;
  const open=el.style.display==='none'||el.style.display==='';
  el.style.display=open?'flex':'none';
  if(open) document.getElementById(`ae-title-${pi}-${ti}`)?.focus();
}

function saveAnnualTaskEdit(pi,ti){
  const title=document.getElementById(`ae-title-${pi}-${ti}`)?.value.trim();
  if(!title){toast('⚠ タイトルを入力してください',true);return;}
  const t=annualProjects[pi].tasks[ti];
  t.title=title;
  t.due=document.getElementById(`ae-due-${pi}-${ti}`)?.value||'';
  t.assignee=document.getElementById(`ae-assignee-${pi}-${ti}`)?.value||'';
  t.note=document.getElementById(`ae-note-${pi}-${ti}`)?.value.trim()||'';
  t.link=document.getElementById(`ae-link-${pi}-${ti}`)?.value.trim()||'';
  t.linkLabel=document.getElementById(`ae-link-label-${pi}-${ti}`)?.value.trim()||'';
  saveAnnualProjects(); renderAnnualProjects();
  toast('💾 保存しました');
}

function deleteAnnualTask(pi,ti){
  const t=annualProjects[pi].tasks[ti];
  if(!confirm(`「${t.title}」を削除しますか？`)) return;
  annualProjects[pi].tasks.splice(ti,1);
  saveAnnualProjects(); renderAnnualProjects();
  toast('🗑 削除しました');
}

function toggleAnnualTask(pi,ti,checked){
  const proj=annualProjects[pi];
  proj.tasks[ti].status=checked?'done':'todo';

  // 完了になったら一番下へ移動（未完了タスクの後ろ）
  if(checked){
    const task = proj.tasks.splice(ti,1)[0];
    proj.tasks.push(task);
  } else {
    // 未完了に戻したら未完了の末尾（完了タスクの前）へ移動
    const task = proj.tasks.splice(ti,1)[0];
    const firstDoneIdx = proj.tasks.findIndex(t=>t.status==='done');
    if(firstDoneIdx>=0) proj.tasks.splice(firstDoneIdx,0,task);
    else proj.tasks.push(task);
  }

  // 見直しタスク以外のタスクが1件以上あり、かつ全タスク完了のときだけ翌年生成
  const nonReviewTasks = proj.tasks.filter(t=>!t.title.includes('見直し'));
  const allDone = proj.tasks.every(t=>t.status==='done') && nonReviewTasks.length > 0;
  if(allDone){
    createNextYearProject(pi,true);
    toast(`✅「${proj.name}」全タスク完了！翌年分を自動生成しました`);
  }
  saveAnnualProjects(); renderAnnualProjects();
}

function changeAnnualTaskStatus(pi,ti,status){
  const proj=annualProjects[pi];
  const prevStatus=proj.tasks[ti].status;
  proj.tasks[ti].status=status;

  // 完了になったら一番下へ、完了から戻したら未完了の末尾へ
  if(status==='done' && prevStatus!=='done'){
    const task=proj.tasks.splice(ti,1)[0];
    proj.tasks.push(task);
  } else if(status!=='done' && prevStatus==='done'){
    const task=proj.tasks.splice(ti,1)[0];
    const firstDoneIdx=proj.tasks.findIndex(t=>t.status==='done');
    if(firstDoneIdx>=0) proj.tasks.splice(firstDoneIdx,0,task);
    else proj.tasks.push(task);
  }

  const nonReviewTasks = proj.tasks.filter(t=>!t.title.includes('見直し'));
  if(proj.tasks.every(t=>t.status==='done') && nonReviewTasks.length > 0){
    createNextYearProject(pi,true);
    toast(`✅「${proj.name}」全タスク完了！翌年分を自動生成しました`);
  }
  saveAnnualProjects(); renderAnnualProjects();
}

function addAnnualTask(pi){
  const inp=document.getElementById(`annual-new-task-${pi}`);
  const dueInp=document.getElementById(`annual-new-due-${pi}`);
  if(!inp||!inp.value.trim()) return;
  annualProjects[pi].tasks.push({title:inp.value.trim(),status:'todo',due:dueInp?.value||'',assignee:'',note:''});
  saveAnnualProjects(); renderAnnualProjects();
}

function deleteAnnualProject(pi){
  if(!confirm(`「${annualProjects[pi].name}」を削除しますか？`)) return;
  annualProjects.splice(pi,1);
  saveAnnualProjects(); renderAnnualProjects();
  toast('🗑 削除しました');
}

function pushAnnualToTasks(pi){
  const proj=annualProjects[pi];
  const tag=`[年次:${proj.name}_${proj.year}]`;
  const existing=tasks.filter(t=>t.note&&t.note.includes(tag));
  if(existing.length>0&&!confirm(`既に${existing.length}件連携済みです。再度追加しますか？`)) return;
  proj.tasks.forEach(t=>{
    tasks.push({
      id:Date.now()+Math.random(),
      title:`【${proj.name}】${t.title}`,
      cat:proj.cat||'other', due:t.due||'', start:'',
      status:t.status==='done'?'done':'todo',
      assignee:t.assignee||proj.assignee||'', approver:'', rep:'',
      note:`${tag} ${t.note||''}`.trim(),
      pri:'mid', remind:'', comments:[], files:[], subtasks:[],
    });
  });
  saveTasks(); renderAll();
  if(isGasEnabled()) syncData(true, true);
  toast(`✅ ${proj.tasks.length}件をタスク管理に追加しました`);
}

function createNextYearProject(pi,auto=false){
  const proj=annualProjects[pi];
  const nextYear=parseInt(proj.year)+1;
  const exists=annualProjects.find(p=>p.name===proj.name&&p.year===String(nextYear));
  if(exists){ if(!auto) toast(`⚠ ${nextYear}年分は既に存在します`,true); return; }
  const newTasks=[
    {title:`${proj.name} ${nextYear}年度 タスク・内容の見直し`,status:'todo',due:'',assignee:proj.assignee||'',note:'毎年最初に実施。タスク内容・期限・担当者を確認・更新してください'},
    ...proj.tasks.filter(t=>t.title.indexOf('見直し')<0).map(t=>({
      ...t, status:'todo',
      due:t.due?(()=>{const d=new Date(t.due);d.setFullYear(d.getFullYear()+1);return d.toISOString().split('T')[0];})():'',
    }))
  ];
  annualProjects.push({...proj,year:String(nextYear),tasks:newTasks,_open:true});
  saveAnnualProjects();
  if(!auto){renderAnnualProjects();toast(`✅ ${nextYear}年分を作成しました`);}
}

function openAnnualProjectModal(pi){
  editingAnnualIdx=pi!==undefined?pi:null;
  const proj=pi!==undefined?annualProjects[pi]:null;
  document.getElementById('ap-name').value=proj?.name||'';
  document.getElementById('ap-year').value=proj?.year||String(new Date().getFullYear());
  document.getElementById('ap-deadline').value=proj?.deadline||'';
  document.getElementById('ap-startdate').value=proj?.startDate||'';
  document.getElementById('ap-link').value=proj?.link||'';
  document.getElementById('ap-link-label').value=proj?.linkLabel||'';
  document.getElementById('ap-note').value=proj?.note||'';
  document.getElementById('ap-assignee').innerHTML='<option value="">未割り当て</option>'+MEMBERS.map(m=>`<option value="${escHtml(m.id)}" ${proj?.assignee===m.id?'selected':''}>${escHtml(m.name)}</option>`).join('');
  document.getElementById('ap-assignee').value=proj?.assignee||'';
  const listEl=document.getElementById('ap-tasks-list');
  const tasksToShow=proj?proj.tasks.filter(t=>!t.title.includes('見直し')):[];
  listEl.innerHTML=tasksToShow.map(t=>`
    <div style="display:flex;gap:6px;margin-bottom:4px;align-items:center;flex-wrap:wrap">
      <input class="form-input ap-task-input" value="${t.title}" style="flex:2;min-width:120px;font-size:12px">
      <input class="form-input ap-task-due" type="date" value="${t.due?t.due.split('T')[0]:''}" style="width:130px;font-size:12px" title="期限日">
      <input class="form-input ap-task-link" value="${t.link||''}" placeholder="🔗 URL" style="flex:1;min-width:100px;font-size:12px" title="リンクURL">
      <input class="form-input ap-task-link-label" value="${t.linkLabel||''}" placeholder="ラベル" style="width:80px;font-size:12px" title="リンクラベル">
      <button onclick="this.closest('div').remove()" style="padding:4px 8px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;font-size:11px">✕</button>
    </div>`).join('');
  document.getElementById('ap-modal-title').textContent=proj?'プロジェクトを編集':'プロジェクトを追加';
  modalShow('annual-project-overlay');
}

function closeAnnualProjectModal(){
  modalHide('annual-project-overlay');
}

function addAnnualTaskInModal(){
  const inp=document.getElementById('ap-new-task');
  const dueInp=document.getElementById('ap-new-due');
  if(!inp.value.trim()) return;
  const div=document.createElement('div');
  div.style.cssText='display:flex;gap:6px;margin-bottom:4px;align-items:center';
  div.innerHTML=`<input class="form-input ap-task-input" value="${inp.value.trim()}" style="flex:2;min-width:120px;font-size:12px">
    <input class="form-input ap-task-due" type="date" value="${dueInp?.value?dueInp.value.split('T')[0]:''}" style="width:130px;font-size:12px" title="期限日">
    <input class="form-input ap-task-link" placeholder="🔗 URL" style="flex:1;min-width:100px;font-size:12px" title="リンクURL">
    <input class="form-input ap-task-link-label" placeholder="ラベル" style="width:80px;font-size:12px" title="リンクラベル">
    <button onclick="this.closest('div').remove()" style="padding:4px 8px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;font-size:11px;flex-shrink:0">✕</button>`;
  document.getElementById('ap-tasks-list').appendChild(div);
  inp.value=''; if(dueInp) dueInp.value='';
  inp.focus();
}

function saveAnnualProjectModal(){
  const name=document.getElementById('ap-name').value.trim();
  if(!name){toast('⚠ プロジェクト名を入力してください',true);return;}
  const taskInputs=[...document.querySelectorAll('.ap-task-input')];
  const taskDues=[...document.querySelectorAll('.ap-task-due')];
  const taskLinks=[...document.querySelectorAll('.ap-task-link')];
  const taskLinkLabels=[...document.querySelectorAll('.ap-task-link-label')];
  const taskList=taskInputs.map((inp,i)=>({
    title:inp.value.trim(),
    due:taskDues[i]?.value||'',
    link:taskLinks[i]?.value.trim()||'',
    linkLabel:taskLinkLabels[i]?.value.trim()||'',
    status:'todo',assignee:'',note:''
  })).filter(t=>t.title);
  const isNew=editingAnnualIdx===null;
  const finalTasks=[
    {title:`${name} タスク・内容の見直し`,status:'todo',due:'',assignee:document.getElementById('ap-assignee').value||'',note:'毎年最初に実施。タスク内容・期限・担当者を確認・更新してください'},
    ...taskList
  ];
  const proj={
    name, year:document.getElementById('ap-year').value||String(new Date().getFullYear()),
    deadline:document.getElementById('ap-deadline').value,
    startDate:document.getElementById('ap-startdate').value,
    link:document.getElementById('ap-link').value.trim(),
    linkLabel:document.getElementById('ap-link-label').value.trim(),
    assignee:document.getElementById('ap-assignee').value,
    note:document.getElementById('ap-note').value.trim(),
    cat:'other', tasks:finalTasks, _open:true,
  };
  if(isNew){
    annualProjects.push(proj);
  } else {
    const old=annualProjects[editingAnnualIdx];
    proj.tasks=finalTasks.map(t=>{
      const oldTask=old.tasks.find(o=>o.title===t.title);
      return oldTask?{...t,status:oldTask.status}:t;
    });
    annualProjects[editingAnnualIdx]={...old,...proj};
  }
  saveAnnualProjects(); closeAnnualProjectModal(); renderAnnualProjects();
  toast(`✅ プロジェクトを${isNew?'追加':'更新'}しました`);
}

function openAnnualCsvModal(pi){
  annualCsvTargetPi = pi;
  annualCsvParsed   = [];
  document.getElementById('annual-csv-file').value = '';
  document.getElementById('annual-csv-preview').style.display = 'none';
  document.getElementById('annual-csv-errors').textContent   = '';
  document.getElementById('annual-csv-import-btn').disabled  = true;
  document.getElementById('annual-csv-import-btn').style.opacity = '.4';
  modalShow('annual-csv-overlay');
}

function closeAnnualCsvModal(){
  modalHide('annual-csv-overlay');
}

function downloadAnnualCsvTemplate(){
  const bom = '\uFEFF';
  const rows = [
    ['タイトル','期限日','担当者','メモ'],
    ['実施拠点・受診方法の確認','2026-06-10','田尻','当年度の変更がないか確認'],
    ['見積書・オプション一覧取得','2026-06-20','田尻','天神クリニックから取得'],
    ['全社向け案内ドキュメント作成','2026-07-31','田尻',''],
  ];
  const csv = bom + rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download='annual_tasks_template.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function previewAnnualCsv(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      let text = e.target.result;
      if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
      const lines = text.split(/\r?\n/).filter(l=>l.trim());
      if(lines.length < 2){
        document.getElementById('annual-csv-errors').textContent = '⚠ データ行がありません（2行目以降にデータを入力してください）';
        return;
      }
      const header = parseCsvLine(lines[0]).map(h=>h.trim());
      const titleIdx    = header.findIndex(h=>/タイトル|title/i.test(h));
      const dueIdx      = header.findIndex(h=>/期限|due|date/i.test(h));
      const assigneeIdx = header.findIndex(h=>/担当|assignee|member/i.test(h));
      const noteIdx     = header.findIndex(h=>/メモ|memo|note|備考|remark/i.test(h));
      if(titleIdx<0){
        document.getElementById('annual-csv-errors').textContent = '⚠ 「タイトル」列が見つかりません';
        return;
      }
      annualCsvParsed = [];
      const errors = [];
      for(let i=1;i<lines.length;i++){
        const vals = parseCsvLine(lines[i]);
        const title = (vals[titleIdx]||'').trim();
        if(!title){ errors.push(`${i+1}行目: タイトルが空です`); continue; }
        const assigneeName = assigneeIdx>=0 ? (vals[assigneeIdx]||'').trim() : '';
        const member = MEMBERS.find(m=>m.name===assigneeName||m.id===assigneeName);
        annualCsvParsed.push({
          title,
          due:      dueIdx>=0      ? (vals[dueIdx]||'').trim()      : '',
          assignee: member ? member.id : '',
          note:     noteIdx>=0&&vals.length>noteIdx ? (vals[noteIdx]||'').trim() : '',
          status:   'todo',
        });
      }
      // プレビュー表示
      const preview = document.getElementById('annual-csv-preview');
      const label   = document.getElementById('annual-csv-preview-label');
      const table   = document.getElementById('annual-csv-preview-table');
      const errEl   = document.getElementById('annual-csv-errors');
      label.textContent = `${annualCsvParsed.length}件のタスクを検出`;
      table.innerHTML = `
        <thead><tr style="background:var(--surface2)">
          ${['タイトル','期限日','担当者','メモ'].map(h=>`<th style="padding:6px 10px;text-align:left;font-weight:700;color:var(--text3);white-space:nowrap">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${annualCsvParsed.slice(0,10).map(r=>`<tr style="border-top:1px solid var(--border)">
            <td style="padding:5px 10px">${r.title}</td>
            <td style="padding:5px 10px;font-family:var(--mono);color:var(--text2)">${r.due||'—'}</td>
            <td style="padding:5px 10px">${MEMBERS.find(m=>m.id===r.assignee)?.name||'—'}</td>
            <td style="padding:5px 10px;color:var(--text3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.note}">${r.note||'—'}</td>
          </tr>`).join('')}
          ${annualCsvParsed.length>10?`<tr><td colspan="4" style="padding:5px 10px;color:var(--text3);text-align:center">… 他${annualCsvParsed.length-10}件</td></tr>`:''}
        </tbody>`;
      errEl.innerHTML = errors.map(e=>`⚠ ${e}`).join('<br>');
      preview.style.display = 'block';
      const btn = document.getElementById('annual-csv-import-btn');
      if(annualCsvParsed.length>0){ btn.disabled=false; btn.style.opacity='1'; }
    }catch(err){
      document.getElementById('annual-csv-errors').textContent = '⚠ CSVの読み込みに失敗しました: '+err.message;
    }
  };
  reader.readAsText(file,'UTF-8');
}

function importAnnualCsv(){
  if(!annualCsvParsed.length||annualCsvTargetPi===null) return;
  const proj = annualProjects[annualCsvTargetPi];
  const existing = proj.tasks.filter(t=>!t.title.includes('見直し'));
  const mode = existing.length>0
    ? confirm(`既存タスク${existing.length}件があります。\n\n「OK」→ 既存を残してCSVのタスクを追加\n「キャンセル」→ 既存を削除してCSVのタスクに置き換え`)
    : true;

  if(mode){
    // 追加
    annualCsvParsed.forEach(t=>proj.tasks.push(t));
  } else {
    // 置き換え（見直しタスクは保持）
    const reviewTask = proj.tasks.find(t=>t.title.includes('見直し'));
    proj.tasks = reviewTask ? [reviewTask, ...annualCsvParsed] : [...annualCsvParsed];
  }
  saveAnnualProjects();
  closeAnnualCsvModal();
  renderAnnualProjects();
  toast(`✅ ${annualCsvParsed.length}件のタスクを取り込みました`);
}

function editAnnualProject(pi){openAnnualProjectModal(pi);}
