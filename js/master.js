// ══ チェックリストマスタ管理機能 ══

function getMasterItems(key){
  const m = CHECKLIST_MASTERS[key]; if(!m) return [];
  const c = localStorage.getItem(m.storageKey);
  if(c){
    try{
      const arr = JSON.parse(c);
      if(Array.isArray(arr)) return arr.map(it=> typeof it==='object'
        ? {title:it.title, importance:it.importance||'', desc:it.desc||'', due:it.due||''}
        : {title:it, importance:'', desc:'', due:''});
    }catch(e){}
  }
  return m.defaults.map(it=>({...it, due:''}));
}

function saveMasterItems(key, items){
  const m = CHECKLIST_MASTERS[key]; if(m) localStorage.setItem(m.storageKey, JSON.stringify(items));
  scheduleAutoSync(); // GASへの同期をスケジュール（マスタ項目も他端末・他メンバーと共有する）
}

function getHireChecklistItems(ht){ return getMasterItems(ht); }

function saveHireChecklistItems(ht, items){ return saveMasterItems(ht, items); }

function normalizeMasterType(v){ return CSV_TYPE_TO_KEY[(v||'').trim()] || CSV_TYPE_TO_KEY[(v||'').trim().toLowerCase()] || null; }

function normalizeImportance(v){
  const s=(v||'').trim();
  if(s==='必須'||s.toLowerCase()==='must')      return 'must';
  if(s==='推奨'||s.toLowerCase()==='recommend') return 'recommend';
  return '';
}

function downloadMasterCsvTemplate(key){
  const bom='\uFEFF';
  const rows=[MASTER_CSV_HEADERS];
  const dump=(k)=>{ const m=CHECKLIST_MASTERS[k];
    getMasterItems(k).forEach(it=> rows.push([m.label, it.title, IMPORTANCE_LABELS[it.importance]||'', it.desc||'']));
  };
  if(key){ dump(key); } else { MASTER_KEYS.forEach(dump); }
  const csv=bom+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const u=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=u; a.download=key?`チェックリスト_${CHECKLIST_MASTERS[key].label}_雛形.csv`:'チェックリスト_全種別_雛形.csv';
  a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);
  toast('⬇ CSV雛形をダウンロードしました');
}

