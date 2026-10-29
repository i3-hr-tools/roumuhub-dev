// ══ 管理設定機能（GAS接続・承認ログ） ══

function openGasModal(){
  const current = getGasUrl();
  document.getElementById('gas-url-input').value = current === 'YOUR_GAS_WEB_APP_URL_HERE' ? '' : current;
  document.getElementById('gas-test-result').style.display = 'none';
  document.getElementById('gas-modal-overlay').classList.add('open');
}

async function testGasConnection(){
  const url = document.getElementById('gas-url-input').value.trim();
  const result = document.getElementById('gas-test-result');
  const btn = document.getElementById('gas-test-btn');
  if(!url){
    showGasResult('error','⚠ URLを入力してください');
    return;
  }
  if(!url.startsWith('https://script.google.com')){
    showGasResult('warn','⚠ GASのURLは https://script.google.com から始まります。URLを確認してください。');
    return;
  }
  btn.textContent = '⏳ テスト中...';
  btn.disabled = true;
  try{
    const res = await fetch(`${url}?action=ping`, {method:'GET'});
    const text = await res.text();
    let data;
    try{ data = JSON.parse(text); }catch(e){ data = {text}; }
    if(res.ok){
      showGasResult('success',`✅ 接続成功！GASに正常に接続できました。<br>レスポンス: ${JSON.stringify(data).slice(0,80)}`);
    } else {
      showGasResult('error',`❌ 接続失敗（ステータス: ${res.status}）<br>GASのデプロイ設定を確認してください。`);
    }
  }catch(e){
    if(e.message.includes('Failed to fetch')||e.message.includes('CORS')){
      showGasResult('warn','⚠ CORSエラーが発生しました。GASのデプロイ設定で「アクセスできるユーザー」を「全員」に変更してください。');
    } else {
      showGasResult('error',`❌ 接続エラー: ${e.message}`);
    }
  }finally{
    btn.textContent = '🔌 接続テスト';
    btn.disabled = false;
  }
}

function showGasResult(type, msg){
  const el = document.getElementById('gas-test-result');
  const styles = {
    success: 'background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46',
    error:   'background:#fef2f2;border:1px solid #fca5a5;color:#991b1b',
    warn:    'background:#fffbeb;border:1px solid #fcd34d;color:#92400e',
  };
  el.style.cssText = `display:block;padding:12px 14px;border-radius:8px;margin-bottom:14px;font-size:12px;line-height:1.6;${styles[type]||styles.warn}`;
  el.innerHTML = msg;
}

function switchAdminTab(tab){
  ['members','log','settings'].forEach(t=>{
    const btn=document.getElementById('admin-tab-'+t);
    const content=document.getElementById('admin-'+t+'-content');
    if(btn){
      if(t===tab){
        btn.style.background='var(--accent)';
        btn.style.color='#fff';
        btn.style.boxShadow='0 1px 4px rgba(0,0,0,.15)';
      } else {
        btn.style.background='transparent';
        btn.style.color='var(--text2)';
        btn.style.boxShadow='none';
      }
    }
    if(content)content.style.display=t===tab?'flex':'none';
  });
  if(tab==='log'){renderLogTable();renderLogStats();}
  if(tab==='members'){renderMembersPanel();}
  if(tab==='settings'){
    const inp=document.getElementById('settings-gas-url');
    if(inp){const cur=getGasUrl();inp.value=cur==='YOUR_GAS_WEB_APP_URL_HERE'?'':cur;}
    updateGasStatusBadge();
  }
}

