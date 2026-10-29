// ══ GAS通信・同期処理 ══

function getGasUrl(){
  const stored = localStorage.getItem('gas_url');
  return (stored && stored !== 'YOUR_GAS_WEB_APP_URL_HERE') ? stored : GAS_URL;
}

function isGasEnabled(){
  return getGasUrl() !== 'YOUR_GAS_WEB_APP_URL_HERE';
}

// testGasConnection は admin.js 側に定義を一本化（元々sync.jsとadmin.jsで内容が
// 完全重複していたため、sync.jsからは削除。呼び出し元のHTML(gas-test-btn)は
// スクリプト読み込み順でadmin.js側の定義が使われる）

function saveGasUrl(){
  const url = document.getElementById('gas-url-input').value.trim();
  if(!url){
    // URLが空なら削除（リセット）
    localStorage.removeItem('gas_url');
    toast('🔌 GAS URLをリセットしました');
  } else {
    localStorage.setItem('gas_url', url);
    toast('✅ GAS URLを保存しました。同期が有効になりました。');
  }
  closeModal('gas-modal-overlay');
  // ヘッダーの接続状態インジケーターを更新
  updateGasIndicator();
  updateGasMissingBanner();
}

function updateGasIndicator(){
  const btn = document.getElementById('gas-settings-btn');
  if(!btn) return;
  if(isGasEnabled()){
    btn.style.borderColor = 'var(--green)';
    btn.style.color = 'var(--green)';
    btn.textContent = '⚙ GAS ✓';
  } else {
    btn.style.borderColor = '';
    btn.style.color = '';
    btn.textContent = '⚙ GAS設定';
  }
}

function updateGasStatusBadge(){
  const badge = document.getElementById('gas-status-badge');
  if(!badge) return;
  if(isGasEnabled()){
    badge.textContent = '✓ 連携済み';
    badge.style.cssText = 'font-size:10px;font-family:var(--mono);padding:2px 8px;border-radius:10px;font-weight:700;background:var(--green-light);color:var(--green)';
  } else {
    badge.textContent = '未設定';
    badge.style.cssText = 'font-size:10px;font-family:var(--mono);padding:2px 8px;border-radius:10px;font-weight:700;background:var(--yellow-light);color:var(--yellow)';
  }
}

function scheduleAutoSync() {
  if (!isGasEnabled()) return;
  if (_isSyncing) return;
  // トークンが未取得の場合はスキップ（ログイン直後の誤同期防止）
  if (!gAccessToken) return;
  clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(async () => {
    if (_isSyncing) return;
    if (!gAccessToken) return; // タイマー実行時も再チェック
    // 直近2.5秒以内に別の同期が完了していれば重複送信を回避
    if (Date.now() - _lastUploadTs < 2500) return;
    _autoSyncTimer = null; // タイマークリア
    await _doUpload();
  }, 3000);
}

async function immediateSync() {
  if (!isGasEnabled()) return;
  if (_isSyncing) return; // 既に同期中なら重複防止
  clearTimeout(_autoSyncTimer); // デバウンス中のものをキャンセル
  _autoSyncTimer = null;
  await _doUpload();
}

async function _doUpload() {
  // ロックの判定と取得を同期的に（awaitを挟まず）まとめて行う。
  // 以前はこの直後にトークン更新の await があり、その待機中に別の _doUpload() 呼び出しが
  // 同じく「ロックされていない」と判定してしまい、二重に保存処理が走る競合状態があった。
  if (_isSyncing) return;
  _isSyncing = true;
  try {
    // トークン期限チェック → 期限切れなら自動更新（ロック取得後に行う）
    if (isGasEnabled() && isTokenExpired()) {
      try { await refreshTokenSilently(); } catch(e) { console.error('refreshTokenSilently failed:', e); }
    }
    setSyncStatus('💾 保存中...');
    await syncData(true, true);
    _lastUploadTs = Date.now();
    setSyncStatus('💾 ' + new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}) + ' 自動保存済');
    // 保存できたタイミングで、自分担当分のGoogle ToDoも最新化
    syncMyGoogleTasks();
  } catch(e) {
    console.error('_doUpload failed:', e);
    setSyncStatus('⚠ 保存失敗');
  } finally {
    _isSyncing = false;
  }
}