function importChecklistMasterCsv(event){
  const file=event.target.files[0]; if(!file) return;
  const modeEl=document.querySelector('input[name="master-import-mode"]:checked');
  const mode=modeEl?modeEl.value:'overwrite';
  const resultEl=document.getElementById('master-import-result');
  const show=(html)=>{ if(resultEl) resultEl.innerHTML=html; };

  const reader=new FileReader();
  reader.onload=e=>{
    try{
      let text=e.target.result;
      if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
      // 改行やカンマを含むセルにも対応した解析（セル内の空行は除外しない。
      // 完全に空の行＝全フィールドが空文字の行のみ除外する）
      const dataRows = parseCsvRows(text).filter(r => r.fields.some(f => f.trim() !== ''));
      if(dataRows.length<2){ show(`<span style="color:var(--red)">⚠ データ行がありません。雛形をご確認ください</span>`); event.target.value=''; return; }

      const header=dataRows[0].fields.map(h=>h.trim().toLowerCase());
      const colIdx={};
      for(const k of MASTER_CSV_HEADERS){ colIdx[k]=header.findIndex(h=>MASTER_HEADER_ALIASES[k].some(a=>a.toLowerCase()===h)); }
      if(colIdx.type<0 || colIdx.task_name<0){
        show(`<span style="color:var(--red)">⚠ ヘッダーに必須列が見つかりません（type / task_name）。雛形をご利用ください</span>`);
        event.target.value=''; return;
      }

      const errors=[];
      // 7種類全てを自動で用意する（以前は4種類分しか無く、産休・育休・パパ育休のデータを
      // 含むCSVを読み込むと「Cannot read properties of undefined (reading 'push')」で失敗していた）
      const parsed={};
      MASTER_KEYS.forEach(k=>{ parsed[k]=[]; });
      for(let r=1;r<dataRows.length;r++){
        const {fields:row,no}=dataRows[r];
        const key=normalizeMasterType(row[colIdx.type]);
        const name=(row[colIdx.task_name]||'').trim();
        if(!key){ errors.push(`${no}行目のデータが不正です（種別エラー）：type「${escHtml((row[colIdx.type]||'').trim())||'（空欄）'}」は無効です。新卒 / 中途 / 産休 / 育休 / パパ育休 / 休職 / 退職 のいずれかを入力してください`); continue; }
        if(!name){ errors.push(`${no}行目のデータが不正です（タスク名エラー）：task_name が空欄です`); continue; }
        parsed[key].push({
          title:name,
          importance:normalizeImportance(colIdx.importance>=0?row[colIdx.importance]:''),
          desc:(colIdx.description>=0?row[colIdx.description]:'')||'',
          due:'',
        });
      }

      if(errors.length){
        show(`<div style="color:var(--red);background:var(--red-light);border:1px solid #fecaca;border-radius:8px;padding:8px 10px">
          <div style="font-weight:700;margin-bottom:4px">⚠ 取込を中止しました（${errors.length}件のエラー）</div>
          ${errors.map(er=>`<div>・${escHtml(er)}</div>`).join('')}
        </div>`);
        event.target.value=''; return;
      }
      if(MASTER_KEYS.every(k=>!parsed[k].length)){
        show(`<span style="color:var(--red)">⚠ 有効なデータがありませんでした</span>`); event.target.value=''; return;
      }

      const applied=[];
      MASTER_KEYS.forEach(k=>{
        const inc=parsed[k]; if(!inc.length) return;
        if(mode==='append'){
          const ex=getMasterItems(k);
          const merged=ex.concat(inc); // 重複チェックなしで末尾に追加
          saveMasterItems(k, merged);
          applied.push(`${CHECKLIST_MASTERS[k].label}：+${inc.length}件（計${merged.length}件）`);
        } else {
          saveMasterItems(k, inc);
          applied.push(`${CHECKLIST_MASTERS[k].label}：${inc.length}件で全置換`);
        }
      });

      renderMasterManager();
      if(typeof renderOnboarding==='function') renderOnboarding();
      if(typeof renderLeaveChecklist==='function') renderLeaveChecklist();
      show(`<span style="color:var(--green);background:var(--green-light);border:1px solid #a7f3d0;border-radius:8px;padding:8px 10px;display:inline-block">
        ✅ 取込完了（${mode==='append'?'都度追加':'全置換'}）— ${applied.join(' / ')}
      </span>`);
      event.target.value='';
    }catch(err){
      show(`<span style="color:var(--red)">⚠ CSVの読み込みに失敗しました：${escHtml(err.message)}</span>`);
      event.target.value='';
    }
  };
  reader.readAsText(file,'UTF-8');
}

function openMasterManager(){
  modalShow('master-mgr-modal');
  setMasterTab('shinsotsu');
}

function closeMasterManager(){ modalHide('master-mgr-modal'); }

function setMasterTab(key){
  masterMgrActiveKey = key;
  masterDraft = getMasterItems(key).map(it=>({title:it.title, importance:it.importance||'', desc:it.desc||''}));
  renderMasterManager();
}

function syncMasterDraftFromDOM(){
  masterDraft.forEach((it,i)=>{
    const t=document.getElementById('md-title-'+i);
    const im=document.getElementById('md-imp-'+i);
    const d=document.getElementById('md-desc-'+i);
    if(t) it.title=t.value;
    if(im) it.importance=im.value;
    if(d) it.desc=d.value;
  });
}

function masterDraftUpdate(i, field, value){ if(masterDraft[i]) masterDraft[i][field]=value; }

function masterDraftAdd(){ syncMasterDraftFromDOM(); masterDraft.push({title:'',importance:'',desc:''}); renderMasterManager(); }

function masterDraftDelete(i){ syncMasterDraftFromDOM(); masterDraft.splice(i,1); renderMasterManager(); }