async function testGasFromSettings(){
  const url=document.getElementById('settings-gas-url').value.trim();
  const result=document.getElementById('settings-gas-result');
  result.style.display='block';
  result.style.cssText='display:block;padding:8px 12px;border-radius:7px;font-size:12px;background:var(--surface2);color:var(--text2)';
  result.textContent='接続テスト中...';
  if(!url){result.textContent='⚠ URLを入力してください';result.style.background='var(--yellow-light)';result.style.color='var(--yellow)';return;}
  try{
    const res=await fetch(`${url}?action=ping`);
    const data=await res.json();
    if(data.ok){result.textContent='✅ 接続成功！GASに正常に接続できました';result.style.background='var(--green-light)';result.style.color='var(--green)';}
    else{result.textContent=`❌ 接続失敗（${res.status}）`;result.style.background='var(--red-light)';result.style.color='var(--red)';}
  }catch(e){
    result.textContent='⚠ CORSエラーの可能性があります。GASのデプロイ設定で「アクセスできるユーザー：全員」に変更してください';
    result.style.background='var(--yellow-light)';result.style.color='var(--yellow)';
  }
}

// 接続・同期テスト。実データへの書き込み（saveAll等）は一切行わず、
// 読み取り専用の確認だけに限定している（以前はテスト用ダミーデータでsaveAllを呼び、
// 本番データを上書きしてしまう重大な不具合があったため廃止した）
async function testSyncMinimal(){
  const url = getGasUrl();
  const resultEl = document.getElementById('sync-test-result');
  resultEl.style.display = 'block';
  resultEl.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:7px;background:var(--surface2);color:var(--text2)';
  resultEl.textContent = '⏳ テスト中...';

  const steps = [];

  // Step1: GETでpingを確認（データ変更なし）
  try {
    const r = await fetch(`${url}?action=ping`, { redirect:'follow' });
    const d = await r.json();
    steps.push(`✅ GET ping: version=${d.version||'?'}`);
  } catch(e) {
    steps.push(`❌ GET ping失敗: ${e.message}`);
    resultEl.innerHTML = steps.join('<br>');
    return;
  }

  // Step2: loadを確認（読み取りのみ・データ変更なし）
  try {
    const tokenParam = gAccessToken ? '&token=' + encodeURIComponent(gAccessToken) : '';
    const r = await fetch(`${url}?action=load${tokenParam}`, { redirect:'follow' });
    const d = await r.json();
    if(d.error){
      steps.push(`❌ GET load: ${d.error}`);
    } else {
      const taskCount = (d.tasks||[]).length;
      const memberCount = (d.members||[]).length;
      steps.push(`✅ GET load: タスク${taskCount}件・メンバー${memberCount}件を取得（読み取りのみ・データ変更なし）`);
    }
  } catch(e) {
    steps.push(`❌ GET load失敗: ${e.message}`);
  }

  resultEl.style.background = steps.every(s=>s.startsWith('✅')) ? 'var(--green-light)' : 'var(--yellow-light)';
  resultEl.style.color = steps.every(s=>s.startsWith('✅')) ? 'var(--green)' : '#92400e';
  resultEl.innerHTML = steps.join('<br>');
}

function saveGasFromSettings(){
  const url=document.getElementById('settings-gas-url').value.trim();
  if(url)localStorage.setItem('gas_url',url);
  else localStorage.removeItem('gas_url');
  updateGasIndicator();
  updateGasStatusBadge();
  updateGasMissingBanner();
  // GAS URLが設定されたら自動取得を開始
  if(url) startAutoPoll();
  toast(url?'✅ GAS URLを保存しました':'🔌 GAS URLをリセットしました');
}

async function copyGasCode(){
  try{
    await navigator.clipboard.writeText(GAS_CODE_FOR_COPY);
    const btn = document.getElementById('copy-gas-btn');
    btn.textContent = '✅ コピーしました！';
    btn.style.background = 'var(--green)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--green)';
    setTimeout(()=>{
      btn.textContent = '📋 GASコードをコピー';
      btn.style.background = 'var(--accent-light)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
    }, 2000);
  }catch(e){
    toast('⚠ コピーに失敗しました。手動でコピーしてください。',true);
  }
}

function switchResTab(tab){
  const isLinks=(tab==='links');
  const tabLinks=document.getElementById('res-tab-links');
  const tabDocs=document.getElementById('res-tab-docs');
  const contLinks=document.getElementById('res-links-content');
  const contDocs=document.getElementById('res-docs-content');
  if(tabLinks)tabLinks.classList.toggle('active',isLinks);
  if(tabDocs)tabDocs.classList.toggle('active',!isLinks);
  if(contLinks)contLinks.style.display=isLinks?'flex':'none';
  if(contDocs)contDocs.style.display=isLinks?'none':'flex';
  if(isLinks)renderLinks();
  else{renderDocList();renderDocTagFilter();}
}

