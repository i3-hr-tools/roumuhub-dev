// ══ 汎用UI部品（トースト通知・モーダル制御・ローディング表示等） ══

function clock(){
  const tick=()=>{const n=new Date();document.getElementById('clock').textContent=n.toLocaleDateString('ja-JP',{month:'short',day:'numeric',weekday:'short'})+' '+n.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})};
  tick();setInterval(tick,1000);
}

function closeModal(id){document.getElementById(id).classList.remove('open')}

function closeBg(e,id){if(e.target===document.getElementById(id))closeModal(id)}

function toast(msg,err=false){
  // err=true（後方互換）→ エラー扱い。第2引数に 'success'|'error' も可
  const type = (err===true||err==='error') ? 'error' : (err==='success'?'success':'success');
  const c=document.getElementById('toasts'),d=document.createElement('div');
  d.className='toast '+type;
  const ic = type==='error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check';
  d.innerHTML=`<span class="toast-ic"><i class="${ic}"></i></span><span>${msg}</span>`;
  c.appendChild(d);
  const dur = type==='error' ? 4200 : 2600;
  setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity .3s';setTimeout(()=>d.remove(),300)},dur);
}

function alertBanner(msg, level='error'){
  const c=document.getElementById('alerts'); if(!c) return;
  const d=document.createElement('div');
  d.className='alert-toast'+(level==='warn'?' warn':'');
  const ic = level==='warn' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-exclamation';
  d.innerHTML=`<i class="${ic}"></i><span>${msg}</span><button class="alert-close" aria-label="閉じる">✕</button>`;
  d.querySelector('.alert-close').onclick=()=>d.remove();
  c.appendChild(d);
}

function modalShow(id){
  const el=document.getElementById(id); if(!el) return;
  el.classList.add('open'); el.style.display='flex';
  document.body.classList.add('modal-open');
}

function modalHide(id){
  const el=document.getElementById(id); if(!el) return;
  el.classList.remove('open');
  if(!document.querySelector('.modal-overlay.open')) document.body.classList.remove('modal-open');
}

function syncBodyScrollLock(){
  const anyOpen = !!document.querySelector('.modal-overlay.open');
  document.body.classList.toggle('modal-open', anyOpen);
}

function showLoading(text='保存中…'){
  _loadingCount++;
  const el=document.getElementById('global-loading');
  const t=document.getElementById('global-loading-text');
  if(t) t.textContent=text;
  if(el) el.classList.add('on');
}

function hideLoading(){
  _loadingCount=Math.max(0,_loadingCount-1);
  if(_loadingCount===0){ const el=document.getElementById('global-loading'); if(el) el.classList.remove('on'); }
}

function toggleSidebar(force){
  const sb=document.querySelector('.sidebar');
  const bd=document.getElementById('sidebar-backdrop');
  if(!sb) return;
  const open = (force===undefined) ? !sb.classList.contains('open') : !!force;
  sb.classList.toggle('open', open);
  if(bd) bd.classList.toggle('open', open);
}

function setupModalUX(){
  // 背景（オーバーレイ自身）クリックで閉じる
  document.addEventListener('click', e=>{
    const t=e.target;
    if(t && t.classList && t.classList.contains('modal-overlay') && t.classList.contains('open')){
      t.classList.remove('open');
      syncBodyScrollLock();
    }
  });
  // Escで最前面のモーダルを閉じる
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      const open=[...document.querySelectorAll('.modal-overlay.open')];
      if(open.length){ open[open.length-1].classList.remove('open'); syncBodyScrollLock(); e.stopPropagation(); }
    }
  }, true);
  // open クラスの増減を監視してスクロールロックを常に正しく保つ
  const mo=new MutationObserver(syncBodyScrollLock);
  document.querySelectorAll('.modal-overlay').forEach(m=>mo.observe(m,{attributes:true,attributeFilter:['class']}));
  syncBodyScrollLock();
}
