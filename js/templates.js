// ══ 定型業務テンプレート機能 ══

function _cleanupTemplates(){
  try {
    const raw = localStorage.getItem('roumu_templates');
    if(!raw) return;
    const arr = JSON.parse(raw);
    const cleaned = arr.filter(t => t.cat !== 'nyutai' && t.cat !== 'sankyuiku');
    if(cleaned.length !== arr.length){
      localStorage.setItem('roumu_templates', JSON.stringify(cleaned));
      // メモリ上のtemplates変数も更新
      if(typeof templates !== 'undefined'){
        templates.length = 0;
        cleaned.forEach(t => templates.push(t));
      }
    }
  } catch(e){ console.warn('_cleanupTemplates:', e); }
}

function downloadTemplateCSV(){
  const bom = '\uFEFF';
  const headers = ['タイトル','カテゴリ','頻度','営業日目','担当者','リマインド','メモ','子タスク1','子タスク2','子タスク3','子タスク4','子タスク5'];
  const CAT_NAMES = { kyuyo:'給与計算', sankyuiku:'産休・育休・休職', nyutai:'入社・退職', other:'その他' };
  const rows = [
    headers,
    ...templates.map(t => {
      const member = MEMBERS.find(m=>m.id===t.assignee);
      const subs = (t.subtasks||[]).map(s=>s.title||s);
      return [
        t.title,
        CAT_NAMES[t.cat]||t.cat||'',
        t.offset||'',
        member?.name||'',
        t.remind||'',
        t.note||'',
        subs[0]||'', subs[1]||'', subs[2]||'', subs[3]||'', subs[4]||'',
      ];
    }),
  ];
  // テンプレートが空の場合はサンプル行を追加
  if(templates.length===0){
    rows.push(['勤怠データ確認・修正','給与計算','2','','3','打刻漏れの確認','','','','','']);
    rows.push(['社会保険料納付','給与計算','10','','1','','','','','','']);
    rows.push(['入社手続き','入社・退職','3','','','雇用保険・社保手続き','社保加入届','雇用保険届','','','']);
  }
  const csv = bom + rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=u; a.download='roumu_templates.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
  toast('⬇ テンプレートCSVをダウンロードしました');
}

function importTemplateCSV(event){
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
      const CAT_MAP2 = {'給与計算':'kyuyo','産休・育休・休職':'sankyuiku','入社・退職':'nyutai','その他':'other'};
      let added = 0;

      for(let i=1; i<lines.length; i++){
        const row = parseCsvLine(lines[i]);
        if(!row.length) continue;
        const vals = {}; header.forEach((h,j)=>vals[h]=row[j]||'');

        const title = (vals['タイトル']||'').trim();
        if(!title) continue;

        const catLabel = (vals['カテゴリ']||'').trim();
        const cat = CAT_MAP2[catLabel] || 'other';
        const offsetStr = (vals['営業日目']||'').trim();
        const offset = offsetStr ? String(parseInt(offsetStr)) : 'fixed';
        const fixedday = offset==='fixed' ? null : parseInt(offsetStr)||1;

        const memberName = (vals['担当者']||'').trim();
        const member = MEMBERS.find(m=>m.name===memberName);

        // 子タスク
        const subtasks = ['子タスク1','子タスク2','子タスク3','子タスク4','子タスク5']
          .map(k=>(vals[k]||'').trim())
          .filter(Boolean)
          .map(title=>({id:'ts'+Date.now()+Math.random(), title}));

        templates.push({
          id:'t'+Date.now()+i,
          title, cat, freq: document.getElementById('ta-freq')?.value||'monthly', offset, fixedday,
          assignee: member?.id||'',
          remind: (vals['リマインド']||'').trim(),
          note:   (vals['メモ']||'').trim(),
          subtasks,
        });
        added++;
      }

      saveTemplates();
      renderTemplateList();
      event.target.value='';
      toast(`✅ ${added}件のテンプレートを取込みました`);
    }catch(err){
      toast('⚠ 読み込みに失敗しました: '+err.message, true);
    }
  };
  reader.readAsText(file,'UTF-8');
}

function toggleAllTemplates(checked){
  // 現在フィルタされているテンプレートのIDを取得
  const filtered = templates.filter(t =>
    (tmplCatFilt === 'all' || t.cat === tmplCatFilt) &&
    (tmplFreqFilt === 'all' || (t.freq||'monthly') === tmplFreqFilt)
  );
  // tmplChecked（登録用Set）を完全同期
  if(checked){
    filtered.forEach(t => tmplChecked.add(t.id));
  } else {
    filtered.forEach(t => tmplChecked.delete(t.id));
  }
  // DOM上の削除用チェックボックスも同期
  document.querySelectorAll('.tmpl-chk').forEach(el=>{
    el.checked = checked;
  });
  // DOM上の登録用チェックボックスも同期
  document.querySelectorAll('[data-tid]').forEach(el=>{
    el.checked = checked;
  });
  // カウント表示を更新
  updateTmplCount();
  updateTmplDeleteCount();
}

