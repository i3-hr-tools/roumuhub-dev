// ══ メンバー管理・PINログイン機能 ══


function saveMembers(){localStorage.setItem('team_members',JSON.stringify(MEMBERS)); scheduleAutoSync();}

function renderMembersPanel(){
  const grid=document.getElementById('members-grid');
  const badge=document.getElementById('mc-members');
  if(badge)badge.textContent=MEMBERS.length;
  grid.innerHTML=MEMBERS.map(m=>`
    <div style="background:#fff;border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);transition:all .2s"
      onmouseover="this.style.boxShadow='0 8px 24px rgba(0,0,0,.10)';this.style.transform='translateY(-2px)'"
      onmouseout="this.style.boxShadow='0 1px 4px rgba(0,0,0,.06)';this.style.transform=''">
      <!-- カードヘッダー -->
      <div style="background:linear-gradient(135deg,${m.color}22 0%,${m.color}08 100%);border-bottom:1px solid ${m.color}22;padding:16px 18px;display:flex;align-items:center;gap:12px">
        <div style="width:48px;height:48px;border-radius:14px;background:${m.color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 2px 8px ${m.color}55">${m.initial}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(m.name)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;font-family:var(--mono)">${m.email||'メール未設定'}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button onclick="openMemberModal('${m.id}')"
            style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer;font-size:11px;font-family:var(--font);font-weight:600;transition:all .12s"
            onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)';this.style.background='var(--accent-light)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)';this.style.background='#fff'">✏️ 編集</button>
          ${MEMBERS.length>1?`<button onclick="deleteMember('${m.id}')"
            style="padding:5px 8px;border-radius:7px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;font-size:11px;font-family:var(--font);transition:all .12s"
            onmouseover="this.style.background='var(--red)';this.style.color='#fff';this.style.borderColor='var(--red)'"
            onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)';this.style.borderColor='#fecaca'">🗑</button>`:''}
        </div>
      </div>
      <!-- タスク統計 -->
      <div style="padding:14px 18px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border-bottom:1px solid var(--border)">
        <div style="text-align:center;padding:10px 6px;border-radius:10px;background:var(--surface2)">
          <div style="font-size:20px;font-weight:800;font-family:var(--mono);color:var(--text);line-height:1">${tasks.filter(t=>t.assignee===m.id&&t.status!=='done').length}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px">未完了</div>
        </div>
        <div style="text-align:center;padding:10px 6px;border-radius:10px;background:#f0fdf4">
          <div style="font-size:20px;font-weight:800;font-family:var(--mono);color:var(--green);line-height:1">${tasks.filter(t=>t.assignee===m.id&&t.status==='done').length}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px">完了済み</div>
        </div>
        <div style="text-align:center;padding:10px 6px;border-radius:10px;background:#fef2f2">
          <div style="font-size:20px;font-weight:800;font-family:var(--mono);color:var(--red);line-height:1">${tasks.filter(t=>t.assignee===m.id&&t.status!=='done'&&t.due&&t.due<fmt(T)).length}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px">期限超過</div>
        </div>
      </div>
      <!-- カレンダー連携 -->
      <div style="padding:12px 18px">
        ${m.email?`
          <button onclick="syncMemberCalendar('${m.id}')"
            style="width:100%;padding:9px;border-radius:9px;border:none;background:linear-gradient(135deg,var(--green) 0%,#059669 100%);color:#fff;cursor:pointer;font-size:12px;font-weight:700;font-family:var(--font);transition:all .15s;box-shadow:0 2px 6px rgba(5,150,105,.3)"
            onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(5,150,105,.4)'"
            onmouseout="this.style.transform='';this.style.boxShadow='0 2px 6px rgba(5,150,105,.3)'">
            🔄 カレンダーと同期
          </button>`:`
          <div style="text-align:center;padding:8px;font-size:11px;color:var(--text3);background:var(--surface2);border-radius:8px">
            📧 メール未設定 — 編集から設定してください
          </div>`}
      </div>
    </div>`).join('');
}


function selectColor(color,el){
  selectedColor=color;
  document.getElementById('mm-color').value=color;
  document.querySelectorAll('#mm-color-picker div').forEach(d=>{d.style.border='3px solid transparent';d.style.transform='scale(1)';});
  el.style.border='3px solid var(--accent)';el.style.transform='scale(1.15)';
}

function openMemberModal(id){
  const editM=id?MEMBERS.find(m=>m.id===id):null;
  document.getElementById('member-modal-title').textContent=editM?'メンバーを編集':'メンバーを追加';
  document.getElementById('mm-edit-id').value=id||'';
  document.getElementById('mm-name').value=editM?.name||'';
  document.getElementById('mm-initial').value=editM?.initial||'';
  document.getElementById('mm-email').value=editM?.email||'';
  document.getElementById('mm-calendar-id').value=editM?.calendarId||'primary';
  selectedColor=editM?.color||'#2d7a4f';
  document.getElementById('mm-color').value=selectedColor;
  // カラーピッカー初期化
  document.querySelectorAll('#mm-color-picker div').forEach(d=>{
    d.style.border='3px solid transparent';d.style.transform='scale(1)';
    if(d.style.background===selectedColor||d.style.backgroundColor===selectedColor){
      d.style.border='3px solid var(--accent)';d.style.transform='scale(1.15)';
    }
  });
  document.getElementById('member-modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('mm-name').focus(),100);
}

async function saveMember(){
  const saveBtn=document.querySelector('#member-modal-overlay .btn-primary');
  if(saveBtn && saveBtn.disabled) return;
  if(saveBtn) saveBtn.disabled=true;
  try {
  const name=document.getElementById('mm-name').value.trim();
  if(!name){toast('⚠ 名前を入力してください',true);if(saveBtn)saveBtn.disabled=false;return;}
  const initial=(document.getElementById('mm-initial').value.trim()||name[0]).toUpperCase();
  const vals={
    name,
    initial,
    color:document.getElementById('mm-color').value||selectedColor,
    email:document.getElementById('mm-email').value.trim(),
    calendarId:document.getElementById('mm-calendar-id').value.trim()||'primary',
  };
  const editId=document.getElementById('mm-edit-id').value;
  if(editId){
    const m=MEMBERS.find(m=>m.id===editId);
    if(m){
      Object.assign(m,vals);
    }
  } else {
    MEMBERS.push({id:'m'+Date.now(),...vals});
  }
  saveMembers();
  closeModal('member-modal-overlay');
  renderMembersPanel();
  renderMemberList();
  populateAssigneeSelects();
  toast(editId?'✏️ メンバーを更新しました':'👥 メンバーを追加しました');
  } finally {
    if(saveBtn) saveBtn.disabled=false;
  }
}

function deleteMember(id){
  const m=MEMBERS.find(m=>m.id===id);if(!m)return;
  const taskCount=tasks.filter(t=>t.assignee===id).length;
  const msg=taskCount>0
    ?`「${m.name}」を削除しますか？\nこのメンバーには${taskCount}件のタスクが割り当てられています。\n（タスクは削除されず、担当者が未割り当てになります）`
    :`「${m.name}」を削除しますか？`;
  if(!confirm(msg))return;
  // タスクの担当者をクリア
  tasks.forEach(t=>{if(t.assignee===id)t.assignee='';if(t.approver===id)t.approver='';});
  saveTasks();
  const idx=MEMBERS.findIndex(m=>m.id===id);
  if(idx>-1)MEMBERS.splice(idx,1);
  saveMembers();
  renderMembersPanel();
  renderMemberList();
  populateAssigneeSelects();
  toast('🗑 メンバーを削除しました');
}

async function syncMemberCalendar(memberId){
  const m=MEMBERS.find(m=>m.id===memberId);if(!m)return;
  if(!isGasEnabled()){toast('⚠ GAS URLが未設定です',true);return;}
  if(!m.email){toast('⚠ Googleアカウントが設定されていません',true);return;}
  const myTasks=tasks.filter(t=>t.assignee===memberId&&t.status!=='done'&&t.due);
  if(!myTasks.length){toast('⚠ 同期するタスクがありません',true);return;}
  toast(`🔄 ${m.name}のタスクを同期中...`);
  try{
    // URLSearchParams形式でtokenを含めてPOST
    const sp = new URLSearchParams();
    sp.append('action', 'syncCalendar');
    sp.append('memberId', memberId);
    sp.append('email', m.email);
    sp.append('calendarId', m.calendarId||'primary');
    sp.append('tasks', JSON.stringify(myTasks));
    if(gAccessToken) sp.append('token', gAccessToken);
    const res=await fetch(getGasUrl(),{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:sp.toString(),
      redirect:'follow'
    });
    const data=await res.json();
    if(data.success){toast(`✅ ${m.name}のカレンダーに${myTasks.length}件を同期しました`);}
    else{toast('⚠ 同期に失敗しました',true);}
  }catch(e){
    toast('⚠ 同期に失敗しました。GAS URLを確認してください。',true);
  }
}







