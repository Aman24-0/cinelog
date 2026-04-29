import { createSignal, createEffect, createMemo, Show, For, onMount, onCleanup } from 'solid-js';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, TMDB_KEY } from '../utils';

export function PersonModal(props) {
  const [person, setPerson] = createSignal(null);
  const [credits, setCredits] = createSignal({ cast: [], crew: [] });
  const [activeTab, setActiveTab] = createSignal('movie');
  const [sortBy, setSortBy] = createSignal('popularity');
  
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');

  createEffect(() => {
    if (props.personId) {
      fetch(`https://api.themoviedb.org/3/person/${props.personId}?api_key=${TMDB_KEY}&append_to_response=combined_credits`)
        .then(r => r.json())
        .then(data => {
          setPerson(data);
          setCredits(data.combined_credits || { cast: [], crew: [] });
        });
    }
  });

  const displayList = createMemo(() => {
    if (!person()) return [];
    const isDirector = person().known_for_department === 'Directing';
    let rawList = isDirector ? credits().crew.filter(c => c.job === 'Director') : credits().cast;
    let filtered = rawList.filter(item => item.media_type === activeTab());
    
    const unique = []; const seen = new Set();
    filtered.forEach(item => { if(!seen.has(item.id)) { seen.add(item.id); unique.push(item); } });

    return unique.sort((a, b) => {
        if (sortBy() === 'popularity') return b.popularity - a.popularity;
        const dateA = new Date(a.release_date || a.first_air_date || '1900-01-01').getTime();
        const dateB = new Date(b.release_date || b.first_air_date || '1900-01-01').getTime();
        if (sortBy() === 'release_desc') return dateB - dateA;
        return dateA - dateB;
    });
  });

  // 🌟 Fix #1: Stop Overwriting if already in Vault
  const quickAddToVault = async (item, e) => {
    e.stopPropagation();
    const isAlreadySaved = props.watchlist.some(w => String(w.id) === String(item.id));
    if (isAlreadySaved) {
        props.showToast("Already in Vault! 🛡️");
        return;
    }

    props.showToast("Adding to Vault...");
    try {
        const tmdbData = await (await fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.id}?api_key=${TMDB_KEY}&append_to_response=credits`)).json();
        const castNames = tmdbData.credits?.cast?.slice(0, 5).map(c => c.name) || [];
        const director = tmdbData.credits?.crew?.find(c => c.job === 'Director')?.name || '';
        
        const movieData = {
            id: String(item.id),
            title: item.title || item.name,
            media_type: item.media_type,
            poster_path: item.poster_path,
            backdrop_path: item.backdrop_path,
            release_date: item.release_date || item.first_air_date || '',
            status: 'Planned',
            addedAt: new Date(),
            castList: [...castNames, director].filter(Boolean)
        };
        await setDoc(doc(db, 'users', props.uid, 'watchlist', String(item.id)), movieData);
        props.showToast("Added Successfully! 🍿");
    } catch (err) { props.showToast("Error adding to vault."); }
  };

  return (
    <div class="fixed inset-0 z-[9999999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={props.onClose}>
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none"></div>
      <div class="w-full max-w-3xl bg-[#08090b] sm:rounded-[2rem] rounded-t-[2rem] border border-white/10 relative h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-pop-in" onClick={e=>e.stopPropagation()}>
        <button onClick={props.onClose} class="absolute top-4 right-4 z-50 bg-black/50 p-2.5 rounded-full hover:bg-black border border-white/10 active:scale-95 transition-all"><Icon name="close" class="text-sm text-white"/></button>

        <Show when={person()}>
          <div class="flex gap-4 p-6 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
              <img src={person().profile_path ? `https://image.tmdb.org/t/p/w300${person().profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${person().name}&backgroundColor=171921`} class="w-24 h-36 sm:w-28 sm:h-40 object-cover rounded-xl shadow-lg border border-white/10 shrink-0" />
              <div class="flex-1 overflow-hidden">
                  <h2 class="text-xl sm:text-2xl font-black text-white truncate">{person().name}</h2>
                  <p class="text-[9px] text-[var(--primary)] font-black uppercase tracking-widest mt-1 mb-2">
                      {person().known_for_department} • {person().birthday || 'Unknown'}
                  </p>
                  <div class="h-20 overflow-y-auto hide-scrollbar text-[11px] text-gray-500 leading-relaxed pr-2">
                      {person().biography || "No biography available."}
                  </div>
              </div>
          </div>

          <div class="flex justify-between items-center p-4 bg-[#0c0e14] border-b border-white/5 shrink-0">
              <div class="flex bg-black/50 p-1 rounded-xl border border-white/5">
                  <button onClick={() => setActiveTab('movie')} class={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab() === 'movie' ? 'bg-[var(--primary)] text-[#0c0e14]' : 'text-gray-500 hover:text-white'}`}>Movies</button>
                  <button onClick={() => setActiveTab('tv')} class={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab() === 'tv' ? 'bg-[var(--primary)] text-[#0c0e14]' : 'text-gray-500 hover:text-white'}`}>TV</button>
              </div>
              <select value={sortBy()} onChange={e => setSortBy(e.target.value)} class="bg-black/50 border border-white/5 rounded-xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 outline-none">
                  <option value="popularity">Popular</option>
                  <option value="release_desc">Newest</option>
                  <option value="release_asc">Oldest</option>
              </select>
          </div>

          <div class="flex-1 overflow-y-auto p-4 hide-scrollbar">
              <div class="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-6">
                  <For each={displayList()}>{(item) => {
                      const isSaved = props.watchlist.some(w => String(w.id) === String(item.id));
                      return (
                          <div class="relative group flex flex-col gap-2" onClick={() => props.openPreview(item)}>
                              <div class="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10 group-hover:border-[var(--primary)]/50 transition-all shadow-lg bg-[#171921]">
                                <img src={item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : 'https://via.placeholder.com/342x513/171921/b1a1ff?text=NA'} class="w-full h-full object-cover" />
                                <Show when={isSaved}>
                                    <div class="absolute top-1.5 right-1.5 w-6 h-6 bg-[var(--primary)] rounded-full flex items-center justify-center text-[#0c0e14] shadow-lg z-10 scale-90"><Icon name="check" class="text-xs" /></div>
                                </Show>
                                <Show when={!isSaved}>
                                    <button onClick={(e) => quickAddToVault(item, e)} class="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center hover:bg-[var(--primary)] hover:text-[#0c0e14] transition-all z-10 text-white scale-90"><Icon name="add" class="text-xs" /></button>
                                </Show>
                              </div>
                              {/* 🌟 Fix #3: Show Title under poster */}
                              <div class="px-0.5">
                                <p class="text-[9px] font-black text-white truncate w-full uppercase tracking-tight">{item.title || item.name}</p>
                                <p class="text-[8px] text-gray-500 font-bold">{(item.release_date || item.first_air_date || '').substring(0,4)}</p>
                              </div>
                          </div>
                      );
                  }}</For>
              </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
