// ══ リンク集機能 ══

function saveLinks(){localStorage.setItem('link_items',JSON.stringify(linkItems));}

function saveLinkCats(){localStorage.setItem('link_cats',JSON.stringify(linkCats));}

function getCatLabel(catId){
  const c=linkCats.find(c=>c.id===catId);
  return c?`${c.icon} ${c.name}`:catId;
}

function loadDefaultLinks(){
  linkItems=[
    {id:'lk1',name:'SmartHR',url:'https://smarthr.jp/',cat:'kyuyo',note:'勤怠・労務管理',icon:'👥'},
    {id:'lk2',name:'MoneyForward給与',url:'https://payroll.moneyforward.com/',cat:'kyuyo',note:'給与計算・明細',icon:'💴'},
    {id:'lk4',name:'e-Gov 電子申請',url:'https://shinsei.e-gov.go.jp/',cat:'gyosei',note:'社会保険・労働保険手続き',icon:'🏛'},
    {id:'lk5',name:'e-Tax',url:'https://www.e-tax.nta.go.jp/',cat:'gyosei',note:'電子申告',icon:'📝'},
    {id:'lk8',name:'国税庁',url:'https://www.nta.go.jp/',cat:'gyosei',note:'源泉徴収・年末調整',icon:'🏦'},
  ];
  saveLinks();
}

function renderLinkCatFilter(){
  const bar=document.getElementById('link-cat-filter-bar');
  if(!bar)return;
  bar.innerHTML=`<button class="filter-chip ${linkCatFilter==='all'?'active':''}" onclick="setLinkCatFilter('all',this)">すべて</button>`
    +linkCats.map(c=>`<button class="filter-chip ${linkCatFilter===c.id?'active':''}" onclick="setLinkCatFilter('${escHtml(c.id)}',this)">${escHtml(c.icon)} ${escHtml(c.name)}</button>`).join('');
  // lm-catのselectも更新
  const sel=document.getElementById('lm-cat');
  if(sel){sel.innerHTML=linkCats.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.icon)} ${escHtml(c.name)}</option>`).join('');}
}

function setLinkCatFilter(cat,el){
  linkCatFilter=cat;
  renderLinkCatFilter();
  renderLinkGrid();
}

function myLinks(){
  const uid=currentUser?.id;
  return linkItems.filter(l=>!l.ownerId||l.ownerId===uid);
}

function renderLinks(){
  if(!linkItems.length)loadDefaultLinks();
  renderLinkCatFilter();
  renderLinkGrid();
}

function renderLinkGrid(){
  const mine=myLinks();
  const list=linkCatFilter==='all'?mine:mine.filter(l=>l.cat===linkCatFilter);
  const grid=document.getElementById('links-grid');
  if(!list.length){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="icon">🔗</div>リンクがありません<br><span style="font-size:11px">「＋ リンクを追加」から登録できます</span></div>`;
    return;
  }
  const groups={};
  list.forEach(l=>{if(!groups[l.cat])groups[l.cat]=[];groups[l.cat].push(l);});
  grid.innerHTML=Object.entries(groups).map(([cat,items])=>`
    <div style="grid-column:1/-1;font-size:10px;font-family:var(--mono);font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-top:4px;padding-bottom:6px;border-bottom:1px solid var(--border)">${getCatLabel(cat)}</div>
    ${items.map(l=>linkCardHTML(l)).join('')}
  `).join('');
}

function linkCardHTML(l){
  return `<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;align-items:flex-start;gap:12px;transition:all .15s;box-shadow:var(--shadow-sm)"
    onmouseover="this.style.boxShadow='var(--shadow)';this.style.borderColor='#9ca3af'"
    onmouseout="this.style.boxShadow='var(--shadow-sm)';this.style.borderColor='var(--border)'">
    <div style="width:40px;height:40px;border-radius:9px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;border:1px solid var(--border)">
      ${l.icon||'🔗'}
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">${l.name}</div>
      ${l.note?`<div style="font-size:11px;color:var(--text3);margin-bottom:8px">${escHtml(l.note)}</div>`:'<div style="margin-bottom:8px"></div>'}
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <a href="${l.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()"
          style="font-size:12px;color:#fff;background:var(--accent);text-decoration:none;padding:5px 12px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;transition:all .12s;font-weight:600;box-shadow:var(--shadow-sm)"
          onmouseover="this.style.background='var(--accent2)'"
          onmouseout="this.style.background='var(--accent)'">
          開く →
        </a>
        <button onclick="openEditLinkModal('${l.id}')"
          style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text2);cursor:pointer;font-family:var(--font);transition:all .12s"
          onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
          onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">✏️ 編集</button>
        <button onclick="deleteLink('${l.id}')"
          style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;font-family:var(--font);transition:all .12s;font-weight:600"
          onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
          onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑 削除</button>
      </div>
    </div>
  </div>`;
}

