// ══ トピック（月次お知らせ）機能 ══

function getAllTopicItems(){
  const result = {};
  for(let i=0; i<localStorage.length; i++){
    const key = localStorage.key(i);
    if(key && key.startsWith('roumu_topics_')){
      try{ result[key] = JSON.parse(localStorage.getItem(key)||'[]'); } catch(e){}
    }
  }
  return result;
}

function applyAllTopicItems(data){
  if(typeof data !== 'object' || Array.isArray(data)) return;
  Object.entries(data).forEach(([key, items])=>{
    if(key.startsWith('roumu_topics_')){
      localStorage.setItem(key, JSON.stringify(items));
    }
  });
}

function topicKey(y, m){ return `roumu_topics_${y}_${pad(m)}`; }

function activeTopicMonths(){
  const now=new Date();
  const y=now.getFullYear(),m=now.getMonth()+1,d=now.getDate();
  const months=[{y,m}];
  if(d<=10){
    const py=m===1?y-1:y, pm=m===1?12:m-1;
    months.unshift({y:py,m:pm});
  }
  return months;
}

function allTopicKeys(){
  const keys=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith('roumu_topics_'))keys.push(k);
  }
  return keys.sort().reverse();
}

function loadCurrentTopics(){
  const now=new Date();
  topicItems=JSON.parse(localStorage.getItem(topicKey(now.getFullYear(),now.getMonth()+1))||'[]');
}

function saveTopics(){
  const now=new Date();
  localStorage.setItem(topicKey(now.getFullYear(),now.getMonth()+1),JSON.stringify(topicItems));
}

function topicLabel(item){
  const labels={nyusha:'入社',taishoku:'退職',kyushoku:'休職',shokyu:'昇給',jinji:'人事異動',other:item.otherLabel||'その他',info:'情報',warn:'注意',done:'完了'};
  const s=TOPIC_STYLES[item.type]||TOPIC_STYLES.other;
  return `<span style="font-size:10px;font-family:var(--mono);font-weight:700;padding:1px 7px;border-radius:10px;background:${s.border};color:${s.color};margin-right:6px;flex-shrink:0">${s.icon} ${labels[item.type]||item.type}</span>`;
}

function renderTopics(){
  const section = document.getElementById('topic-section');
  if(section) section.style.display = majorCat==='all' ? '' : 'none';
  if(majorCat!=='all') return;
  const now=new Date();
  const y=now.getFullYear(),m=now.getMonth()+1;
  const el=document.getElementById('topic-month-label');
  if(el)el.textContent=`${m}月のトピック`;
  const active=activeTopicMonths();
  let activeItems=[];
  active.forEach(({y:ay,m:am})=>{
    const items=JSON.parse(localStorage.getItem(topicKey(ay,am))||'[]');
    items.forEach(item=>activeItems.push({...item,_month:`${am}月`}));
  });
  const badge=document.getElementById('topic-count-badge');
  if(badge){
    if(activeItems.length){badge.textContent=activeItems.length;badge.style.display='';}
    else badge.style.display='none';
  }
  const display=document.getElementById('topic-display');
  if(!display)return;
  if(!activeItems.length){
    display.innerHTML='<div style="font-size:12px;color:var(--text3)">今月のトピックはありません。「編集」から追加できます。</div>';
  } else {
    display.innerHTML=activeItems.map(item=>{
      const s=TOPIC_STYLES[item.type]||TOPIC_STYLES.info;
      const monthTag=active.length>1?`<span style="font-size:10px;font-family:var(--mono);padding:1px 6px;border-radius:4px;background:rgba(0,0,0,.06);color:var(--text3);margin-right:6px">${item._month}</span>`:'';
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:8px;background:${s.bg};border:1px solid ${s.border};margin-bottom:6px">
        <span style="font-size:14px;flex-shrink:0;margin-top:1px">${s.icon}</span>
        <div style="flex:1;font-size:12px;color:${s.color};line-height:1.6;font-weight:500">${monthTag}<span style="display:flex;flex-wrap:wrap;align-items:center;gap:4px">${topicLabel(item)}${escHtml(item.text)}</span></div>
        <span style="font-size:10px;color:var(--text3);white-space:nowrap;margin-top:2px">${item.by||''}</span>
      </div>`;
    }).join('');
  }
  renderPastTopics(active);
}

function renderPastTopics(activeMonths){
  const container=document.getElementById('topic-past-area');
  if(!container)return;
  const activeKeys=new Set(activeMonths.map(({y,m})=>topicKey(y,m)));
  const pastKeys=allTopicKeys().filter(k=>!activeKeys.has(k));
  if(!pastKeys.length){container.innerHTML='';return;}
  container.innerHTML=pastKeys.map((k,i)=>{
    const match=k.match(/roumu_topics_(\d{4})_(\d{2})/);
    if(!match)return'';
    const label=`${parseInt(match[2])}月（${match[1]}年）`;
    const items=JSON.parse(localStorage.getItem(k)||'[]');
    if(!items.length)return'';
    const itemsHtml=items.map(item=>{
      const s=TOPIC_STYLES[item.type]||TOPIC_STYLES.info;
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:7px;background:${s.bg};border:1px solid ${s.border};margin-bottom:5px">
        <span style="font-size:13px;flex-shrink:0">${s.icon}</span>
        <div style="flex:1;font-size:12px;color:${s.color};line-height:1.5">${escHtml(item.text)}</div>
        <span style="font-size:10px;color:var(--text3);white-space:nowrap">${item.by||''}</span>
      </div>`;
    }).join('');
    return `<details style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:6px">
      <summary style="padding:9px 14px;background:var(--surface2);cursor:pointer;font-size:12px;font-weight:700;color:var(--text2);display:flex;align-items:center;gap:8px;list-style:none;user-select:none"
        onmouseover="this.style.background='var(--accent-light)'" onmouseout="this.style.background='var(--surface2)'">
        <span>📅 ${label}</span>
        <span style="font-size:10px;font-family:var(--mono);padding:1px 6px;border-radius:8px;background:var(--border);color:var(--text3)">${items.length}件</span>
        <span style="margin-left:auto;font-size:10px;color:var(--text3)">▼</span>
      </summary>
      <div style="padding:10px 12px">${itemsHtml}</div>
    </details>`;
  }).join('');
}

