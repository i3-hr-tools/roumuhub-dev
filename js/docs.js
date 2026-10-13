// ══ ドキュメント管理機能 ══

function myDocs(){
  const uid=currentUser?.id;
  return docItems.filter(d=>!d.ownerId||d.ownerId===uid);
}

function saveDocs(){
  localStorage.setItem('doc_items',JSON.stringify(docItems));
  const el=document.getElementById('mc-docs');
  if(el)el.textContent=myDocs().length;
}

function getAllDocTags(){
  const set=new Set();
  myDocs().forEach(d=>(d.tags||[]).forEach(t=>set.add(t)));
  return [...set].sort();
}

function renderDocTagFilter(){
  const tags=getAllDocTags();
  const bar=document.getElementById('doc-tag-filter-bar');
  if(!bar)return;
  bar.innerHTML=`<button class="filter-chip ${docTagFilter==='all'?'active':''}" onclick="setDocTagFilter('all',this)">すべて</button>`
    +tags.map(t=>`<button class="filter-chip ${docTagFilter===t?'active':''}" onclick="setDocTagFilter('${t}',this)">${t}</button>`).join('');
}

function setDocTagFilter(tag,el){
  docTagFilter=tag;
  document.querySelectorAll('#doc-tag-filter-bar .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderDocList();
}

function renderDocList(){
  const q=(document.getElementById('doc-search')?.value||'').toLowerCase();
  let list=myDocs();
  if(docTagFilter!=='all')list=list.filter(d=>(d.tags||[]).includes(docTagFilter));
  if(q)list=list.filter(d=>d.name.toLowerCase().includes(q)||(d.tags||[]).some(t=>t.toLowerCase().includes(q))||(d.note||'').toLowerCase().includes(q));
  const el=document.getElementById('doc-list');
  if(!el)return;
  if(!list.length){
    el.innerHTML=`<div class="empty-state" style="padding:32px"><div class="icon">📁</div>${myDocs().length?'条件に一致する資料がありません':'まだ資料が登録されていません'}</div>`;
    return;
  }
  el.innerHTML=list.map(d=>`
    <div style="display:grid;grid-template-columns:1fr 120px 100px 80px;padding:11px 16px;border-bottom:1px solid var(--border);align-items:center;transition:background .12s"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div style="min-width:0">
        <a href="${d.url}" target="_blank" rel="noopener"
          style="font-size:13px;font-weight:600;color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:5px"
          onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
          📄 ${d.name}
        </a>
        ${d.note?`<div style="font-size:11px;color:var(--text3);margin-top:2px">${d.note}</div>`:''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px">
        ${(d.tags||[]).map(t=>`<span style="font-size:10px;padding:1px 7px;border-radius:10px;background:var(--blue-light);color:var(--blue);font-weight:600;font-family:var(--mono)">${t}</span>`).join('')}
      </div>
      <div style="font-size:11px;font-family:var(--mono);color:var(--text3)">${d.date||'—'}</div>
      <div style="display:flex;gap:4px">
        <button onclick="openEditDocModal('${d.id}')"
          style="font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer;font-family:var(--font)"
          onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
          onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">✏️</button>
        <button onclick="deleteDoc('${d.id}')"
          style="font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;font-family:var(--font);font-weight:600"
          onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
          onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑</button>
      </div>
    </div>`).join('');
  const badge=document.getElementById('mc-docs');
  if(badge)badge.textContent=myDocs().length;
}

function openAddDocModal(){
  document.getElementById('doc-modal-title').textContent='資料を追加';
  document.getElementById('dm-edit-id').value='';
  ['dm-name','dm-url','dm-tags','dm-note'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('dm-date').value=fmt(T);
  document.getElementById('doc-modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('dm-name').focus(),100);
}

function openEditDocModal(id){
  const d=docItems.find(d=>d.id===id);if(!d)return;
  document.getElementById('doc-modal-title').textContent='資料を編集';
  document.getElementById('dm-edit-id').value=id;
  document.getElementById('dm-name').value=d.name;
  document.getElementById('dm-url').value=d.url;
  document.getElementById('dm-tags').value=(d.tags||[]).join(', ');
  document.getElementById('dm-note').value=d.note||'';
  document.getElementById('dm-date').value=d.date||'';
  document.getElementById('doc-modal-overlay').classList.add('open');
}

function saveDoc(){
  const name=document.getElementById('dm-name').value.trim();
  const url=document.getElementById('dm-url').value.trim();
  if(!name||!url){toast('⚠ 資料名とURLは必須です',true);return;}
  const tags=document.getElementById('dm-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const vals={name,url,tags,note:document.getElementById('dm-note').value.trim(),date:document.getElementById('dm-date').value};
  const editId=document.getElementById('dm-edit-id').value;
  if(editId){const d=docItems.find(d=>d.id===editId);if(d)Object.assign(d,vals);}
  else docItems.push({id:'doc'+Date.now(),ownerId:currentUser?.id||'',...vals});
  saveDocs();closeModal('doc-modal-overlay');renderDocList();renderDocTagFilter();
  toast(editId?'✏️ 資料を更新しました':'📁 資料を追加しました');
}

function deleteDoc(id){
  if(!confirm('この資料を削除しますか？'))return;
  docItems=docItems.filter(d=>d.id!==id);
  saveDocs();renderDocList();renderDocTagFilter();toast('🗑 削除しました');
}
