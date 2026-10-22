// ══ Google認証・ログイン処理 ══

// 認証状態変数
let gTokenClient = null;
let gAccessToken = null;
let _tokenExpireAt = 0;

function isTokenExpired() {
  return !gAccessToken || Date.now() > _tokenExpireAt - 5 * 60 * 1000;
}

async function refreshTokenSilently() {
  if (!gTokenClient) return;
  return new Promise((resolve) => {
    const prevCallback = gTokenClient.callback;
    gTokenClient.callback = (tokenResponse) => {
      if (!tokenResponse.error) {
        gAccessToken = tokenResponse.access_token;
        _tokenExpireAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
      }
      gTokenClient.callback = prevCallback;
      resolve();
    };
    gTokenClient.requestAccessToken({ prompt: '' }); // promptなし＝サイレント更新
  });
}

function initGoogleAuth() {
  if (typeof google === 'undefined') {
    setTimeout(initGoogleAuth, 500);
    return;
  }
  gTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: LOGIN_SCOPES,
    // i3-systems.com のアカウントに限定（ヒントであり強制力はないため、
    // 実際のアクセス制御は引き続きAPP_ALLOWED_EMAILS・GAS側のcheckAccessで行う）
    hd: 'i3-systems.com',
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        toast('⚠ Googleログインに失敗しました', true);
        return;
      }
      gAccessToken = tokenResponse.access_token;
    },
  });
}

function handleGoogleLoginForApp() {
  // GISが未初期化なら初期化してから実行
  if (!gTokenClient) {
    initGoogleAuth();
    setTimeout(() => handleGoogleLoginForApp(), 800);
    return;
  }
  // コールバックをアプリログイン用に一時的に上書き
  gTokenClient.callback = async (tokenResponse) => {
    if (tokenResponse.error) {
      document.getElementById('login-step-loading').style.display = 'none';
      document.getElementById('login-step-google').style.display = 'block';
      showLoginError('Googleログインに失敗しました。もう一度お試しください。');
      return;
    }
    gAccessToken = tokenResponse.access_token;
    _tokenExpireAt = Date.now() + ((tokenResponse.expires_in || 3600) * 1000);
    await completeAppLogin();
  };
  document.getElementById('login-step-google').style.display = 'none';
  document.getElementById('login-step-loading').style.display = 'block';
  gTokenClient.requestAccessToken({ prompt: 'select_account' });
}

async function completeAppLogin() {
  try {
    // Googleユーザー情報を取得
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${gAccessToken}` }
    });
    const info = await res.json();
    const email = info.email || '';

    // アクセス制御チェック
    if (!APP_ALLOWED_EMAILS.includes(email)) {
      gAccessToken = null;
      document.getElementById('login-step-loading').style.display = 'none';
      document.getElementById('login-step-google').style.display = 'block';
      showLoginError(`このアカウント（${email}）はアクセスが許可されていません。`);
      return;
    }

    // メールアドレスからメンバーを自動判定
    let member = MEMBERS.find(m => m.email === email);

    // メンバーが見つからない場合は名前で照合、それでもなければ自動作成
    if (!member) {
      const name = info.name || email.split('@')[0];
      member = MEMBERS.find(m => m.name === name);
      if (!member) {
        // 新規メンバーとして追加
        const initial = (info.name || email)[0].toUpperCase();
        const colors = ['#2d7a4f','#2563a8','#6d3faa','#c05621','#0e7490'];
        const color = colors[MEMBERS.length % colors.length];
        member = { id: 'm' + Date.now(), name: info.name || email.split('@')[0], initial, color, email, calendarId: 'primary', pin: '' };
        MEMBERS.push(member);
        saveMembers();
      } else {
        // メールアドレスを更新
        member.email = email;
        saveMembers();
      }
    }

    // ヘッダーにGoogleアバター・名前を表示
    const avatarEl = document.getElementById('google-avatar');
    const initEl = document.getElementById('current-avatar');
    const nameEl = document.getElementById('current-name');
    if (nameEl) nameEl.textContent = info.name || email.split('@')[0];
    if (avatarEl && info.picture) {
      avatarEl.src = info.picture;
      avatarEl.style.display = 'block';
      if (initEl) initEl.style.display = 'none';
    } else {
      // アバター画像がない場合はイニシャルを表示
      if (avatarEl) avatarEl.style.display = 'none';
      if (initEl) {
        initEl.textContent = member.initial;
        initEl.style.background = member.color;
        initEl.style.display = 'flex';
      }
    }
    // ツールにログイン
    doLogin(member.id);

  } catch(e) {
    document.getElementById('login-step-loading').style.display = 'none';
    document.getElementById('login-step-google').style.display = 'block';
    showLoginError('ログイン処理中にエラーが発生しました。もう一度お試しください。');
  }
}

function doLogin(id){
  currentUser = MEMBERS.find(m=>m.id===id);
  document.getElementById('user-select-modal').classList.remove('open');
  // Googleアバターが設定済みの場合は名前・アバターをGoogleアカウントのものを使う
  const gAvatar = document.getElementById('google-avatar');
  const isGoogleLogin = gAvatar && gAvatar.src && gAvatar.style.display !== 'none';
  if (!isGoogleLogin) {
    document.getElementById('current-name').textContent = currentUser.name;
    const avatarEl = document.getElementById('current-avatar');
    if (avatarEl) {
      avatarEl.textContent = currentUser.initial;
      avatarEl.style.background = currentUser.color;
      avatarEl.style.display = 'flex';
    }
  }
  renderAll();
  checkAlerts();
  // ログイン時にGASから最新データを取得して反映
  if(isGasEnabled()){
    setSyncStatus('⏳ データ取得中...');
    fetch(getGasUrl()+'?action=load'+(gAccessToken?'&token='+encodeURIComponent(gAccessToken):''), {redirect:'follow'})
      .then(r=>r.json())
      .then(data=>{
        if(data && !data.error){
          if(data.serverTs){ _serverTs=data.serverTs; localStorage.setItem('roumu_server_ts',_serverTs); }
          applyLoadedData(data);
          renderAll();
          setSyncStatus('✅ ' + new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}) + ' 取得完了');
        }
      })
      .catch(()=>setSyncStatus('⚠ データ取得失敗'));
    fetchTodayGcal();
    startAutoPoll();
  }
}

