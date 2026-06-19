import { createSignal, createEffect, createMemo, Show, For, onMount, onCleanup } from 'solid-js';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon } from '../utils';
import { trpc } from '../lib/trpc';

export function PersonModal(props) {
  const [person, setPerson] = createSignal(null);
  const [credits, setCredits] = createSignal({ cast: [], crew: [] });
  const [activeTab, setActiveTab] = createSignal('movie');
  const [sortBy, setSortBy] = createSignal('popularity');

  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');

  createEffect(() => {
    if (props.personId) {
      trpc.tmdb.details.query({ mediaType: 'person', id: Number(props.personId), appendToResponse: 'combined_credits' })
        .then(data => {
          setPerson(data);
          setCredits(data.combined_credits || { cast: [], crew: [] });
        });
    }
  });

  const displayList = createMemo(() => {
    if (!person()) return [];
    const isDirector = person().known_for_department === 'Directing';
    let rawList = isDirector
      ? credits().crew.filter(c => c.job === 'Director')
      : credits().cast;
    let filtered = rawList.filter(item => item.media_type === activeTab());

    const unique = []; const seen = new Set();
    filtered.forEach(item => {
      if (!seen.has(item.id)) { seen.add(item.id); unique.push(item); }
    });

    return unique.sort((a, b) => {
      if (sortBy() === 'popularity') return b.popularity - a.popularity;
      const dateA = new Date(a.release_date || a.first_air_date || '1900-01-01').getTime();
      const dateB = new Date(b.release_date || b.first_air_date || '1900-01-01').getTime();
      if (sortBy() === 'release_desc') return dateB - dateA;
      return dateA - dateB;
    });
  });

  const quickAddToVault = async (item, e) => {
    e.stopPropagation();
    if (props.isGuest) {
      props.showToast("Sign in to add to Vault! 🔒");
      if (props.onLogin) props.onLogin();
      return;
    }

    if (props.watchlist.some(w => String(w.id) === String(item.id))) {
      return props.showToast("Already in Vault! 🍿");
    }
    props.showToast("Adding to Vault...");
    try {
      const tmdbData = await trpc.tmdb.details.query({ mediaType: item.media_type, id: Number(item.id), appendToResponse: 'credits' });
      const castNames = tmdbData.credits?.cast?.slice(0, 5).map(c => c.name) || [];
      const director = tmdbData.credits?.crew?.find(c => c.job === 'Director')?.name || '';
      const castList = [...castNames, director].filter(Boolean);

      await setDoc(doc(db, 'users', props.uid, 'watchlist', String(item.id)), {
        id: String(item.id),
        title: item.title || item.name,
        media_type: item.media_type,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        release_date: item.release_date || item.first_air_date || '',
        status: 'Planned',
        addedAt: new Date(),
        castList: castList
      });
      props.showToast("Added Successfully! 🍿");
    } catch (err) {
      props.showToast("Error adding to vault.");
    }
  };

  return (
    <div
      class="fixed inset-0 z-[9999999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={props.onClose}
    >
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none"></div>
      <div
        class="w-full max-w-3xl lg:max-w-[800px] bg-[#08090b] sm:rounded-[2.5rem] rounded-t-[2.5rem] border border-white/10 relative h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-pop-in"        
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={props.onClose}
          class="absolute top-4 right-4 z-50 bg-black/50 p-2.5 rounded-full hover:bg-black border border-white/10 active:scale-95 transition-all"
        >
          <Icon name="close" class="text-sm text-white"/>
        </button>

        <Show when={person()}>
          {/* Person Header */}
          <div class="flex gap-4 p-6 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0">
            <img
              src={person().profile_path
                ? `https://image.tmdb.org/t/p/w300${person().profile_path}`
                : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(person().name)}&backgroundColor=171921`}
              class="w-28 h-40 object-cover rounded-xl shadow-lg border border-white/10 shrink-0"
            />
            <div class="flex-1 overflow-hidden">
              <h2 class="text-2xl font-black text-white truncate">{person().name}</h2>
              <p class="text-[10px] text-[var(--primary)] font-bold uppercase tracking-widest mt-1 mb-2">
                {person().known_for_department} • {person().birthday || 'Unknown'}
                {person().deathday ? ` → ${person().deathday}` : ''}
              </p>
              <div class="h-20 overflow-y-auto hide-scrollbar text-xs text-gray-400 leading-relaxed pr-2">
                {person().biography || "No biography available."}
              </div>
            </div>
          </div>

          {/* Tab & Sort Controls */}
          <div class="flex flex-wrap justify-between items-center p-4 border-b gap-3 shrink-0" style="background: var(--deep); border-color: var(--border)">
            <div class="flex p-1 rounded-xl" style="background: var(--raised); border: 1px solid var(--border-active)">
              <button
                onClick={() => setActiveTab('movie')}
                class="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                style={activeTab() === 'movie' ? 'background: var(--p); color: #05060a; box-shadow: 0 0 12px var(--p-glow)' : 'color: var(--muted)'}
              >Movies</button>
              <button
                onClick={() => setActiveTab('tv')}
                class="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                style={activeTab() === 'tv' ? 'background: var(--p); color: #05060a; box-shadow: 0 0 12px var(--p-glow)' : 'color: var(--muted)'}
              >TV Shows</button>
            </div>
            <div class="flex items-center gap-2 bg-black/50 border border-white/5 rounded-xl px-3 py-1.5">
              <Icon name="sort" class="text-gray-500 text-[14px]"/>
              <select
                value={sortBy()}
                onChange={e => setSortBy(e.target.value)}
                class="bg-transparent text-[10px] font-black uppercase tracking-widest text-white outline-none cursor-pointer"
              >
                <option value="popularity" class="bg-[#0c0e14]">Most Popular</option>
                <option value="release_desc" class="bg-[#0c0e14]">Release (New → Old)</option>
                <option value="release_asc" class="bg-[#0c0e14]">Release (Old → New)</option>
              </select>
            </div>
          </div>

          {/* Filmography Grid */}
          <div class="flex-1 overflow-y-auto p-4 hide-scrollbar">
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-4">
              <For each={displayList()}>{(item) => {
                const isSaved = props.watchlist.some(w => String(w.id) === String(item.id));
                return (
                  <div
                    class="relative group cursor-pointer animate-fade-in"
                    onClick={() => props.openPreview(item, 'fromPerson')}
                  >
                    <Show when={item.poster_path} fallback={
                      <div class="w-full aspect-[2/3] rounded-xl shadow-lg border border-white/10 group-hover:border-[var(--primary)] transition-all bg-[#171921] flex items-center justify-center text-center p-2">
                        <span class="text-[10px] font-black uppercase tracking-widest text-gray-500">No Poster</span>
                      </div>
                    }>
                      <img
                        src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                        class="w-full aspect-[2/3] object-cover rounded-xl shadow-lg border border-white/10 group-hover:border-[var(--primary)] transition-all"
                        loading="lazy"
                      />
                    </Show>
                    {/* Name — always visible */}
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent rounded-xl flex flex-col justify-end p-2 pointer-events-none">
                      <p class="text-[9px] font-black text-white truncate leading-tight">{item.title || item.name}</p>
                      <p class="text-[8px] text-[var(--primary)] font-bold">{(item.release_date || item.first_air_date || '').substring(0, 4)}</p>
                    </div>
                    {/* Add / Saved Button */}
                    <Show when={!isSaved}>
                      <button
                        onClick={(e) => quickAddToVault(item, e)}
                        class="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center hover:bg-[var(--primary)] hover:text-[#0c0e14] hover:border-[var(--primary)] transition-all active:scale-95 z-10 text-white shadow-lg"
                      >
                        <Icon name="add" class="text-sm"/>
                      </button>
                    </Show>
                    <Show when={isSaved}>
                      <div class="absolute top-2 right-2 w-8 h-8 bg-[var(--primary)] rounded-full flex items-center justify-center text-[#0c0e14] shadow-lg z-10">
                        <Icon name="check" class="text-sm"/>
                      </div>
                    </Show>
                  </div>
                );
              }}</For>
            </div>
            <Show when={displayList().length === 0}>
              <div class="text-center p-10 text-gray-500 font-bold text-sm">No items found.</div>
            </Show>
          </div>
        </Show>

        <Show when={!person()}>
          <div class="flex-1 flex items-center justify-center">
            <Icon name="radar" class="text-[var(--primary)] text-5xl animate-spin opacity-50"/>
          </div>
        </Show>
      </div>
    </div>
  );
}