function saveLogs(){localStorage.setItem('approval_logs',JSON.stringify(approvalLogs));}

// ══ 承認ログ／操作ログのサブタブ切替 ══
function switchLogSubTab(tab){
  const isApproval=(tab==='approval');
  document.getElementById('logsub-tab-approval').classList.toggle('active',isApproval);
  document.getElementById('logsub-tab-activity').classList.toggle('active',!isApproval);
  document.getElementById('logsub-approval').style.display=isApproval?'flex':'none';
  document.getElementById('logsub-activity').style.display=isApproval?'none':'flex';
  if(!isApproval) renderActivityLogTable();
}

const ACTIVITY_ACTION_LABELS={created:'🆕 作成',updated:'✏️ 編集',status:'🔄 ステータス変更',deleted:'🗑 削除'};
const ACTIVITY_ACTION_COLORS={created:'var(--green)',updated:'var(--blue)',status:'#8b5cf6',deleted:'var(--red)'};

function setActivityLogFilter(f,el){
  activityLogFilter=f;
  document.querySelectorAll('#logsub-activity .filter-chip').forEach(c=>c.classList.remove('active'));
  if(el) el.classList.add('active');
  renderActivityLogTable();
}

function renderActivityLogTable(){
  const sel=document.getElementById('activity-log-member-filter');
  if(sel && sel.children.length===1){
    MEMBERS.forEach(m=>{
      const o=document.createElement('option');o.value=m.id;o.textContent=m.name;sel.appendChild(o);
    });
  }
  const memberFiltVal=sel?.value||'all';
  let list=[...activityLogs].reverse(); // 新しい順
  if(activityLogFilter!=='all') list=list.filter(l=>l.action===activityLogFilter);
  if(memberFiltVal!=='all') list=list.filter(l=>l.actorId===memberFiltVal);

  const area=document.getElementById('activity-log-table-area');
  if(!area) return;
  if(!list.length){
    area.innerHTML=`<div class="log-empty"><div style="font-size:32px;margin-bottom:10px;opacity:.3">📝</div>ログがありません</div>`;
    return;
  }
  area.innerHTML=`<table class="log-table">
    <thead><tr>
      <th>日時</th>
      <th>操作</th>
      <th>タスク名</th>
      <th>カテゴリ</th>
      <th>操作者</th>
      <th>詳細</th>
    </tr></thead>
    <tbody>${list.map(l=>{
      const cat=CAT_LABELS[l.taskCat]||l.taskCat||'-';
      const color=ACTIVITY_ACTION_COLORS[l.action]||'var(--text2)';
      const label=ACTIVITY_ACTION_LABELS[l.action]||l.action;
      return `<tr>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text2);white-space:nowrap">${escHtml(l.atLabel)}</td>
        <td><span class="log-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${label}</span></td>
        <td style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(l.taskTitle)}">${escHtml(l.taskTitle)}</td>
        <td><span class="tag tag-cat" style="font-size:10px">${escHtml(cat)}</span></td>
        <td style="font-size:12px;font-weight:600">${escHtml(l.actorName)}</td>
        <td style="font-size:11px;color:var(--text2)">${escHtml(l.detail)||'—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

function exportActivityLogCsv(){
  if(!activityLogs.length){toast('⚠ エクスポートするログがありません',true);return;}
  const header=['日時','操作','タスク名','カテゴリ','操作者','詳細'];
  const rows=activityLogs.map(l=>[
    l.atLabel,ACTIVITY_ACTION_LABELS[l.action]||l.action,l.taskTitle,CAT_LABELS[l.taskCat]||l.taskCat||'',l.actorName,l.detail||'',
  ]);
  const csv='\uFEFF'+[header,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`操作ログ_${fmt(new Date())}.csv`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`⬇ ${activityLogs.length}件の操作ログをエクスポートしました`);
}

function clearActivityLog(){
  if(!confirm(`操作ログを全件削除しますか？\n※この操作は取り消せません（${activityLogs.length}件）`))return;
  activityLogs=[];saveActivityLogs();renderActivityLogTable();toast('🗑 操作ログを削除しました');
}

function setLogFilter(f,el){
  logFilter=f;
  document.querySelectorAll('.log-filter-bar .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderLogTable();
}

function renderLogStats(){
  const approved=approvalLogs.filter(l=>l.action==='approved').length;
  const rejected=approvalLogs.filter(l=>l.action==='rejected').length;
  const pending=tasks.filter(t=>t.status==='review').length;
  document.getElementById('ls-approved').textContent=approved;
  document.getElementById('ls-rejected').textContent=rejected;
  document.getElementById('ls-total').textContent=approvalLogs.length;
  document.getElementById('ls-pending').textContent=pending;
  const apLogEl=document.getElementById('mc-approvallog');if(apLogEl)apLogEl.textContent=approvalLogs.length;
}

function renderLogTable(){
  // メンバーフィルターselect更新
  const sel=document.getElementById('log-member-filter');
  if(sel.children.length===1){
    MEMBERS.forEach(m=>{
      const o=document.createElement('option');o.value=m.id;o.textContent=m.name;sel.appendChild(o);
    });
  }
  const memberFiltVal=sel.value||'all';
  let list=[...approvalLogs];
  if(logFilter==='approved')list=list.filter(l=>l.action==='approved');
  if(logFilter==='rejected')list=list.filter(l=>l.action==='rejected');
  if(memberFiltVal!=='all')list=list.filter(l=>l.approverId===memberFiltVal);

  const area=document.getElementById('log-table-area');
  if(!list.length){
    area.innerHTML=`<div class="log-empty"><div style="font-size:32px;margin-bottom:10px;opacity:.3">📋</div>ログがありません</div>`;
    return;
  }
  area.innerHTML=`<table class="log-table">
    <thead><tr>
      <th>日時</th>
      <th>アクション</th>
      <th>タスク名</th>
      <th>カテゴリ</th>
      <th>担当者</th>
      <th>承認者</th>
      <th>差し戻し理由</th>
    </tr></thead>
    <tbody>${list.map(l=>{
      const cat=CAT_LABELS[l.taskCat]||l.taskCat;
      const badge=l.action==='approved'
        ?`<span class="log-badge approved">✓ 承認</span>`
        :`<span class="log-badge rejected">✕ 差戻</span>`;
      return `<tr>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text2);white-space:nowrap">${l.atLabel}</td>
        <td>${badge}</td>
        <td style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${l.taskTitle}">${l.taskTitle}</td>
        <td><span class="tag tag-cat" style="font-size:10px">${cat}</span></td>
        <td style="font-size:12px">${l.assigneeName}</td>
        <td style="font-size:12px;font-weight:600">${l.approverName}</td>
        <td style="font-size:11px;color:var(--text2)">${l.reason||'—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
  renderLogStats();
}

function exportLogCsv(){
  if(!approvalLogs.length){toast('⚠ エクスポートするログがありません',true);return;}
  const header=['日時','アクション','タスク名','カテゴリ','担当者','承認者','差し戻し理由'];
  const rows=approvalLogs.map(l=>[
    l.atLabel,
    l.action==='approved'?'承認':'差し戻し',
    l.taskTitle,
    CAT_LABELS[l.taskCat]||l.taskCat,
    l.assigneeName,
    l.approverName,
    l.reason||''
  ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
  const csv='\uFEFF'+[header.join(','),...rows].join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const d=new Date();
  a.href=url;a.download=`approval-log-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}.csv`;
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`⬇ ${approvalLogs.length}件のログをエクスポートしました`);
}

function clearLog(){
  if(!confirm(`承認ログを全件削除しますか？\n※この操作は取り消せません（${approvalLogs.length}件）`))return;
  approvalLogs=[];saveLogs();renderLogTable();renderLogStats();toast('🗑 ログを削除しました');
}