function updateTmplDeleteCount(){
  // DOMとtmplCheckedの両方を確認して正確なカウントを表示
  const cnt = tmplChecked.size;
  const el = document.getElementById('tmpl-delete-count');
  if(el) el.textContent = cnt > 0 ? `${cnt}件選択中` : '';
  const allChk = document.getElementById('tmpl-select-all');
  const total = document.querySelectorAll('.tmpl-chk').length;
  if(allChk){
    allChk.indeterminate = cnt > 0 && cnt < total;
    if(cnt >= total && total > 0) allChk.checked = true;
    if(cnt === 0) allChk.checked = false;
  }
}

function bulkDeleteTemplates(){
  // tmplChecked（Set）から削除対象を取得
  const ids = [...tmplChecked];
  if(!ids.length){ toast('⚠ テンプレートを選択してください',true); return; }
  if(!confirm(`選択した${ids.length}件のテンプレートを削除しますか？`)) return;
  templates = templates.filter(t=>!ids.includes(String(t.id)));
  saveTemplates(); renderTemplateList();
  const allChk = document.getElementById('tmpl-select-all');
  if(allChk) allChk.checked = false;
  const cntEl = document.getElementById('tmpl-delete-count');
  if(cntEl) cntEl.textContent = '';
  toast(`🗑 ${ids.length}件のテンプレートを削除しました`);
}

function saveTemplates(){localStorage.setItem('roumu_templates',JSON.stringify(templates));}

function loadDefaultTemplates(){
  templates=[
    {id:'t1',title:'勤怠データ確認・修正',cat:'kyuyo',pri:'high',offset:'fixed',fixedday:15,assignee:'',remind:'1',note:'打刻漏れ・遅刻早退の確認'},
    {id:'t2',title:'給与計算',cat:'kyuyo',pri:'high',offset:'fixed',fixedday:20,assignee:'',remind:'3',note:'勤怠締め後に開始'},
    {id:'t3',title:'社会保険料の納付',cat:'kyuyo',pri:'high',offset:'3',fixedday:null,assignee:'',remind:'3',note:'毎月末日までに納付'},
    {id:'t4',title:'源泉所得税の納付',cat:'kyuyo',pri:'high',offset:'-10',fixedday:null,assignee:'',remind:'3',note:'翌月10日まで'},
    {id:'t5',title:'給与明細の配布・送付',cat:'kyuyo',pri:'mid',offset:'fixed',fixedday:25,assignee:'',remind:'1',note:'給与支払い日前後に配布'},
    {id:'t6',title:'月次労務レポート作成',cat:'kyuyo',pri:'mid',offset:'fixed',fixedday:28,assignee:'',remind:'3',note:'月末締めで翌月初に提出'},
  ];
  saveTemplates();
}

function openTemplateModal(){
  if(!templates.length) loadDefaultTemplates();
  // 対象月のデフォルト設定（今月）
  const y=T.getFullYear(),m=T.getMonth()+1;
  document.getElementById('tmpl-bulk-month').value=`${y}-${pad(m)}`;
  tmplCatFilt='all';
  tmplFreqFilt='all';
  tmplChecked=new Set();
  closeAddTemplateForm();
  renderTemplateList();
  document.getElementById('tmpl-modal-overlay').classList.add('open');
  // 担当者select更新
  const sel=document.getElementById('ta-assignee');
  sel.innerHTML='<option value="">未割り当て</option>'+MEMBERS.map(m=>`<option value="${escHtml(m.id)}">${escHtml(m.name)}</option>`).join('');
}

function setTmplFreq(freq, el){
  tmplFreqFilt = freq;
  Array.from(document.querySelectorAll("[id^=tmpl-freq-]")).forEach(function(b){
    b.classList.toggle("active", b.id === "tmpl-freq-" + freq);
  });
  renderTemplateList();
}