function startAutoPoll() {
  if (_autoPollTimer) return; // 二重起動防止
  _autoPollTimer = setInterval(async () => {
    if (!isGasEnabled() || _isSyncing) return;
    // BUG-01: モーダルが開いている場合は自動取得をスキップ（入力中のデータ保護）
    // タスク編集モーダル・コメント入力・その他全モーダルをチェック
    if (document.querySelector('.modal-overlay.open')) return;
    // トピック編集画面は .modal-overlay を使っていない独自の開閉のため、個別にガードする
    if (document.getElementById('topic-editor')?.style.display === 'block') return;
    // コメント入力エリアにフォーカスがある場合もスキップ
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.id === 'cm-input' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) return;
    try {
      const gasUrl = getGasUrl();
      const qs = 'action=load'
        + (gAccessToken ? '&token=' + encodeURIComponent(gAccessToken) : '');
      const res = await fetch(gasUrl + '?' + qs, { redirect: 'follow' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.error) return;
      // serverTsが変わっていれば反映（変わっていなければスキップ）
      const stored = localStorage.getItem('roumu_server_ts') || '';
      if (data.serverTs && data.serverTs === stored) return;
      if (data.serverTs) { _serverTs = data.serverTs; localStorage.setItem('roumu_server_ts', _serverTs); }
      applyLoadedData(data);
      renderAll();
      setSyncStatus('↓ ' + new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}) + ' 自動取得済');
    } catch(e) { console.warn('startAutoPoll failed (一時的なネットワークエラーの可能性):', e); }
  }, 30000); // 30秒ごと
}

async function syncData(silent=false, uploadOnly=false){
  if(!isGasEnabled()){
    if(!silent) toast('⚠ GAS URLが未設定です。「管理 → 設定」から設定してください。',true);
    return;
  }
  // 手動同期中は自動保存をブロック
  _isSyncing = true;
  const btn=document.getElementById('sync-btn');
  if(btn){btn.classList.add('syncing');btn.innerHTML='<span class="spin"></span> 同期中...';btn.disabled=true;}
  setSyncStatus('同期中...');
  showLoading(uploadOnly ? '保存・同期中…' : '同期中…');
  try{
    const gasUrl = getGasUrl();

    async function gasPost(params){
      // URLSearchParams形式（application/x-www-form-urlencoded）でGASに送信
      const sp = new URLSearchParams();
      // SEC-01: OAuthトークンをGASに送信してサーバー側で検証
      if (gAccessToken) sp.append('token', gAccessToken);
      Object.entries(params).forEach(([k,v])=>
        sp.append(k, typeof v==='string' ? v : JSON.stringify(v))
      );
      const res = await fetch(gasUrl, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:sp.toString(),
        redirect:'follow'
      });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      try{ return JSON.parse(text); }
      catch(e){ throw new Error('GASレスポンス解析失敗: '+text.slice(0,100)); }
    }

    async function gasGet(params){
      // SEC-01: tokenをクエリパラメータに追加
      const allParams = { ...params };
      if (gAccessToken) allParams.token = gAccessToken;
      const qs = Object.entries(allParams).map(([k,v])=>
        encodeURIComponent(k)+'='+encodeURIComponent(typeof v==='string'?v:JSON.stringify(v))
      ).join('&');
      const res = await fetch(`${gasUrl}?${qs}`, { redirect:'follow' });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      try{ return JSON.parse(text); }
      catch(e){ throw new Error('GASレスポンス解析失敗: '+text.slice(0,100)); }
    }

    // 1) アップロード（serverTs で楽観的ロック）
    const saveData = await gasPost({
      action:            'saveAll',
      serverTs:          _serverTs,
      updatedBy:         currentUser ? currentUser.name : 'unknown',
      tasks:             JSON.stringify(tasks),
      members:           JSON.stringify(MEMBERS),
      meta:              JSON.stringify(buildMeta()),
      leaveRecords:      JSON.stringify(leaveRecords),
      leaveChecklists:   JSON.stringify(leaveChecklistPersons),
      onboardingPersons: JSON.stringify(onboardingPersons),
      topicItems:        JSON.stringify(getAllTopicItems()),
      // 個人タスクはlocalStorageのみ管理（GAS同期なし）
    });

    // 競合チェック
    if(saveData && saveData.error === 'conflict'){
      const conflictBy = saveData.updatedBy ? `（最終更新者: ${saveData.updatedBy}）` : '';
      const reload = confirm(
        `⚠ 同期の競合が発生しました${conflictBy}\n\n別のメンバーがあなたより先に保存を行いました。\n\n【OK】→ サーバーの最新データで画面を更新します\n　　　（あなたの未保存の変更は上書きされます）\n【キャンセル】→ 今回の同期をスキップします\n　　　（あなたの変更内容は画面上に残ります）`
      );
      if(reload){
        const freshData = await gasGet({ action: 'load' });
        if(freshData.serverTs){ _serverTs=freshData.serverTs; localStorage.setItem('roumu_server_ts',_serverTs); }
        applyLoadedData(freshData);
        renderAll();
        setSyncStatus('競合解消 — サーバーデータで上書き');
        alertBanner('競合を解消しました。サーバーの最新データで画面を更新しました。','warn');
      } else {
        // キャンセル時もserverTsをサーバー値に合わせてリセット（無限ループ防止）
        _serverTs = saveData.serverTs;
        localStorage.setItem('roumu_server_ts', _serverTs);
        setSyncStatus('同期スキップ（競合）');
        alertBanner('同期をスキップしました（競合）。再度「同期」を押すと再試行できます。','warn');
      }
      return;
    }

    if(saveData && saveData.error) throw new Error('GASエラー(save): ' + saveData.error);
    if(saveData && saveData.serverTs){ _serverTs=saveData.serverTs; localStorage.setItem('roumu_server_ts',_serverTs); }

    // uploadOnlyモード（削除・ステータス変更等）はloadをスキップして画面を維持
    if(uploadOnly){
      const now=new Date();
      setSyncStatus(`最終同期 ${pad(now.getHours())}:${pad(now.getMinutes())}`);
      return;
    }

    // 2) ダウンロード
    const data = await gasGet({ action: 'load' });
    if(data.error) throw new Error('GASエラー: ' + data.error);
    if(data.serverTs){ _serverTs=data.serverTs; localStorage.setItem('roumu_server_ts',_serverTs); }

    applyLoadedData(data);
    renderAll();
    const now=new Date();
    setSyncStatus(`最終同期 ${pad(now.getHours())}:${pad(now.getMinutes())}`);
    toast('✅ 同期完了 — タスク・メンバー・設定をチームメンバー全員で共有しました');
    syncMyGoogleTasks();
  }catch(e){
    setSyncStatus('同期失敗');
    const msg = e?.message || String(e) || '不明なエラー';
    console.error('syncData error:', msg, e);
    if(msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')){
      alertBanner('同期失敗：ネットワークエラー。GASのデプロイ設定「アクセス：全員」をご確認ください');
    } else if(msg.includes('HTTP 4') || msg.includes('HTTP 5')){
      alertBanner(`同期失敗：GASサーバーエラー（${msg}）。GASを再デプロイしてください`);
    } else if(msg.includes('GASエラー')){
      alertBanner(`同期失敗：${msg}`);
    } else {
      alertBanner(`同期失敗：${msg.slice(0,80)}`);
    }
  }finally{
    hideLoading();
    _isSyncing = false;
    if(btn){btn.classList.remove('syncing');btn.innerHTML='🔄 同期';btn.disabled=false;}
  }
}

