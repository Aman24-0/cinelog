import { createSignal, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import { doc, updateDoc, deleteDoc, writeBatch, collection, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, TMDB_KEY } from '../utils';

function AddToFolderModal(props) {
  const [search, setSearch] = createSignal('');
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');

  const available = createMemo(() => {
    const q = search().toLowerCase();
    return props.watchlist().filter(m => m.franchises?.[props.folderId] === undefined)
      .filter(m => !q || (m.title || m.name || '').toLowerCase().includes(q));
  });

  const addToFolder = async (m) => {
    const nextOrder = props.currentMovies().length + 1;
    await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(m.id)), { [`franchises.${props.folderId}`]: nextOrder });
    props.showToast('Added!');
  };

  return (
    <div class="fixed inset-0 flex items-center justify-center p-4 z-[999999] animate-fade-in"
      style="background: rgba(0,0,0,0.8); backdrop-filter: blur(12px)"
      onClick={props.onClose}>
      <div class="w-full max-w-lg rounded-[2rem] border shadow-2xl animate-pop-in overflow-hidden flex flex-col max-h-[80vh]"
        style="background: rgba(9,11,16,0.98); border-color: var(--border-active)"
        onClick={e => e.stopPropagation()}>
        <div class="p-5 flex justify-between items-center shrink-0" style="border-bottom: 1px solid var(--border)">
          <h3 class="font-bold text-lg text-white flex items-center gap-2">
            <Icon name="playlist_add" style="color: var(--p)" /> Vault se Add karo
          </h3>
          <button onClick={props.onClose} class="p-2 rounded-full hover:bg-white/5" style="color: var(--muted)">
            <Icon name="close" />
          </button>
        </div>
        <div class="p-4 shrink-0" style="border-bottom: 1px solid var(--border)">
          <div class="flex items-center gap-3 rounded-xl px-4 py-3 border"
            style="background: var(--surface); border-color: var(--border)">
            <Icon name="search" style="color: var(--dim)" />
            <input autofocus value={search()} onInput={e => setSearch(e.target.value)}
              placeholder="Movie ya series dhundo..."
              class="bg-transparent border-none w-full outline-none text-sm font-medium"
              style="color: var(--text)" />
          </div>
        </div>
        <div class="overflow-y-auto hide-scrollbar p-3 space-y-2">
          <Show when={available().length === 0}>
            <div class="text-center py-12" style="color: var(--muted)">
              <Icon name="check_circle" class="text-4xl mb-2 opacity-30" />
              <p class="text-sm font-bold">Saari movies folder mein hain already!</p>
            </div>
          </Show>
          <For each={available()}>
            {(m) => (
              <div class="flex items-center gap-3 rounded-2xl p-3 border transition-all"
                style="background: var(--surface); border-color: var(--border)">
                <Show when={m.poster_path}
                  fallback={<div class="w-10 h-14 rounded-xl shrink-0 flex items-center justify-center" style="background: var(--raised)"><Icon name="movie" style="color: var(--dim); font-size: 14px" /></div>}>
                  <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} class="w-10 h-14 rounded-xl object-cover shrink-0" style="background: var(--raised)" />
                </Show>
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-sm text-white truncate">{m.title || m.name}</p>
                  <p class="label-mono mt-0.5" style="font-size: 8px; color: var(--muted)">
                    {(m.release_date || m.first_air_date || '').split('-')[0]} · {m.media_type === 'tv' ? 'Series' : 'Movie'}
                  </p>
                </div>
                <button onClick={() => addToFolder(m)}
                  class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
                  style="background: var(--p-dim); color: var(--p); border: 1px solid var(--p)">
                  <Icon name="add" class="text-lg" />
                </button>
              </div>
            )}
          </For>
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

  const subFolders = createMemo(() =>
    props.franchises().filter(f => f.parentId === currentFolder()).sort((a, b) => a.name.localeCompare(b.name))
  );
  const currentMovies = createMemo(() => {
    let list = props.watchlist().filter(m => m.franchises && m.franchises[currentFolder()] !== undefined);
    return list.sort((a, b) =>
      sortMode() === 'year'
        ? (parseInt(String(b.release_date || b.first_air_date || '').substring(0, 4)) || 0) - (parseInt(String(a.release_date || a.first_air_date || '').substring(0, 4)) || 0)
        : a.franchises[currentFolder()] - b.franchises[currentFolder()]
    );
  });
  const currentFolderData = createMemo(() => props.franchises().find(f => f.id === currentFolder()) || null);

  const createFolder = async () => {
    const n = prompt('Folder Name:');
    if (n && n.trim()) {
      await addDoc(collection(db, 'users', props.uid, 'franchises'), { name: n.trim(), parentId: currentFolder(), createdAt: serverTimestamp() });
      props.showToast('Folder created!');
    }
  };

  const moveMovie = async (index, dir) => {
    let arr = [...currentMovies()];
    if (index + dir < 0 || index + dir >= arr.length) return;
    const batch = writeBatch(db);
    [arr[index], arr[index + dir]] = [arr[index + dir], arr[index]];
    arr.forEach((m, i) => batch.update(doc(db, 'users', props.uid, 'watchlist', String(m.id)), { [`franchises.${currentFolder()}`]: i + 1 }));
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
          payload.id = part.id;
          payload.title = part.title || '';
          payload.poster_path = part.poster_path || null;
          payload.backdrop_path = part.backdrop_path || null;
          payload.media_type = 'movie';
          payload.status = 'Planned';
          payload.addedAt = serverTimestamp();
          payload.release_date = part.release_date || '';
          payload.region = 'International';
          payload.season = 1;
          payload.episode = 0;
          payload.totalEps = 0;
          payload.runtime = 0;
          added++;
        }
        await setDoc(ref, payload, { merge: true });
      }
      props.showToast(added > 0 ? `Added ${added} missing titles` : 'All collection titles already in vault');
    } finally {
      setBulkAdding(false);
    }
  };

  return (
    <div class="pb-10 animate-fade-in">
      <div class="flex justify-between items-center mb-6">
        <h2 class="font-headline text-4xl text-white">LISTS</h2>
        <Show when={!currentFolder()}
          fallback={
            <button onClick={() => setShowAddModal(true)}
              class="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 text-black"
              style="background: var(--p); box-shadow: 0 0 16px var(--p-glow)">
              <Icon name="playlist_add" class="text-base" /> Add Movie
            </button>
          }>
          <button onClick={createFolder}
            class="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 border"
            style="background: var(--surface); border-color: var(--border-active); color: var(--text)">
            <Icon name="add" class="text-base" /> Folder
          </button>
        </Show>
      </div>

      <Show when={currentFolder()}>
        <button onClick={() => setCurrentFolder(null)}
          class="mb-6 glass-surface px-4 py-2 rounded-full text-white text-[10px] font-bold uppercase flex items-center gap-2 tracking-widest w-max active:scale-95"
          style="border-color: var(--border-active)">
          <Icon name="arrow_back" class="text-sm" /> Back
        </button>
      </Show>

      {/* Folder cards */}
      <Show when={subFolders().length > 0}>
        <div class="flex flex-col gap-4 mb-10">
          <For each={subFolders()}>
            {(f) => {
              const firstMovie = () => props.watchlist().find(m => m.franchises && m.franchises[f.id] !== undefined);
              const bgImage = () => firstMovie()?.backdrop_path ? `https://image.tmdb.org/t/p/w500${firstMovie().backdrop_path}` : 'none';
              const movieCount = () => props.watchlist().filter(m => m.franchises && m.franchises[f.id] !== undefined).length;
              return (
                <div onClick={() => setCurrentFolder(f.id)}
                  class="relative rounded-[1.75rem] cursor-pointer group transition-all shadow-2xl flex flex-col justify-end min-h-[160px] overflow-hidden"
                  style="border: 1px solid var(--border-active); background: var(--raised)">
                  <Show when={bgImage() !== 'none'}>
                    <img src={bgImage()} class="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-105" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-10" />
                  </Show>
                  <div class="relative z-20 p-6 w-full flex flex-col justify-end">
                    <div class="label-mono mb-1" style="color: var(--p)">Collection</div>
                    <h3 class="font-headline text-3xl text-white leading-tight drop-shadow-lg">{f.name}</h3>
                    <p class="label-mono mt-1" style="color: var(--muted)">{movieCount()} titles</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); confirm('Delete folder?') && deleteDoc(doc(db, 'users', props.uid, 'franchises', f.id)); }}
                    class="absolute top-4 right-4 z-30 w-10 h-10 flex items-center justify-center rounded-full transition-all"
                    style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); color: white">
                    <Icon name="delete" class="text-lg" />
                  </button>
                  <Show when={bgImage() === 'none'}>
                    <Icon name="folder" fill class="absolute right-6 top-1/2 -translate-y-1/2 text-white/[0.04] text-8xl pointer-events-none z-10" />
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Folder contents */}
      <Show when={currentFolder()}>
        <div class="flex justify-between items-center mb-4 px-1 gap-2">
          <h3 class="font-headline text-2xl text-white">
            Titles <span style="color: var(--p)">({currentMovies().length})</span>
          </h3>
          <div class="flex items-center gap-2">
            <Show when={currentFolderData()?.tmdbCollectionId}>
              <button onClick={addMissingFromCollection} disabled={bulkAdding()}
                class="text-[10px] font-bold uppercase rounded-full px-3 py-1.5 disabled:opacity-50"
                style="background: var(--p-dim); border: 1px solid var(--p); color: var(--p)">
                {bulkAdding() ? 'Adding...' : 'Add Missing'}
              </button>
            </Show>
            <select value={sortMode()} onChange={e => setSortMode(e.target.value)}
              class="text-[10px] font-bold uppercase rounded-full px-3 py-1.5"
              style="background: var(--surface); border: 1px solid var(--border-active); color: var(--p)">
              <option value="order">Sort: Custom</option>
              <option value="year">Sort: Year</option>
            </select>
          </div>
        </div>

        <Show when={currentMovies().length === 0}>
          <div class="text-center py-16" style="color: var(--muted)">
            <Icon name="video_library" class="text-5xl mb-3" style="color: var(--p); opacity: 0.4" />
            <p class="text-sm font-bold text-white">Folder empty hai</p>
            <p class="text-xs mt-1">"Add Movie" se vault se add karo</p>
          </div>
        </Show>

        <div class="space-y-3">
          <For each={currentMovies()}>
            {(m, i) => (
              <div class="flex items-center gap-3 rounded-2xl p-3 border transition-all"
                style="background: var(--surface); border-color: var(--border)">
                <Show when={sortMode() === 'order'}>
                  <div class="flex flex-col items-center rounded-xl p-1 shrink-0" style="background: var(--raised)">
                    <button onClick={() => moveMovie(i(), -1)}
                      class={`transition-colors ${i() === 0 ? 'opacity-20 pointer-events-none' : 'hover:text-white'}`}
                      style="color: var(--muted)">
                      <Icon name="keyboard_arrow_up" class="text-lg" />
                    </button>
                    <span class="label-mono" style="font-size: 9px; color: var(--p)">{i() + 1}</span>
                    <button onClick={() => moveMovie(i(), 1)}
                      class={`transition-colors ${i() === currentMovies().length - 1 ? 'opacity-20 pointer-events-none' : 'hover:text-white'}`}
                      style="color: var(--muted)">
                      <Icon name="keyboard_arrow_down" class="text-lg" />
                    </button>
                  </div>
                </Show>
                <div class="flex-1 flex items-center gap-3 cursor-pointer min-w-0" onClick={() => props.openMovie(m.id)}>
                  <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} class="w-11 h-16 rounded-xl object-cover shadow-md shrink-0" />
                  <div class="min-w-0">
                    <p class="font-bold text-sm text-white truncate">{m.title || m.name}</p>
                    <p class="label-mono mt-1" style="font-size: 8px; color: var(--muted)">
                      {(m.release_date || m.first_air_date || '').split('-')[0]}
                    </p>
                  </div>
                </div>
                <button onClick={() => removeFromFolder(m)}
                  class="w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0"
                  style="color: var(--muted)">
                  <Icon name="remove_circle" class="text-lg" />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={showAddModal() && currentFolder()}>
        <AddToFolderModal uid={props.uid} folderId={currentFolder()} watchlist={props.watchlist}
          currentMovies={currentMovies} showToast={props.showToast} onClose={() => setShowAddModal(false)} />
      </Show>
    </div>
  );
}