function setTmplCat(cat,el){
  tmplCatFilt=cat;
  document.querySelectorAll('#tmpl-modal-overlay .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderTemplateList();
}

function renderTemplateList(){
  const filtered=templates.filter(t=>{
    if(tmplCatFilt!=='all' && t.cat!==tmplCatFilt) return false;
    if(tmplFreqFilt!=='all' && (t.freq||'monthly')!==tmplFreqFilt) return false;
    return true;
  });
  const el=document.getElementById('tmpl-list');
  if(!filtered.length){
    el.innerHTML='<div class="empty-state" style="padding:20px"><div class="icon">📋</div>テンプレートがありません</div>';
    updateTmplCount();return;
  }
  // カテゴリごとにグループ表示
  const cats=['kyuyo','sankyuiku','nyutai','other'];
  const catIcons={kyuyo:'💴',sankyuiku:'🤱',nyutai:'🚪',other:'📁'};
  let html='';
  cats.forEach(cat=>{
    const items=filtered.filter(t=>t.cat===cat);
    if(!items.length)return;
    if(tmplCatFilt==='all'){
      html+=`<div style="font-size:10px;font-family:var(--mono);font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;padding:6px 4px 4px">${catIcons[cat]} ${CAT_LABELS[cat]}</div>`;
    }
    items.forEach(t=>{
      const checked=tmplChecked.has(t.id);
      const member=MEMBERS.find(m=>m.id===t.assignee);
      const dueDesc = t.offset==='fixed'
        ? `${t.fixedday}日`
        : `第${t.offset}営業日`;
      html+=`<div style="display:flex;align-items:center;gap:6px;padding:9px 12px;border-radius:8px;background:var(--surface);border:1px solid var(--border);transition:all .12s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
        <!-- 統合チェックボックス（削除・登録両用）tmplCheckedで一元管理 -->
        <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">
          <input type="checkbox" class="tmpl-chk" data-id="${t.id}" data-tid="${t.id}" ${checked?'checked':''}
            onchange="tmplToggleUnified('${t.id}',this.checked)"
            style="width:14px;height:14px;accent-color:var(--accent);flex-shrink:0" title="選択（登録・削除共通）">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px">${escHtml(t.title)}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              <span style="font-size:10px;font-family:var(--mono);color:var(--text3)">📅 ${dueDesc}</span>
              <span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${ (t.freq||'monthly')==='monthly'?'#dbeafe':(t.freq==='yearly'?'#dcfce7':'#fef3c7') };color:${ (t.freq||'monthly')==='monthly'?'#1d4ed8':(t.freq==='yearly'?'#166534':'#92400e') };border:1px solid ${ (t.freq||'monthly')==='monthly'?'#bfdbfe':(t.freq==='yearly'?'#bbf7d0':'#fde68a') }">${ (t.freq||'monthly')==='monthly'?'📅 月次':(t.freq==='yearly'?'📆 年次':'⚡ イレギュラー') }</span>
              ${member?`<span style="font-size:10px;color:var(--text2)">👤 ${member.name}</span>`:''}
              ${t.note?`<span onclick='event.stopPropagation();toggleCardNote("${t.id}")' id='note-chip-${t.id}' style='font-size:10px;color:var(--text3);cursor:pointer;padding:1px 6px;border-radius:4px;background:var(--surface2);border:1px solid var(--border);display:inline-flex;align-items:center;gap:3px' title='クリックでメモを展開'>📝 <span id='note-text-${t.id}' style='max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom'>${t.note.slice(0,20)}${t.note.length>20?'…':''}</span> <span id='note-arr-${t.id}'>▾</span></span><div id='note-exp-${t.id}' style='display:none'></div>`:''}
              ${(t.subtasks||[]).length?`<span style="font-size:10px;color:var(--text3)">🔸 子${(t.subtasks||[]).length}件</span>`:''}
            </div>
          </div>
        </label>
        <button onclick="deleteTemplate(event,'${t.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:3px 5px;border-radius:4px;font-size:12px;flex-shrink:0" title="削除">🗑</button>
      </div>`;
    });
  });
  el.innerHTML=html;
  updateTmplCount();
}

function tmplToggle(id,checked){
  if(checked)tmplChecked.add(id);else tmplChecked.delete(id);
  updateTmplCount();
}

function tmplToggleUnified(id,checked){
  if(checked){ tmplChecked.add(id); } else { tmplChecked.delete(id); }
  updateTmplCount();
  updateTmplDeleteCount();
  // 全選択チェックボックスの indeterminate 状態を更新
  const allChk = document.getElementById('tmpl-select-all');
  const total = document.querySelectorAll('.tmpl-chk').length;
  const checkedCount = document.querySelectorAll('.tmpl-chk:checked').length;
  if(allChk){
    allChk.indeterminate = checkedCount > 0 && checkedCount < total;
    allChk.checked = checkedCount === total && total > 0;
  }
}

function updateTmplCount(){
  const filtered=templates.filter(t=>tmplCatFilt==='all'||t.cat===tmplCatFilt);
  const count=filtered.filter(t=>tmplChecked.has(t.id)).length;
  document.getElementById('tmpl-selected-count').textContent=`${count}件選択中`;
}

function openAddTemplateForm(){
  document.getElementById('tmpl-add-form').style.display='block';
  document.getElementById('ta-offset').onchange=function(){
    document.getElementById('ta-fixedday-group').style.display=this.value==='fixed'?'':'none';
  };
  tmplSubtasks=[];
  renderTmplSubtasks();
}

function addTmplSubtask(){
  const inp=document.getElementById('ta-subtask-input');
  const title=inp.value.trim();
  if(!title)return;
  tmplSubtasks.push({id:'ts'+Date.now(),title});
  inp.value='';
  renderTmplSubtasks();
}

function deleteTmplSubtask(id){
  tmplSubtasks=tmplSubtasks.filter(s=>s.id!==id);
  renderTmplSubtasks();
}

function renderTmplSubtasks(){
  const el=document.getElementById('ta-subtask-list');
  if(!el)return;
  el.innerHTML=tmplSubtasks.map(s=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border:1px solid var(--border);border-radius:6px">
      <span style="font-size:11px;color:var(--text3)">▸</span>
      <span style="flex:1;font-size:12px;color:var(--text)">${escHtml(s.title)}</span>
      <button onclick="deleteTmplSubtask('${s.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;padding:2px 4px">🗑</button>
    </div>`).join('');
}

function closeAddTemplateForm(){
  document.getElementById('tmpl-add-form').style.display='none';
  ['ta-title','ta-note','ta-fixedday','ta-subtask-input'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  tmplSubtasks=[];
  renderTmplSubtasks();
}

function saveTemplate(){
  const title=document.getElementById('ta-title').value.trim();
  if(!title){toast('⚠ テンプレート名を入力してください',true);return;}
  const offset=document.getElementById('ta-offset').value;
  const fixedday=offset==='fixed'?parseInt(document.getElementById('ta-fixedday').value)||1:null;
  templates.push({
    id:'t'+Date.now(),
    title,
    cat:document.getElementById('ta-cat').value,
    offset,fixedday,
    assignee:document.getElementById('ta-assignee').value,
    remind:document.getElementById('ta-remind').value,
    note:document.getElementById('ta-note').value.trim(),
    subtasks:[...tmplSubtasks],
  });
  saveTemplates();
  closeAddTemplateForm();
  renderTemplateList();
  toast('📋 テンプレートを保存しました');
}

function deleteTemplate(e,id){
  e.preventDefault();e.stopPropagation();
  if(!confirm('このテンプレートを削除しますか？'))return;
  templates=templates.filter(t=>t.id!==id);
  tmplChecked.delete(id);
  saveTemplates();renderTemplateList();toast('🗑 削除しました');
}

function bulkRegisterTemplates(){
  const monthVal=document.getElementById('tmpl-bulk-month').value;
  if(!monthVal){toast('⚠ 対象月を選択してください',true);return;}
  if(!tmplChecked.size){toast('⚠ テンプレートを1件以上選択してください',true);return;}
  const[y,m]=[parseInt(monthVal.split('-')[0]),parseInt(monthVal.split('-')[1])];
  const lastDay=new Date(y,m,0).getDate();
  const selected=templates.filter(t=>tmplChecked.has(t.id));
  selected.forEach(t=>{
    let due;
    if(t.offset==='fixed'){
      // 固定日
      const day = Math.min(t.fixedday||1, lastDay);
      due = `${y}-${pad(m)}-${pad(day)}`;
    } else {
      // 月初から第N営業日
      const n = parseInt(t.offset)||1;
      const result = getNthBusinessDayOfMonth(n, y, m-1); // m-1は0-indexed
      due = `${result.getFullYear()}-${pad(result.getMonth()+1)}-${pad(result.getDate())}`;
    }
    tasks.push({
      id:Date.now()+Math.random(),
      title:t.title,cat:t.cat,pri:t.pri,due,
      remind:t.remind,note:t.note,rep:'',
      status:'todo',assignee:t.assignee,approver:'',
      comments:[],files:[],
      subtasks:(t.subtasks||[]).map(s=>({...s,id:'s'+Date.now()+Math.random(),status:'todo'})),
    });
  });
  saveTasks();renderAll();
  closeModal('tmpl-modal-overlay');
  toast(`✅ ${selected.length}件のタスクを${y}年${m}月に一括登録しました`);
  if(isGasEnabled())syncData(true, true);
}
