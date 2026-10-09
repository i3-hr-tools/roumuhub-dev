// ══ 共通ユーティリティ関数 ══

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

function dlIcs(c,n){const b=new Blob([c],{type:'text/calendar;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function exportAllIcs(){const p=tasks.filter(t=>t.status!=='done'&&t.due);if(!p.length){toast('⚠ 対象タスクなし',true);return;}dlIcs(makeIcs(p),'roumu-team-all.ics');toast(`📅 ${p.length}件を書き出しました`);}