function openCatEditModal(){
  renderCatEditList();
  document.getElementById('cat-edit-modal-overlay').classList.add('open');
}

function renderCatEditList(){
  document.getElementById('cat-edit-list').innerHTML=linkCats.map((c,i)=>`
    <div style="display:flex;align-items:center;gap:7px;padding:8px 10px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
      <input value="${c.icon}" maxlength="4"
        style="width:48px;text-align:center;font-size:16px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:4px;outline:none"
        onchange="updateLinkCat(${i},'icon',this.value)">
      <input value="${c.name}" style="flex:1;font-size:13px;font-weight:600;background:#fff;border:1px solid var(--border);border-radius:6px;padding:6px 9px;outline:none;font-family:var(--font)"
        onchange="updateLinkCat(${i},'name',this.value)"
        oninput="updateLinkCat(${i},'name',this.value)">
      <button onclick="deleteLinkCat(${i})"
        style="padding:5px 9px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;font-size:11px;font-weight:600;font-family:var(--font)"
        ${linkItems.some(l=>l.cat===c.id)?`title="このカテゴリにはリンクがあります"`:''}>削除</button>
    </div>`).join('');
}

function updateLinkCat(idx,field,val){
  linkCats[idx][field]=val.trim();
  saveLinkCats();
  renderLinkCatFilter();
  renderLinkGrid();
}

function addLinkCat(){
  const icon=document.getElementById('new-cat-icon').value.trim()||'📁';
  const name=document.getElementById('new-cat-name').value.trim();
  if(!name){toast('⚠ カテゴリ名を入力してください',true);return;}
  const id='cat'+Date.now();
  linkCats.push({id,icon,name});
  saveLinkCats();
  document.getElementById('new-cat-icon').value='';
  document.getElementById('new-cat-name').value='';
  renderCatEditList();
  renderLinkCatFilter();
  toast('🏷 カテゴリを追加しました');
}

function deleteLinkCat(idx){
  const cat=linkCats[idx];
  if(linkItems.some(l=>l.cat===cat.id)){
    toast('⚠ このカテゴリにはリンクがあるため削除できません',true);return;
  }
  if(!confirm(`「${cat.icon} ${cat.name}」を削除しますか？`))return;
  linkCats.splice(idx,1);
  saveLinkCats();
  renderCatEditList();
  renderLinkCatFilter();
  toast('🗑 カテゴリを削除しました');
}

function openAddLinkModal(){
  document.getElementById('link-modal-title').textContent='リンクを追加';
  document.getElementById('leave-edit-id').value='';
  ['lm-name','lm-url','lm-note','lm-icon'].forEach(id=>document.getElementById(id).value='');
  renderLinkCatFilter(); // selectを更新
  document.getElementById('link-modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('lm-name').focus(),100);
}

function openEditLinkModal(id){
  const l=linkItems.find(l=>l.id===id);if(!l)return;
  document.getElementById('link-modal-title').textContent='リンクを編集';
  document.getElementById('leave-edit-id').value=id;
  document.getElementById('lm-name').value=l.name;
  document.getElementById('lm-url').value=l.url;
  renderLinkCatFilter();
  document.getElementById('lm-cat').value=l.cat;
  document.getElementById('lm-note').value=l.note||'';
  document.getElementById('lm-icon').value=l.icon||'';
  document.getElementById('link-modal-overlay').classList.add('open');
}

function saveLink(){
  const name=document.getElementById('lm-name').value.trim();
  const url=document.getElementById('lm-url').value.trim();
  if(!name||!url){toast('⚠ サービス名とURLは必須です',true);return;}
  const editId=document.getElementById('leave-edit-id').value;
  const vals={name,url,cat:document.getElementById('lm-cat').value,note:document.getElementById('lm-note').value.trim(),icon:document.getElementById('lm-icon').value.trim()||'🔗'};
  if(editId){
    const l=linkItems.find(l=>l.id===editId);if(l)Object.assign(l,vals);
  } else {
    linkItems.push({id:'lk'+Date.now(),ownerId:currentUser?.id||'',...vals});
  }
  saveLinks();closeModal('link-modal-overlay');renderLinkGrid();
  toast(editId?'✏️ リンクを更新しました':'🔗 リンクを追加しました');
}

function deleteLink(id){
  if(!confirm('このリンクを削除しますか？'))return;
  linkItems=linkItems.filter(l=>l.id!==id);
  saveLinks();renderLinkGrid();toast('🗑 削除しました');
}
