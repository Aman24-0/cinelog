import { createSignal, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import { doc, updateDoc, deleteDoc, writeBatch, collection, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, TMDB_KEY } from '../utils';

function AddToFolderModal(props) {
  const [search, setSearch] = createSignal('');
  const [mode, setMode] = createSignal('vault');
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');

  const detectRelated = (m) => {
    const blob = `${m.title || m.name || ''} ${(m.genresList || []).join(' ')} ${(m.castList || []).join(' ')}`.toLowerCase();
    const folderName = (props.folderName || '').toLowerCase();
    if (folderName.includes('marvel')) return /(marvel|avengers|iron man|thor|captain america|guardians|doctor strange|black panther|ant-man|spider-man|x-men|deadpool)/.test(blob);
    if (folderName.includes('dc')) return /(dc|batman|superman|wonder woman|justice league|aquaman|flash)/.test(blob);
    if (!folderName) return false;
    return blob.includes(folderName.split(' ')[0]);
  };

  const pool = createMemo(() => props.watchlist().filter(m => m.franchises?.[props.folderId] === undefined));
  const shown = createMemo(() => {
    const q = search().toLowerCase();
    let list = mode() === 'related' ? pool().filter(detectRelated) : pool();
    if (q) list = list.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
    return list;
  });

  const addToFolder = async (m) => {
    const nextOrder = props.currentMovies().length + 1;
    await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(m.id)), { [`franchises.${props.folderId}`]: nextOrder });
    props.showToast('Added to folder');
  };

  return (
    <div class="fixed inset-0 z-[999999] flex items-center justify-center p-4" style="background:rgba(0,0,0,.75)" onClick={props.onClose}>
      <div class="w-full max-w-2xl rounded-2xl overflow-hidden" style="background:var(--surface);border:1px solid var(--border-active)" onClick={(e)=>e.stopPropagation()}>
        <div class="p-4 flex items-center justify-between">
          <h3 class="text-white font-bold flex items-center gap-2"><Icon name="playlist_add"/> Add to Folder</h3>
          <button onClick={props.onClose} class="p-2 rounded-full hover:bg-white/10"><Icon name="close"/></button>
        </div>
        <div class="px-4 pb-3 flex items-center gap-2">
          <button onClick={()=>setMode('vault')} class="px-3 py-1.5 rounded-full text-xs font-bold" style={mode()==='vault'?'background:var(--p);color:#000':'background:var(--raised);color:var(--text)'}>From Vault</button>
          <button onClick={()=>setMode('related')} class="px-3 py-1.5 rounded-full text-xs font-bold" style={mode()==='related'?'background:var(--p);color:#000':'background:var(--raised);color:var(--text)'}>Auto Related</button>
          <input value={search()} onInput={(e)=>setSearch(e.target.value)} placeholder="Search title..." class="ml-auto w-64 rounded-xl px-3 py-2 bg-black/30 border border-white/10 text-white text-sm"/>
        </div>
        <div class="max-h-[60vh] overflow-y-auto p-3 space-y-2">
          <Show when={shown().length === 0}>
            <div class="text-center py-12 text-gray-400">
              <Icon name="inbox" class="text-4xl mb-2" />
              <p class="text-sm font-bold">No matching titles</p>
            </div>
          </Show>
          <For each={shown()}>
            {(m) => (
              <div class="flex items-center gap-3 rounded-xl p-3" style="background:var(--raised)">
                <img src={m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : ''} class="w-10 h-14 rounded-lg object-cover bg-black/40" />
                <div class="flex-1 min-w-0">
                  <p class="text-white font-bold truncate">{m.title || m.name}</p>
                  <p class="text-[10px] text-gray-400">{(m.release_date || m.first_air_date || '').split('-')[0]} · {m.media_type === 'tv' ? 'Series' : 'Movie'}</p>
                </div>
                <button onClick={()=>addToFolder(m)} class="px-3 py-1.5 rounded-lg text-xs font-bold" style="background:var(--p);color:#000">Add</button>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

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

function SharePdfModal(props) {
  const [sort, setSort] = createSignal(props.currentSort);
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');

  return (
    <div class="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={props.onClose}>
      <div class="bg-[#141414] border border-white/10 p-6 rounded-3xl w-full max-w-sm animate-pop-in shadow-2xl" onClick={e=>e.stopPropagation()}>
        <h3 class="text-white font-bold text-xl mb-2 flex items-center gap-2">
          <Icon name="picture_as_pdf" style="color: var(--p)"/> Export Layout Order
        </h3>
        <p class="text-xs text-gray-400 mb-5">Select the blueprint alignment sequence for compiling your printable ledger data.</p>
        
        <div class="flex flex-col gap-3 mb-6">
           <label class="flex items-center gap-3 text-white text-sm p-3 rounded-xl border border-white/5 bg-[#1a1a1a] cursor-pointer hover:border-[var(--p)] transition-all">
             <input type="radio" checked={sort()==='order'} onChange={()=>setSort('order')} class="accent-[var(--p)] w-4 h-4"/> 
             Custom Matrix Alignment
           </label>
           <label class="flex items-center gap-3 text-white text-sm p-3 rounded-xl border border-white/5 bg-[#1a1a1a] cursor-pointer hover:border-[var(--p)] transition-all">
             <input type="radio" checked={sort()==='year'} onChange={()=>setSort('year')} class="accent-[var(--p)] w-4 h-4"/> 
             Absolute Release Year
           </label>
           <label class="flex items-center gap-3 text-white text-sm p-3 rounded-xl border border-white/5 bg-[#1a1a1a] cursor-pointer hover:border-[var(--p)] transition-all">
             <input type="radio" checked={sort()==='grouped'} onChange={()=>setSort('grouped')} class="accent-[var(--p)] w-4 h-4"/> 
             Structural Sub-Collections
           </label>
        </div>

        <div class="flex gap-2">
          <button class="flex-[2] py-3 rounded-xl bg-[var(--p)] text-black font-bold text-xs uppercase tracking-widest active:scale-95 transition-transform shadow-[0_0_16px_var(--p-glow)]" onClick={()=>props.onExport(sort())}>Compile PDF</button>
          <button class="flex-1 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 text-gray-300 font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-all" onClick={props.onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function FranchisesView(props) {
  const [currentFolder, setCurrentFolder] = createSignal(null);
  const [sortMode, setSortMode] = createSignal('order');
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [showShareModal, setShowShareModal] = createSignal(false);
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

  const getNestedFolderIds = (folderId) => {
    if (!folderId) return [];
    const map = new Map();
    props.franchises().forEach(f => {
      const p = f.parentId || '__root__';
      if (!map.has(p)) map.set(p, []);
      map.get(p).push(f.id);
    });
    const out = new Set([folderId]);
    const q = [folderId];
    while (q.length) {
      const x = q.shift();
      (map.get(x) || []).forEach(id => {
        if (!out.has(id)) {
          out.add(id);
          q.push(id);
        }
      });
    }
    return [...out];
  };

  const folderParentOptions = (folder) => {
    if (!folder) return [];
    const blocked = new Set(getNestedFolderIds(folder.id));
    return props.franchises()
      .filter(f => !blocked.has(f.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

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

  const detectSubCollectionName = (m) => {
    const t = (m.title || m.name || '').toLowerCase();
    if (t.includes('iron man')) return 'Iron Man Collection';
    if (t.includes('thor')) return 'Thor Collection';
    if (t.includes('captain america')) return 'Captain America Collection';
    if (t.includes('avengers')) return 'Avengers Collection';
    if (t.includes('guardians of the galaxy') || t.includes('guardians')) return 'Guardians of the Galaxy Collection';
    if (t.includes('ant-man')) return 'Ant-Man Collection';
    if (t.includes('doctor strange')) return 'Doctor Strange Collection';
    if (t.includes('black panther')) return 'Black Panther Collection';
    if (t.includes('captain marvel') || t.includes('the marvels')) return 'Captain Marvel Collection';
    if (t.includes('spider-man') || t.includes('spiderman')) return 'Spider-Man Collection';
    if (t.includes('deadpool')) return 'Deadpool Collection';
    if (t.includes('x-men') || t.includes('wolverine') || t.includes('logan')) return 'X-Men Collection';
    return 'Other / Crossover';
  };

  const groupedByCollection = createMemo(() => {
    const ids = new Set(nestedFolderIds());
    const folderById = new Map(props.franchises().map(f => [f.id, f]));
    const map = new Map();

    flattenedMovies().forEach((m) => {
      const childFolderId = Object.keys(m.franchises || {}).find(fid => fid !== currentFolder() && ids.has(fid));
      const key = childFolderId && folderById.get(childFolderId)
        ? folderById.get(childFolderId).name
        : detectSubCollectionName(m);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    });

    return [...map.entries()]
      .map(([name, items]) => ({
        name,
        items: items.sort((a, b) => (parseInt(String(a.release_date || a.first_air_date || '').slice(0, 4)) || 0) - (parseInt(String(b.release_date || b.first_air_date || '').slice(0, 4)) || 0))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const createFolder = async () => {
    const n = prompt('Folder Name:');
    if (n && n.trim()) {
      await addDoc(collection(db, 'users', props.uid, 'franchises'), { name: n.trim(), parentId: currentFolder(), createdAt: serverTimestamp() });
      props.showToast('Folder created!');
    }
  };

  // NEW DIRECT JUMP LOGIC
  const jumpToPosition = async (oldIndex, m, list = currentMovies(), folderId = currentFolder()) => {
    const input = prompt(`Move "${m.title || m.name}" to position (1 - ${list.length}):\n\nCurrent position: ${oldIndex + 1}`);
    if (!input) return;
    
    const newPos = parseInt(input, 10);
    if (isNaN(newPos) || newPos < 1 || newPos > list.length || newPos - 1 === oldIndex) {
      return props.showToast("Invalid position.");
    }

    const newIndex = newPos - 1;
    let arr = [...list];
    
    // Remove from old pos and insert at new pos
    const [item] = arr.splice(oldIndex, 1);
    arr.splice(newIndex, 0, item);

    const batch = writeBatch(db);
    arr.forEach((mov, i) => batch.update(doc(db, 'users', props.uid, 'watchlist', String(mov.id)), { [`franchises.${folderId}`]: i + 1 }));
    await batch.commit();
    props.showToast(`Moved to position ${newPos}`);
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

  const handlePdfExport = (selectedSort) => {
    setSortMode(selectedSort);
    setShowShareModal(false);
    
    // Give the DOM a moment to re-render the view with the new sort before popping the print dialog
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const folderCard = (f) => {
    const folderIds = () => new Set(getNestedFolderIds(f.id));
    const firstMovie = () => props.watchlist().find(m => m.franchises && Object.keys(m.franchises).some(fid => folderIds().has(fid)));
    const bgImage = () => f.coverImage || (firstMovie()?.backdrop_path ? `https://image.tmdb.org/t/p/w500${firstMovie().backdrop_path}` : 'none');
    const movieCount = () => props.watchlist().filter(m => m.franchises && Object.keys(m.franchises).some(fid => folderIds().has(fid))).length;
    return (
      <div onClick={() => setCurrentFolder(f.id)} class="relative rounded-[1.75rem] cursor-pointer group transition-all shadow-2xl flex flex-col justify-end min-h-[160px] overflow-hidden" style="border: 1px solid var(--border-active); background: var(--raised)">
        <Show when={bgImage() !== 'none'}>
          <img src={bgImage()} class="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-105" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-10" />
        </Show>
        <div class="relative z-20 p-6 w-full flex flex-col justify-end"><div class="label-mono mb-1" style="color: var(--p)">Collection</div><h3 class="font-headline text-3xl text-white leading-tight drop-shadow-lg">{f.name}</h3><p class="label-mono mt-1" style="color: var(--muted)">{movieCount()} titles</p></div>
        <button onClick={(e)=>{e.stopPropagation(); setEditingFolder(f);}} class="absolute top-4 right-16 z-30 w-10 h-10 rounded-full flex items-center justify-center" style="background:rgba(0,0,0,.5);color:white"><Icon name="edit"/></button>
        <button onClick={(e) => { e.stopPropagation(); confirm('Delete folder?') && deleteDoc(doc(db, 'users', props.uid, 'franchises', f.id)); }} class="absolute top-4 right-4 z-30 w-10 h-10 flex items-center justify-center rounded-full transition-all" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); color: white"><Icon name="delete" class="text-lg" /></button>
      </div>
    );
  };

  return (
    <>
      {/* ── STANDARD DARK UI ── */}
      <div class="pb-10 animate-fade-in no-print">
        <div class="flex justify-between items-center mb-6">
          <h2 class="font-headline text-4xl text-white">LISTS</h2>
          <Show
            when={!currentFolder()}
            fallback={
              <div class="flex items-center gap-2">
                <button onClick={createFolder} class="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 border" style="background: var(--surface); border-color: var(--border-active); color: var(--text)"><Icon name="create_new_folder" class="text-base" /> Sub Folder</button>
                <button onClick={() => setShowAddModal(true)} class="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 text-black" style="background: var(--p); box-shadow: 0 0 16px var(--p-glow)"><Icon name="playlist_add" class="text-base" /> Add Movie</button>
              </div>
            }
          >
            <button onClick={createFolder} class="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 border" style="background: var(--surface); border-color: var(--border-active); color: var(--text)"><Icon name="add" class="text-base" /> Folder</button>
          </Show>
        </div>
        <Show when={currentFolder()}><button onClick={() => setCurrentFolder(null)} class="mb-6 glass-surface px-4 py-2 rounded-full text-white text-[10px] font-bold uppercase flex items-center gap-2 tracking-widest w-max active:scale-95" style="border-color: var(--border-active)"><Icon name="arrow_back" class="text-sm" /> Back</button></Show>

        <Show when={!currentFolder() && rootFolders().length > 0}><div class="flex flex-col gap-4 mb-10"><For each={rootFolders()}>{(f)=>folderCard(f)}</For></div></Show>
        <Show when={currentFolder() && subFolders().length > 0 && sortMode() === 'grouped'}><div class="space-y-2 mb-6"><p class="label-mono">Sub Collections</p><For each={subFolders()}>{(f)=><div class="flex items-center justify-between rounded-xl p-3" style="background:var(--surface)"><button class="text-left font-bold text-white" onClick={()=>setCurrentFolder(f.id)}>{f.name}</button><button onClick={()=>setEditingFolder(f)} class="p-2 rounded-full hover:bg-white/5 flex items-center justify-center"><Icon name="edit"/></button></div>}</For></div></Show>

        <Show when={currentFolder()}>
          <div class="flex justify-between items-center mb-4 px-1 gap-2 flex-wrap">
            <h3 class="font-headline text-2xl text-white">Titles <span style="color: var(--p)">({sortMode()==='grouped' ? groupedByCollection().reduce((a,g)=>a+g.items.length,0) : flattenedMovies().length})</span></h3>
            <div class="flex items-center gap-2 flex-wrap">
              <Show when={currentFolderData()?.tmdbCollectionId}><button onClick={addMissingFromCollection} disabled={bulkAdding()} class="text-[10px] font-bold uppercase rounded-full px-3 py-1.5 disabled:opacity-50" style="background: var(--p-dim); border: 1px solid var(--p); color: var(--p)">{bulkAdding() ? 'Adding...' : 'Add Missing'}</button></Show>
              
              <button onClick={() => setShowShareModal(true)} class="text-[10px] font-bold uppercase rounded-full px-3 py-1.5 flex items-center gap-1 transition-all hover:bg-white/10" style="background: var(--surface); border: 1px solid var(--border); color: var(--text)">
                <Icon name="ios_share" class="text-[14px]"/> Export
              </button>

              <div class="flex rounded-full border" style="border-color:var(--border-active)">
                <button class="px-3 py-1.5 text-[10px]" onClick={()=>setSortMode('order')} style={sortMode()==='order'?'background:var(--p);color:#000;border-radius:999px':''}>Custom</button>
                <button class="px-3 py-1.5 text-[10px]" onClick={()=>setSortMode('year')} style={sortMode()==='year'?'background:var(--p);color:#000;border-radius:999px':''}>Year</button>
                <button class="px-3 py-1.5 text-[10px]" onClick={()=>setSortMode('grouped')} style={sortMode()==='grouped'?'background:var(--p);color:#000;border-radius:999px':''}>Collection</button>
              </div>
            </div>
          </div>

          <Show when={sortMode() !== 'grouped'}>
            <div class="space-y-3">
              <For each={flattenedMovies()}>
                {(m, i) => (
                  <div class="flex items-center gap-3 rounded-2xl p-3 border transition-all" style="background: var(--surface); border-color: var(--border)">
                    
                    {/* The new direct jump button */}
                    <Show when={sortMode() === 'order'}>
                      <button 
                        onClick={() => jumpToPosition(i(), m, flattenedMovies(), currentFolder())} 
                        class="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-all hover:scale-105 active:scale-95" 
                        style="background: var(--raised); border: 1px solid var(--border-active); color: var(--p)"
                        title="Click to jump to a specific position"
                      >
                        {i() + 1}
                      </button>
                    </Show>

                    <div class="flex-1 flex items-center gap-3 cursor-pointer min-w-0" onClick={() => props.openMovie(m.id)}>
                      <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} class="w-11 h-16 rounded-xl object-cover shadow-md shrink-0" />
                      <div class="min-w-0">
                        <p class="font-bold text-sm text-white truncate">{m.title || m.name}</p>
                        <p class="label-mono mt-1" style="font-size: 8px; color: var(--muted)">{(m.release_date || m.first_air_date || '').split('-')[0]}</p>
                      </div>
                    </div>
                    <button onClick={() => removeFromFolder(m)} class="w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0" style="color: var(--muted)"><Icon name="remove_circle" class="text-lg" /></button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={sortMode() === 'grouped'}>
            <div class="space-y-6">
              <For each={groupedByCollection()}>{(group)=><div><h4 class="font-bold text-white mb-2">{group.name}</h4><div class="space-y-2"><For each={group.items}>{(m)=><div class="rounded-xl p-3 flex items-center gap-3" style="background:var(--surface)"><img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} class="w-10 h-14 rounded-lg object-cover"/><button class="text-left text-white font-bold truncate" onClick={()=>props.openMovie(m.id)}>{m.title || m.name}</button></div>}</For></div></div>}</For>
            </div>
          </Show>
        </Show>
      </div>

      {/* ── PRINTABLE PDF UI ── */}
      <Show when={currentFolder()}>
        <div class="print-only bg-white p-8 font-sans text-black min-h-screen">
          <h1 class="text-3xl font-black mb-1 text-black">{currentFolderData()?.name}</h1>
          <p class="text-gray-500 text-sm mb-6 pb-4 border-b border-gray-300">
            Cinelog Vault Data Ledger • {sortMode() === 'year' ? 'Sorted by Release Timeline' : sortMode() === 'grouped' ? 'Grouped by Sub-Collection Folders' : 'Custom Matrix Alignment Order'}
          </p>

          <Show when={sortMode() !== 'grouped'}>
            <div class="flex flex-col gap-2">
              <For each={flattenedMovies()}>{(m, i) => (
                <div class="flex items-center gap-4 py-2 border-b border-gray-100 print-item">
                  <span class="text-gray-400 font-mono text-sm w-6">
                    {i() + 1}.
                  </span>
                  <Show when={m.poster_path} fallback={<div class="w-10 h-14 bg-gray-200 rounded" />}>
                    <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} class="w-10 h-14 object-cover rounded shadow-sm" />
                  </Show>
                  <div>
                    <h3 class="font-bold text-base text-black leading-tight m-0">{m.title || m.name}</h3>
                    <p class="text-xs text-gray-500 m-0 mt-0.5">{(m.release_date || m.first_air_date || '').split('-')[0]} • {m.media_type==='tv'?'Series':'Movie'}</p>
                  </div>
                </div>
              )}</For>
            </div>
          </Show>

          <Show when={sortMode() === 'grouped'}>
            <div class="space-y-6">
              <For each={groupedByCollection()}>{(group) => (
                <div class="print-item">
                  <h2 class="text-lg font-bold border-b border-gray-300 pb-1 mb-2 text-black">{group.name}</h2>
                  <div class="flex flex-col gap-1">
                    <For each={group.items}>{(m) => (
                      <div class="flex items-center gap-3 py-1.5 print-item">
                        <Show when={m.poster_path} fallback={<div class="w-8 h-12 bg-gray-200 rounded" />}>
                          <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} class="w-8 h-12 object-cover rounded shadow-sm" />
                        </Show>
                        <div>
                          <h3 class="font-bold text-sm text-black leading-tight m-0">{m.title || m.name}</h3>
                          <p class="text-[10px] text-gray-500 m-0 mt-0.5">{(m.release_date || m.first_air_date || '').split('-')[0]}</p>
                        </div>
                      </div>
                    )}</For>
                  </div>
                </div>
              )}</For>
            </div>
          </Show>
        </div>
      </Show>

      {/* ── MODALS ── */}
      <Show when={showShareModal() && currentFolder()}>
        <SharePdfModal 
          currentSort={sortMode()} 
          onClose={() => setShowShareModal(false)}
          onExport={handlePdfExport}
        />
      </Show>

      <Show when={showAddModal() && currentFolder()}>
        <AddToFolderModal
          uid={props.uid}
          folderId={currentFolder()}
          folderName={currentFolderData()?.name}
          watchlist={props.watchlist}
          currentMovies={currentMovies}
          showToast={props.showToast}
          onClose={() => setShowAddModal(false)}
        />
      </Show>

      <Show when={editingFolder()}>
        <FolderEditModal
          folder={editingFolder()}
          uid={props.uid}
          showToast={props.showToast}
          onClose={() => setEditingFolder(null)}
          parentOptions={folderParentOptions(editingFolder())}
        />
      </Show>
    </>
  );
}