function saveMasterDraft(){
  syncMasterDraftFromDOM();
  const cleaned = masterDraft
    .map(it=>({title:(it.title||'').trim(), importance:it.importance||'', desc:(it.desc||'').trim(), due:''}))
    .filter(it=>it.title!=='');
  saveMasterItems(masterMgrActiveKey, cleaned);
  masterDraft = cleaned.map(it=>({title:it.title, importance:it.importance, desc:it.desc}));
  renderMasterManager();
  if(typeof renderOnboarding==='function') renderOnboarding();
  if(typeof renderLeaveChecklist==='function') renderLeaveChecklist();
  toast(`💾 ${CHECKLIST_MASTERS[masterMgrActiveKey].label}用マスタを保存しました（${cleaned.length}項目）`);
}

function renderMasterManager(){
  // タブ
  const tabsEl=document.getElementById('master-mgr-tabs');
  if(tabsEl){
    tabsEl.innerHTML = MASTER_KEYS.map(k=>{
      const m=CHECKLIST_MASTERS[k]; const active=k===masterMgrActiveKey;
      return `<button onclick="setMasterTab('${k}')" style="display:flex;align-items:center;gap:5px;padding:7px 12px;border:none;border-bottom:2px solid ${active?m.color:'transparent'};background:${active?m.light:'transparent'};color:${active?m.color:'var(--text2)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:var(--font);border-radius:6px 6px 0 0">${m.icon} ${m.label}</button>`;
    }).join('');
  }
  // 編集エリア
  const editEl=document.getElementById('master-mgr-editor');
  if(!editEl) return;
  const m=CHECKLIST_MASTERS[masterMgrActiveKey];
  const rows = masterDraft.map((it,i)=>`
    <div style="display:flex;align-items:flex-start;gap:6px;padding:6px 0;border-bottom:1px solid var(--surface2)">
      <select id="md-imp-${i}" onchange="masterDraftUpdate(${i},'importance',this.value)"
        style="flex-shrink:0;width:64px;padding:5px 4px;border:1px solid var(--border);border-radius:6px;font-size:11px;font-family:var(--font);background:#fff">
        <option value="" ${it.importance===''?'selected':''}>—</option>
        <option value="must" ${it.importance==='must'?'selected':''}>必須</option>
        <option value="recommend" ${it.importance==='recommend'?'selected':''}>推奨</option>
      </select>
      <div style="flex:1;display:flex;flex-direction:column;gap:4px">
        <input id="md-title-${i}" value="${escHtml(it.title)}" placeholder="タスク名"
          onchange="masterDraftUpdate(${i},'title',this.value)"
          style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--font)">
        <input id="md-desc-${i}" value="${escHtml(it.desc)}" placeholder="補足説明・URL（任意）"
          onchange="masterDraftUpdate(${i},'desc',this.value)"
          style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:11px;font-family:var(--font);color:var(--text2)">
      </div>
      <button onclick="masterDraftDelete(${i})" style="flex-shrink:0;font-size:11px;padding:5px 8px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:var(--red);cursor:pointer">🗑</button>
    </div>`).join('');

  editEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:13px;font-weight:700;color:${m.color}">${m.icon} ${m.label}用マスタ（${masterDraft.length}項目）</span>
      <div style="display:flex;gap:6px">
        <button onclick="downloadMasterCsvTemplate('${masterMgrActiveKey}')" class="btn btn-ghost" style="font-size:11px;padding:5px 9px">⬇ この種別の雛形CSV</button>
        <button onclick="saveMasterDraft()" class="btn btn-primary" style="font-size:11px;padding:5px 12px">💾 保存</button>
      </div>
    </div>
    <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px 10px;background:#fff">
      ${masterDraft.length===0?`<div style="font-size:11px;color:var(--text3);padding:8px 0">項目がありません。「＋ 項目を追加」から登録してください</div>`:rows}
    </div>
    <button onclick="masterDraftAdd()" class="btn btn-ghost" style="font-size:11px;padding:6px 10px;margin-top:8px">＋ 項目を追加</button>
    <div style="font-size:10px;color:var(--text3);margin-top:6px">※「保存」を押すまで変更は確定されません。タブを切り替えると未保存の編集は破棄されます。</div>
  `;
}
