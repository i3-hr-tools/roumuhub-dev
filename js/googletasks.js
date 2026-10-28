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
  if(cached){ _gtasksListId = cached; return cached; }

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
      // 先方で削除済み等の場合は新規作成し直す
      delete map[key];
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
  } catch(e) { /* 既に無い場合は無視 */ }
  delete map[key];
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
  try {
    const map = _getGtasksMap();
    const myId = currentUser.id;
    const syncedKeys = new Set();

    // 全タスクを見て、「親タスク自身が自分担当」「子タスクだけ自分担当（親は別の人）」の
    // 両方のケースを拾う。チームタスク（tasks）とプライベートタスク（getPrivateTasks）の
    // 両方を対象にする（プライベートタスクは自分専用なので、常に自分担当として扱う）
    const allTargetTasks = [...tasks, ...getPrivateTasks()];
    for(const t of allTargetTasks){
      const parentIsMine = t.assignee === myId && !!t.due;
      let parentGoogleId = null;
      const key = 'p:' + t.id;

      if(parentIsMine){
        syncedKeys.add(key);
        parentGoogleId = await _upsertOneGoogleTask(key, t, map);
      }

      const subs = (t.subtasks||[]).filter(s => s.assignee === myId && s.due);
      for(const s of subs){
        const skey = 'c:' + t.id + ':' + s.id;
        syncedKeys.add(skey);
        if(parentGoogleId){
          // 親も自分担当として同期済み → その下に子タスクとしてぶら下げる
          await _upsertOneGoogleTask(skey, s, map, parentGoogleId);
        } else {
          // 親は自分担当ではない（別の人の親タスクに、自分だけ子タスクで入っているケース）
          // → 単独タスクとして「親タスク名 ▸ 子タスク名」の形で同期する
          await _upsertOneGoogleTask(skey, { ...s, title: `${t.title} ▸ ${s.title}` }, map);
        }
      }
    }

    // マップに残っているが、今回の対象から外れたものはToDo側から削除
    const staleKeys = Object.keys(map).filter(k => !syncedKeys.has(k));
    for(const k of staleKeys){
      await _deleteOneGoogleTask(k, map);
    }

    _saveGtasksMap(map);
  } catch(e) {
    console.warn('syncMyGoogleTasks failed:', e);
  } finally {
    _gtasksSyncing = false;
  }
}
