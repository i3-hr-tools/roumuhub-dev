// ══ 共通ユーティリティ関数 ══

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(d){return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}


function toJstTime(isoStr){
  if(!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('ja-JP', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
  } catch(e) { return isoStr; }
}

function isHolidayOrWeekend(date) {
  var day = date.getDay();
  if (day === 0 || day === 6) return true;
  var calHoliday = CalendarApp.getCalendarById('ja.japanese#holiday@group.v.calendar.google.com');
  if (calHoliday) {
    var events = calHoliday.getEventsForDay(date);
    if (events.length > 0) return true;
  }
  return false;
}

function getNthBusinessDayOfMonth(n, year, month){
  // year・monthが省略された場合は当月
  const now = new Date();
  const y = year !== undefined ? year : now.getFullYear();
  const m = month !== undefined ? month : now.getMonth(); // 0-indexed
  let d = new Date(y, m, 1); // 月初
  d.setHours(0,0,0,0);
  let count = 0;
  while(true){
    if(isBusinessDay(d)){
      count++;
      if(count === n) return new Date(d);
    }
    d.setDate(d.getDate()+1);
    // 月を超えたら翌月で続ける（月末超過の場合）
    if(d.getMonth() !== m && count < n){
      // 翌月にはみ出た場合は翌月の残り日数で処理
    }
    if(d.getFullYear() > y + 1) break; // 無限ループ防止
  }
  return d;
}

function makeIcs(list){
  const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//労務管理チームツール//JP','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  list.forEach(t=>{
    if(t.status==='done'||!t.due)return;
    const ds=t.due.replace(/-/g,''),d=new Date(t.due);d.setDate(d.getDate()+1);
    const de=fmt(d).replace(/-/g,'');
    const now=new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
    const cat=CAT_LABELS[t.cat]||'労務';
    const member=MEMBERS.find(m=>m.id===t.assignee);
    const desc=(t.note||'')+(member?`\n担当: ${member.name}`:'')+(t.link?`\nリンク: ${t.link}`:'');
    rows.push('BEGIN:VEVENT',`UID:roumu-team-${t.id}@task`,`DTSTAMP:${now}`,`DTSTART;VALUE=DATE:${ds}`,`DTEND;VALUE=DATE:${de}`,`SUMMARY:【${cat}】${t.title}`);
    if(desc)rows.push(`DESCRIPTION:${desc.replace(/\n/g,'\\n')}`);
    if(t.remind)rows.push('BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${t.title}`,`TRIGGER:-P${t.remind}D`,'END:VALARM');
    rows.push('END:VEVENT');
  });
  rows.push('END:VCALENDAR');
  return rows.join('\r\n');
}

// CSV全体を、引用符（"）で囲まれたセル内の改行やカンマも正しく扱いながら
// 「論理的な行」単位に分割する共通関数。各種CSV取込機能（マスタ管理・年間プロジェクト・
// 休職記録・テンプレート等）から共通で呼び出す。
// 以前は単純に改行で区切っていたため、セルの中に改行を含む長い説明文があると、
// そこで行がズレて以降の列が全てバラバラになってしまう不具合があった。
function parseCsvRows(text){
  const rows = [];
  let field = '', row = [], inQ = false;
  let lineNo = 1, startLineNo = 1;
  for(let i=0; i<text.length; i++){
    const c = text[i];
    if(inQ){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; }
        else inQ = false;
      } else if(c === '\n'){ lineNo++; field += '\n'; }
      else if(c === '\r'){ /* 無視 */ }
      else field += c;
    } else {
      if(c === '"'){ inQ = true; }
      else if(c === ','){ row.push(field.trim()); field = ''; }
      else if(c === '\r'){ /* 無視 */ }
      else if(c === '\n'){
        row.push(field.trim()); field = '';
        rows.push({ fields: row, no: startLineNo });
        row = []; lineNo++; startLineNo = lineNo;
      } else field += c;
    }
  }
  if(field !== '' || row.length > 0){
    row.push(field.trim());
    rows.push({ fields: row, no: startLineNo });
  }
  return rows;
}

function dlIcs(c,n){const b=new Blob([c],{type:'text/calendar;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function exportAllIcs(){const p=tasks.filter(t=>t.status!=='done'&&t.due);if(!p.length){toast('⚠ 対象タスクなし',true);return;}dlIcs(makeIcs(p),'roumu-team-all.ics');toast(`📅 ${p.length}件を書き出しました`);}

// ══ タスク共通検索・保存ヘルパー（チーム / プライベート両対応） ══
// 【重要な規約】タスクIDから本体を探したり保存したりする処理は、
// 必ずこの findTaskById() / saveTaskRef() を使うこと。
// tasks.find(...) や saveTasks() を直接書くと、プライベート（個人）タスクの
// 場合に見つからない・保存されない、という同種のバグを何度も繰り返してきたため、
// 窓口をこの2関数に統一する。
//
// 使い方:
//   const { task, isPriv, privArr } = findTaskById(id);
//   if (!task) return;
//   task.status = 'done';
//   saveTaskRef(isPriv, privArr);
function findTaskById(id){
  let task = tasks.find(t=>String(t.id)===String(id));
  let isPriv = false;
  let privArr = [];
  if(!task){
    privArr = getPrivateTasks();
    task = privArr.find(t=>String(t.id)===String(id));
    isPriv = true;
  }
  return { task, isPriv, privArr };
}
function saveTaskRef(isPriv, privArr){
  if(isPriv){ savePrivateTasks(privArr); } else { saveTasks(); }
}
