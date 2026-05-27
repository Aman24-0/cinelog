import { createSignal, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import { doc, updateDoc, deleteDoc, writeBatch, collection, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, TMDB_KEY } from '../utils';

function FolderEditModal(props) {
  const [name, setName] = createSignal(props.folder?.name || '');
  const [cover, setCover] = createSignal(props.folder?.coverImage || '');
  const [parentId, setParentId] = createSignal(props.folder?.parentId || '');
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');

  const save = async () => {
    await updateDoc(doc(db, 'users', props.uid, 'franchises', props.folder.id), {
      name: name().trim() || props.folder.name,
      coverImage: cover().trim() || null,
      parentId: parentId() || null
    });
    props.showToast('Folder updated');
    props.onClose();
  };

  return (
    <div class="fixed inset-0 z-[999999] flex items-center justify-center p-4" style="background:rgba(0,0,0,.75)" onClick={props.onClose}>
      <div class="w-full max-w-md rounded-2xl p-5" style="background:var(--surface);border:1px solid var(--border-active)" onClick={(e)=>e.stopPropagation()}>
        <h3 class="font-bold text-white mb-4 flex items-center gap-2"><Icon name="edit"/> Edit Folder</h3>
        <div class="space-y-3">
          <input value={name()} onInput={(e)=>setName(e.target.value)} placeholder="Folder name" class="w-full rounded-xl px-3 py-2 bg-black/30 border border-white/10 text-white"/>
          <input value={cover()} onInput={(e)=>setCover(e.target.value)} placeholder="Cover image URL (optional)" class="w-full rounded-xl px-3 py-2 bg-black/30 border border-white/10 text-white"/>
          <div>
            <label class="text-xs text-gray-400">Move to parent</label>
            <select value={parentId()} onChange={(e)=>setParentId(e.target.value)} class="w-full mt-1 rounded-xl px-3 py-2 bg-black/30 border border-white/10 text-white">
              <option value="">Root level</option>
              <For each={props.parentOptions}>{(p)=><option value={p.id}>{p.name}</option>}</For>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button onClick={props.onClose} class="px-3 py-2 rounded-xl text-sm" style="background:var(--raised)">Cancel</button>
          <button onClick={save} class="px-3 py-2 rounded-xl text-sm font-bold" style="background:var(--p);color:#000">Save</button>
        </div>
      </div>
    </div>
  );
}

export function FranchisesView(props) {
  const [currentFolder, setCurrentFolder] = createSignal(null);
  const [sortMode, setSortMode] = createSignal('order');
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [bulkAdding, setBulkAdding] = createSignal(false);
  const [editingFolder, setEditingFolder] = createSignal(null);

  const rootFolders = createMemo(() => props.franchises().filter(f => !f.parentId).sort((a,b)=>a.name.localeCompare(b.name)));
  const subFolders = createMemo(() => props.franchises().filter(f => f.parentId === currentFolder()).sort((a, b) => a.name.localeCompare(b.name)));
  const currentFolderData = createMemo(() => props.franchises().find(f => f.id === currentFolder()) || null);

  const nestedFolderIds = createMemo(() => {
    const base = currentFolder();
    if (!base) return [];
    const map = new Map();
    props.franchises().forEach(f => {
      const p = f.parentId || '__root__';
      if (!map.has(p)) map.set(p, []);
      map.get(p).push(f.id);
    });
    const out = new Set([base]);
    const q = [base];
    while (q.length) {
      const x = q.shift();
      (map.get(x) || []).forEach(id => { if (!out.has(id)) { out.add(id); q.push(id);} });
    }
    return [...out];
  });

  const currentMovies = createMemo(() => {
    let list = props.watchlist().filter(m => m.franchises && m.franchises[currentFolder()] !== undefined);
    return list.sort((a, b) =>
      sortMode() === 'year'
        ? (parseInt(String(a.release_date || a.first_air_date || '').substring(0, 4)) || 0) - (parseInt(String(b.release_date || b.first_air_date || '').substring(0, 4)) || 0)
        : a.franchises[currentFolder()] - b.franchises[currentFolder()]
    );
  });

  const flattenedMovies = createMemo(() => {
    const ids = new Set(nestedFolderIds());
    return props.watchlist().filter(m => {
      if (!m.franchises) return false;
      return Object.keys(m.franchises).some(fid => ids.has(fid));
    }).sort((a,b)=>{
      if (sortMode()==='year') return (parseInt(String(a.release_date||a.first_air_date||'').slice(0,4))||0) - (parseInt(String(b.release_date||b.first_air_date||'').slice(0,4))||0);
      const aOwn = a.franchises[currentFolder()] ?? 999999;
      const bOwn = b.franchises[currentFolder()] ?? 999999;
      return aOwn - bOwn;
    });
  });

  const groupedByFolder = createMemo(() => {
    const groups = [];
    nestedFolderIds().forEach(fid => {
      const folder = props.franchises().find(f => f.id === fid);
      if (!folder) return;
      const items = props.watchlist().filter(m => m.franchises && m.franchises[fid] !== undefined).sort((a,b)=>(a.franchises[fid]||0)-(b.franchises[fid]||0));
      if (items.length) groups.push({ folder, items });
    });
    return groups;
  });

  const createFolder = async () => {
    const n = prompt('Folder Name:');
    if (n && n.trim()) {
      await addDoc(collection(db, 'users', props.uid, 'franchises'), { name: n.trim(), parentId: currentFolder(), createdAt: serverTimestamp() });
      props.showToast('Folder created!');
    }
  };

  const moveMovie = async (index, dir, list = currentMovies(), folderId = currentFolder()) => {
    let arr = [...list];
    if (index + dir < 0 || index + dir >= arr.length) return;
    const batch = writeBatch(db);
    [arr[index], arr[index + dir]] = [arr[index + dir], arr[index]];
    arr.forEach((m, i) => batch.update(doc(db, 'users', props.uid, 'watchlist', String(m.id)), { [`franchises.${folderId}`]: i + 1 }));
    await batch.commit();
  };

  const removeFromFolder = async (m) => {
    if (!confirm(`"${m.title || m.name}" ko folder se hatayein?`)) return;
    const updated = { ...m.franchises };
    delete updated[currentFolder()];
    await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(m.id)), { franchises: updated });
    props.showToast('Removed from folder');
  };

  const addMissingFromCollection = async () => {
    const folder = currentFolderData();
    if (!folder?.tmdbCollectionId) return;
    setBulkAdding(true);
    try {
      const watchSet = new Set(props.watchlist().map(m => String(m.id)));
      const res = await fetch(`https://api.themoviedb.org/3/collection/${folder.tmdbCollectionId}?api_key=${TMDB_KEY}`);
      const coll = await res.json();
      const ordered = (coll.parts || []).slice().sort((a, b) => (new Date(a.release_date || 0).getTime() || 0) - (new Date(b.release_date || 0).getTime() || 0));
      let added = 0;
      for (let i = 0; i < ordered.length; i++) {
        const part = ordered[i];
        const ref = doc(db, 'users', props.uid, 'watchlist', String(part.id));
        const payload = { franchises: { [folder.id]: i + 1 } };
        if (!watchSet.has(String(part.id))) {
          payload.id = part.id; payload.title = part.title || ''; payload.poster_path = part.poster_path || null; payload.backdrop_path = part.backdrop_path || null;
          payload.media_type = 'movie'; payload.status = 'Planned'; payload.addedAt = serverTimestamp(); payload.release_date = part.release_date || '';
          payload.region = 'International'; payload.season = 1; payload.episode = 0; payload.totalEps = 0; payload.runtime = 0; added++;
        }
        await setDoc(ref, payload, { merge: true });
      }
      props.showToast(added > 0 ? `Added ${added} missing titles` : 'All collection titles already in vault');
    } finally { setBulkAdding(false); }
  };

  const folderCard = (f) => {
    const firstMovie = () => props.watchlist().find(m => m.franchises && m.franchises[f.id] !== undefined);
    const bgImage = () => f.coverImage || (firstMovie()?.backdrop_path ? `https://image.tmdb.org/t/p/w500${firstMovie().backdrop_path}` : 'none');
    const movieCount = () => props.watchlist().filter(m => m.franchises && m.franchises[f.id] !== undefined).length;
    return (
      <div onClick={() => setCurrentFolder(f.id)} class="relative rounded-[1.75rem] cursor-pointer group transition-all shadow-2xl flex flex-col justify-end min-h-[160px] overflow-hidden" style="border: 1px solid var(--border-active); background: var(--raised)">
        <Show when={bgImage() !== 'none'}>
          <img src={bgImage()} class="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-105" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-10" />
        </Show>
        <div class="relative z-20 p-6 w-full flex flex-col justify-end"><div class="label-mono mb-1" style="color: var(--p)">Collection</div><h3 class="font-headline text-3xl text-white leading-tight drop-shadow-lg">{f.name}</h3><p class="label-mono mt-1" style="color: var(--muted)">{movieCount()} titles</p></div>
        <button onClick={(e)=>{e.stopPropagation(); setEditingFolder(f);}} class="absolute top-4 right-16 z-30 w-10 h-10 rounded-full" style="background:rgba(0,0,0,.5);color:white"><Icon name="edit"/></button>
        <button onClick={(e) => { e.stopPropagation(); confirm('Delete folder?') && deleteDoc(doc(db, 'users', props.uid, 'franchises', f.id)); }} class="absolute top-4 right-4 z-30 w-10 h-10 flex items-center justify-center rounded-full transition-all" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); color: white"><Icon name="delete" class="text-lg" /></button>
      </div>
    );
  };

  return (
    <div class="pb-10 animate-fade-in">
      <div class="flex justify-between items-center mb-6"><h2 class="font-headline text-4xl text-white">LISTS</h2><Show when={!currentFolder()} fallback={<button onClick={() => setShowAddModal(true)} class="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 text-black" style="background: var(--p); box-shadow: 0 0 16px var(--p-glow)"><Icon name="playlist_add" class="text-base" /> Add Movie</button>}><button onClick={createFolder} class="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 border" style="background: var(--surface); border-color: var(--border-active); color: var(--text)"><Icon name="add" class="text-base" /> Folder</button></Show></div>
      <Show when={currentFolder()}><button onClick={() => setCurrentFolder(null)} class="mb-6 glass-surface px-4 py-2 rounded-full text-white text-[10px] font-bold uppercase flex items-center gap-2 tracking-widest w-max active:scale-95" style="border-color: var(--border-active)"><Icon name="arrow_back" class="text-sm" /> Back</button></Show>

      <Show when={!currentFolder() && rootFolders().length > 0}><div class="flex flex-col gap-4 mb-10"><For each={rootFolders()}>{(f)=>folderCard(f)}</For></div></Show>
      <Show when={currentFolder() && subFolders().length > 0 && sortMode() === 'grouped'}><div class="space-y-2 mb-6"><p class="label-mono">Sub Collections</p><For each={subFolders()}>{(f)=><div class="flex items-center justify-between rounded-xl p-3" style="background:var(--surface)"><button class="text-left font-bold text-white" onClick={()=>setCurrentFolder(f.id)}>{f.name}</button><button onClick={()=>setEditingFolder(f)} class="p-2 rounded-full hover:bg-white/5"><Icon name="edit"/></button></div>}</For></div></Show>

      <Show when={currentFolder()}>
        <div class="flex justify-between items-center mb-4 px-1 gap-2">
          <h3 class="font-headline text-2xl text-white">Titles <span style="color: var(--p)">({sortMode()==='grouped' ? groupedByFolder().reduce((a,g)=>a+g.items.length,0) : flattenedMovies().length})</span></h3>
          <div class="flex items-center gap-2">
            <Show when={currentFolderData()?.tmdbCollectionId}><button onClick={addMissingFromCollection} disabled={bulkAdding()} class="text-[10px] font-bold uppercase rounded-full px-3 py-1.5 disabled:opacity-50" style="background: var(--p-dim); border: 1px solid var(--p); color: var(--p)">{bulkAdding() ? 'Adding...' : 'Add Missing'}</button></Show>
            <div class="flex rounded-full border" style="border-color:var(--border-active)">
              <button class="px-3 py-1.5 text-[10px]" onClick={()=>setSortMode('order')} style={sortMode()==='order'?'background:var(--p);color:#000;border-radius:999px':''}>Custom</button>
              <button class="px-3 py-1.5 text-[10px]" onClick={()=>setSortMode('year')} style={sortMode()==='year'?'background:var(--p);color:#000;border-radius:999px':''}>Year</button>
              <button class="px-3 py-1.5 text-[10px]" onClick={()=>setSortMode('grouped')} style={sortMode()==='grouped'?'background:var(--p);color:#000;border-radius:999px':''}>Collection-wise</button>
            </div>
          </div>
        </div>

        <Show when={sortMode() !== 'grouped'}>
          <div class="space-y-3">
            <For each={flattenedMovies()}>
              {(m, i) => (
                <div class="flex items-center gap-3 rounded-2xl p-3 border transition-all" style="background: var(--surface); border-color: var(--border)">
                  <Show when={sortMode() === 'order'}><div class="flex flex-col items-center rounded-xl p-1 shrink-0" style="background: var(--raised)"><button onClick={() => moveMovie(i(), -1, flattenedMovies(), currentFolder())} class={`transition-colors ${i() === 0 ? 'opacity-20 pointer-events-none' : 'hover:text-white'}`} style="color: var(--muted)"><Icon name="keyboard_arrow_up" class="text-lg" /></button><span class="label-mono" style="font-size: 9px; color: var(--p)">{i() + 1}</span><button onClick={() => moveMovie(i(), 1, flattenedMovies(), currentFolder())} class={`transition-colors ${i() === flattenedMovies().length - 1 ? 'opacity-20 pointer-events-none' : 'hover:text-white'}`} style="color: var(--muted)"><Icon name="keyboard_arrow_down" class="text-lg" /></button></div></Show>
                  <div class="flex-1 flex items-center gap-3 cursor-pointer min-w-0" onClick={() => props.openMovie(m.id)}><img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} class="w-11 h-16 rounded-xl object-cover shadow-md shrink-0" /><div class="min-w-0"><p class="font-bold text-sm text-white truncate">{m.title || m.name}</p><p class="label-mono mt-1" style="font-size: 8px; color: var(--muted)">{(m.release_date || m.first_air_date || '').split('-')[0]}</p></div></div>
                  <button onClick={() => removeFromFolder(m)} class="w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0" style="color: var(--muted)"><Icon name="remove_circle" class="text-lg" /></button>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={sortMode() === 'grouped'}>
          <div class="space-y-6">
            <For each={groupedByFolder()}>{(group)=><div><h4 class="font-bold text-white mb-2">{group.folder.name}</h4><div class="space-y-2"><For each={group.items}>{(m)=><div class="rounded-xl p-3 flex items-center gap-3" style="background:var(--surface)"><img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} class="w-10 h-14 rounded-lg object-cover"/><button class="text-left text-white font-bold truncate" onClick={()=>props.openMovie(m.id)}>{m.title || m.name}</button></div>}</For></div></div>}</For>
          </div>
        </Show>
      </Show>

      <Show when={showAddModal() && currentFolder()}>
      </Show>

      <Show when={editingFolder()}>
        <FolderEditModal
          folder={editingFolder()}
          uid={props.uid}
          showToast={props.showToast}
          onClose={() => setEditingFolder(null)}
          parentOptions={props.franchises().filter(f => f.id !== editingFolder()?.id)}
        />
      </Show>
    </div>
  );
}