function applyLoadedData(data){
  if(data.tasks){
    // IDを文字列に統一してから保存
    tasks = data.tasks.map(t => ({ ...t, id: String(t.id) }));
    _saveTasksLocal();
  }
  // 個人タスクはlocalStorageのみ管理（GAS同期なし）
  if(data.members && data.members.length){
    MEMBERS = data.members.map(m => ({ ...m, id: String(m.id) }));
    _saveMembersLocal();
    // BUG-05: MEMBERSが更新されたらcurrentUserを再取得（null参照防止）
    if(currentUser){
      currentUser = MEMBERS.find(m => m.id === currentUser.id) || currentUser;
    }
    renderMemberList(); populateAssigneeSelects();
  }
  if(data.meta){ applyMeta(data.meta); }
  if(data.leaveRecords){ leaveRecords=data.leaveRecords; saveLeaveRecords(); if(majorCat==='sankyuiku') renderLeaveGantt(); }
  if(data.leaveChecklists){ leaveChecklistPersons=data.leaveChecklists; saveLeaveChecklistPersons(); if(majorCat==='sankyuiku') renderLeaveChecklist(); }
  if(data.onboardingPersons){ onboardingPersons=data.onboardingPersons; saveOnboardingPersons(); if(majorCat==='nyutai') renderOnboarding(); }
  if(data.topicItems && data.topicItems.length){ applyAllTopicItems(data.topicItems); }
}

function setSyncStatus(msg){
  const el=document.getElementById('sync-status');
  if(el)el.textContent=msg;
}
