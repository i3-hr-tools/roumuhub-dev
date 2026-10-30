// ══ Google ToDo（Google Tasks）連携 ══
// カレンダー同期を廃止し、ログイン本人のアクセス権限で直接Google Tasks APIを呼び出す方式。
// GAS（常にデプロイ者の権限で動く）を経由しないため、各担当者本人のToDoリストに
// 正しく反映される。ただし「本人がログインしているときだけ、本人の分を同期する」
// 仕組みのため、同期は push型（保存した瞬間）ではなく pull型（ログイン時・定期ポーリング時）。

const GTASKS_API = 'https://tasks.googleapis.com/tasks/v1';
let _gtasksListId = null;      // 今ログイン中のユーザーの「i3 RomuHub」ToDoリストID
let _gtasksSyncing = false;    // 二重実行防止

function _gtasksStorageKey(suffix){
  const email = currentUser?.email || 'unknown';
  return `romu_gtasks_${suffix}_${email}`;
}

function _getGtasksMap(){
  try { return JSON.parse(localStorage.getItem(_gtasksStorageKey('map')) || '{}'); }
  catch(e){ return {}; }
}
function _saveGtasksMap(map){
  localStorage.setItem(_gtasksStorageKey('map'), JSON.stringify(map));
}

async function _gtasksFetch(path, options={}){
  if(!gAccessToken) throw new Error('no token');
  const res = await fetch(`${GTASKS_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${gAccessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers||{}),
    },
  });
  if(!res.ok){
    const text = await res.text().catch(()=> '');
    throw new Error(`Tasks API ${res.status}: ${text.slice(0,150)}`);
  }
  if(res.status === 204) return null;
  return res.json();
}

// 「i3 RomuHub」という名前の専用ToDoリストを探す。無ければ作成する
async function _ensureRomuTasklist(){
  if(_gtasksListId) return _gtasksListId;
  const cached = localStorage.getItem(_gtasksStorageKey('listid'));
  if(cached){
    // キャッシュされたIDが、今ログイン中のアカウントで本当に使えるか確認してから使う。
    // 以前、別の人のIDが残ってしまい「権限がない」エラーが大量発生したことがあるため、
    // 使えないと分かった時点でキャッシュを捨てて作り直す（自己修復）
    try {
      await _gtasksFetch(`/lists/${cached}`);
      _gtasksListId = cached;
      return cached;
    } catch(e){
      console.warn('キャッシュされたToDoリストIDが無効なため、作り直します:', e);
      localStorage.removeItem(_gtasksStorageKey('listid'));
      localStorage.removeItem(_gtasksStorageKey('map')); // 対応表も合わせてリセット
    }
  }

  const data = await _gtasksFetch('/users/@me/lists');
  const existing = (data?.items||[]).find(l => l.title === 'i3 RomuHub');
  if(existing){
    _gtasksListId = existing.id;
  } else {
    const created = await _gtasksFetch('/users/@me/lists', {
      method: 'POST',
      body: JSON.stringify({ title: 'i3 RomuHub' }),
    });
    _gtasksListId = created.id;
  }
  localStorage.setItem(_gtasksStorageKey('listid'), _gtasksListId);
  return _gtasksListId;
}

// ステータスをタイトルの先頭タグに変換（完了はGoogleタスク自体のチェックで表現するため付けない）
function _gtasksTitleFor(item){
  if(item.status === 'done') return item.title;
  const label = STATUS_LABELS[item.status] || '';
  return label ? `【${label}】${item.title}` : item.title;
}

function _gtasksDueRfc3339(due){
  if(!due) return undefined;
  const dateStr = due.split('T')[0];
  return `${dateStr}T00:00:00.000Z`;
}

// 1件を作成または更新する。parentGoogleId があれば子タスクとして追加する
async function _upsertOneGoogleTask(key, item, map, parentGoogleId){
  const listId = await _ensureRomuTasklist();
  const body = {
    title: _gtasksTitleFor(item),
    notes: item.note || '',
    status: item.status === 'done' ? 'completed' : 'needsAction',
  };
  const due = _gtasksDueRfc3339(item.due);
  if(due) body.due = due;

  const existingId = map[key];
  if(existingId){
    try {
      await _gtasksFetch(`/lists/${listId}/tasks/${existingId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return existingId;
    } catch(e){
      // 404（先方で本当に削除済み）の場合のみ「存在しない」とみなして新規作成し直す。
      // それ以外（通信エラー・一時的な障害等）まで同じ扱いにすると、一時的な不調のたびに
      // 重複タスクが作られてしまうため、原因を区別する。
      if(String(e.message).includes('404')){
        delete map[key];
      } else {
        throw e; // 今回はこのタスクの処理をスキップし、次回の同期に委ねる
      }
    }
  }
  const qs = new URLSearchParams();
  if(parentGoogleId) qs.append('parent', parentGoogleId);
  const created = await _gtasksFetch(`/lists/${listId}/tasks${qs.toString()?'?'+qs:''}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  map[key] = created.id;
  return created.id;
}

async function _deleteOneGoogleTask(key, map){
  const existingId = map[key];
  if(!existingId) return;
  try {
    const listId = await _ensureRomuTasklist();
    await _gtasksFetch(`/lists/${listId}/tasks/${existingId}`, { method: 'DELETE' });
    delete map[key]; // 削除に成功した場合のみ対応表から消す
  } catch(e) {
    if(String(e.message).includes('404')){
      delete map[key]; // 先方で既に無い場合は対応表からも消してよい
    } else {
      throw e; // 通信エラー等は呼び出し元に伝え、対応表には残して次回また削除を試みる
    }
  }
}

// ログイン中の本人に割り当てられた「期限ありタスク・子タスク」を、本人のGoogle ToDoに同期する。
// 対象外になったもの（完了・担当者変更・削除・期限削除）は、ToDo側からも取り除く。
async function syncMyGoogleTasks(){
  if(_gtasksSyncing) return;
  if(!gAccessToken || !currentUser) return;
  if(isTokenExpired()){
    try { await refreshTokenSilently(); } catch(e){ return; }
  }
  _gtasksSyncing = true;
  let failCount = 0;
  try {
    const map = _getGtasksMap();
    const myId = currentUser.id;
    const syncedKeys = new Set();

    // 全タスクを見て、「親タスク自身が自分担当」「子タスクだけ自分担当（親は別の人）」の
    // 両方のケースを拾う。チームタスク（tasks）とプライベートタスク（getPrivateTasks）の
    // 両方を対象にする（プライベートタスクは自分専用なので、常に自分担当として扱う）
    //
    // 【重要】1件ごとに try/catch で囲み、成功するたびに map を保存する。
    // 以前は全体を1つのtry/catchで囲んでいたため、途中の1件が通信エラーで失敗すると
    // それまでの成功分がmapに保存されず、次回同期時に同じタスクが重複作成されていた。
    const allTargetTasks = [...tasks, ...getPrivateTasks()];
    for(const t of allTargetTasks){
      const parentIsMine = t.assignee === myId && !!t.due;
      let parentGoogleId = null;
      const key = 'p:' + t.id;

      if(parentIsMine){
        syncedKeys.add(key);
        try {
          parentGoogleId = await _upsertOneGoogleTask(key, t, map);
          _saveGtasksMap(map);
        } catch(e){
          failCount++;
          console.warn(`syncMyGoogleTasks: タスク「${t.title}」の同期に失敗（スキップして続行）:`, e);
        }
      }

      const subs = (t.subtasks||[]).filter(s => s.assignee === myId && s.due);
      for(const s of subs){
        const skey = 'c:' + t.id + ':' + s.id;
        syncedKeys.add(skey);
        try {
          if(parentGoogleId){
            // 親も自分担当として同期済み → その下に子タスクとしてぶら下げる
            await _upsertOneGoogleTask(skey, s, map, parentGoogleId);
          } else {
            // 親は自分担当ではない（別の人の親タスクに、自分だけ子タスクで入っているケース）
            // → 単独タスクとして「親タスク名 ▸ 子タスク名」の形で同期する
            await _upsertOneGoogleTask(skey, { ...s, title: `${t.title} ▸ ${s.title}` }, map);
          }
          _saveGtasksMap(map);
        } catch(e){
          failCount++;
          console.warn(`syncMyGoogleTasks: 子タスク「${s.title}」の同期に失敗（スキップして続行）:`, e);
        }
      }
    }

    // マップに残っているが、今回の対象から外れたものはToDo側から削除
    const staleKeys = Object.keys(map).filter(k => !syncedKeys.has(k));
    for(const k of staleKeys){
      try {
        await _deleteOneGoogleTask(k, map);
        _saveGtasksMap(map);
      } catch(e){
        failCount++;
        console.warn(`syncMyGoogleTasks: 不要タスク（key=${k}）の削除に失敗（スキップして続行）:`, e);
      }
    }
  } catch(e) {
    console.error('syncMyGoogleTasks failed:', e);
  } finally {
    _gtasksSyncing = false;
    if(failCount > 0) console.warn(`syncMyGoogleTasks: ${failCount}件の同期に失敗しました。次回の同期で再試行されます。`);
  }
}