function openTopicEditor(){
  loadCurrentTopics();
  document.getElementById('topic-editor').style.display='block';
  renderTopicEditList();
  setTimeout(()=>document.getElementById('topic-input')?.focus(),80);
}

function closeTopicEditor(){
  document.getElementById('topic-editor').style.display='none';
}

function renderTopicEditList(){
  const el=document.getElementById('topic-edit-list');
  if(!el)return;
  if(!topicItems.length){
    el.innerHTML='<div style="font-size:11px;color:var(--text3)">まだトピックがありません</div>';
    return;
  }
  el.innerHTML=topicItems.map((item,i)=>{
    const s=TOPIC_STYLES[item.type]||TOPIC_STYLES.info;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;background:#fff;border:1px solid var(--border)">
      <span style="font-size:13px">${s.icon}</span>
      <span style="flex:1;font-size:12px;color:var(--text)">${escHtml(item.text)}</span>
      <span style="font-size:10px;color:var(--text3)">${item.by||''}</span>
      <button onclick="deleteTopic(${i})"
        style="padding:3px 7px;border-radius:5px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer;font-size:11px;font-family:var(--font);font-weight:600"
        onmouseover="this.style.background='var(--red)';this.style.color='#fff'"
        onmouseout="this.style.background='#fef2f2';this.style.color='var(--red)'">🗑</button>
    </div>`;
  }).join('');
}

function addTopic(){
  const text=document.getElementById('topic-input')?.value.trim();
  if(!text){toast('⚠ 内容を入力してください',true);return;}
  const type=document.getElementById('topic-type')?.value||'nyusha';
  const otherLabel=type==='other'?(document.getElementById('topic-other-label')?.value.trim()||'その他'):'';
  topicItems.push({id:'tp'+Date.now(),text,type,otherLabel,by:currentUser?.name||'',at:fmt(T)});
  saveTopics();
  document.getElementById('topic-input').value='';
  if(document.getElementById('topic-other-label')) document.getElementById('topic-other-label').value='';
  renderTopicEditList();
  toast('📌 トピックを追加しました');
}

function deleteTopic(idx){
  topicItems.splice(idx,1);
  saveTopics();renderTopicEditList();
  toast('🗑 削除しました');
}
