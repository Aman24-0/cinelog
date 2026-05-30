import { createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import { doc, setDoc, serverTimestamp, collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, cleanPlatform, TMDB_KEY } from '../utils';
import { PersonModal } from './PersonModal';

export function SearchModal(props) {
  const [q, setQ] = createSignal(props.initialQuery || '');
  const [recentSearches, setRecentSearches] = createSignal([]);
  const [results, setResults] = createSignal([]);
  const [searching, setSearching] = createSignal(false);
  const [personId, setPersonId] = createSignal(null);

  onMount(() => {
    document.body.style.overflow = 'hidden';
    try { setRecentSearches(JSON.parse(localStorage.getItem('cinelog_recent_searches') || '[]')); } catch (e) {}
  });
  onCleanup(() => { document.body.style.overflow = ''; });

  const saveRecentSearch = (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const next = [trimmed, ...recentSearches().filter(x => x.toLowerCase() !== trimmed.toLowerCase())].slice(0, 10);
    setRecentSearches(next);
    localStorage.setItem('cinelog_recent_searches', JSON.stringify(next));
  };

  const editDistance = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return dp[a.length][b.length];
  };

  const didYouMean = () => {
    const query = q().toLowerCase().trim();
    if (query.length < 3 || results().length > 0) return '';
    const candidates = props.watchlist.map(m => m.title || m.name || '').filter(Boolean);
    const ranked = candidates
      .map(title => ({ title, score: editDistance(query, title.toLowerCase()) }))
      .sort((a, b) => a.score - b.score);
    return ranked[0]?.score <= Math.max(2, Math.floor(query.length / 3)) ? ranked[0].title : '';
  };

  createEffect(() => {
    const query = q();
    if (query.length < 2) return setResults([]);
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        // Include movies, tv AND persons
        setResults((data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv' || r.media_type === 'person'));
        saveRecentSearch(query);
      } catch(e) {}
      setSearching(false);
    }, 500);
    return () => clearTimeout(t);
  });

  const detectUniverse = (media, detailData) => {
    const title = (media?.title || media?.name || '').toLowerCase();
    const overview = (detailData?.overview || '').toLowerCase();
    const collectionName = (detailData?.belongs_to_collection?.name || '').toLowerCase();
    const studios = (detailData?.production_companies || []).map(c => (c.name || '').toLowerCase()).join(' ');
    const blob = `${title} ${overview} ${collectionName} ${studios}`;

    if (blob.includes('marvel') || blob.includes('avengers') || blob.includes('iron man') || blob.includes('captain america') || blob.includes('thor') || blob.includes('guardians of the galaxy') || blob.includes('black panther') || blob.includes('doctor strange') || blob.includes('ant-man') || blob.includes('captain marvel') || blob.includes('wanda') || blob.includes('spider-man')) {
      return { key: 'mcu', name: 'Marvel Cinematic Universe' };
    }
    if (blob.includes('dc') || blob.includes('batman') || blob.includes('superman') || blob.includes('wonder woman') || blob.includes('aquaman') || blob.includes('flash') || blob.includes('justice league')) {
      return { key: 'dceu', name: 'DC Universe' };
    }
    return null;
  };

  const addMedia = async (m, e) => {
    if (e) e.stopPropagation();
    if (props.isGuest) {
      props.showToast("Sign in to add to Vault! 🔒");
      if (props.onLogin) props.onLogin();
      return;
    }

    // Duplicate check
    if (props.watchlist.some(item => String(item.id) === String(m.id))) {
      return props.showToast("Already in Vault! 🍿");
    }
    props.showToast("Adding to Vault...");
    try {
      const res = await fetch(`https://api.themoviedb.org/3/${m.media_type}/${m.id}?api_key=${TMDB_KEY}&append_to_response=watch/providers,credits`);
      const data = await res.json();
      const castNames = data.credits?.cast?.slice(0, 5).map(c => c.name) || [];
      const director = data.credits?.crew?.find(c => c.job === 'Director')?.name || '';
      const castList = [...castNames, director].filter(Boolean);

      await setDoc(doc(db, 'users', props.uid, 'watchlist', String(m.id)), {
        id: m.id,
        title: m.title || m.name || '',
        poster_path: m.poster_path,
        backdrop_path: m.backdrop_path,
        media_type: m.media_type,
        status: 'Planned',
        addedAt: serverTimestamp(),
        castList: castList,
        platformsList: [...new Set((data['watch/providers']?.results?.IN?.flatrate || []).map(p => cleanPlatform(p.provider_name)))].filter(Boolean).slice(0, 3),
        genresList: (data.genres || []).map(g => g.name),
        release_date: m.release_date || m.first_air_date || '',
        region: (data.origin_country?.includes('IN') ? 'Indian' : 'International'),
        season: 1, episode: 0,
        totalEps: data.number_of_episodes || 0,
        runtime: data.runtime || data.episode_run_time?.[0] || 0
      });

      if (m.media_type === 'movie' && data?.belongs_to_collection?.id) {
        const universe = detectUniverse(m, data);
        const franchisesRef = collection(db, 'users', props.uid, 'franchises');
        const frSnap = await getDocs(franchisesRef);
        let folder = null;
        if (universe?.key) {
          folder = frSnap.docs.find(d => (d.data().universeKey || null) === universe.key)
            || frSnap.docs.find(d => (d.data().name || '').toLowerCase() === universe.name.toLowerCase());
        }
        if (!folder) folder = frSnap.docs.find(d => (d.data().tmdbCollectionId || null) === data.belongs_to_collection.id);
        if (!folder) {
          const byName = frSnap.docs.find(d => (d.data().name || '').toLowerCase() === (data.belongs_to_collection.name || '').toLowerCase());
          folder = byName;
        }
        let folderId = folder?.id;
        if (!folderId) {
          const created = await addDoc(franchisesRef, {
            name: universe?.name || data.belongs_to_collection.name,
            parentId: null,
            tmdbCollectionId: data.belongs_to_collection.id,
            universeKey: universe?.key || null,
            createdAt: serverTimestamp()
          });
          folderId = created.id;
        } else if (universe?.key) {
          await setDoc(doc(db, 'users', props.uid, 'franchises', folderId), { universeKey: universe.key, name: universe.name }, { merge: true });
        }

        const collRes = await fetch(`https://api.themoviedb.org/3/collection/${data.belongs_to_collection.id}?api_key=${TMDB_KEY}`);
        const coll = await collRes.json();
        const ordered = (coll.parts || []).slice().sort((a, b) => (new Date(a.release_date || 0).getTime() || 0) - (new Date(b.release_date || 0).getTime() || 0));
        const watchSnap = await getDocs(collection(db, 'users', props.uid, 'watchlist'));
        const existing = new Set(watchSnap.docs.map(d => String(d.id)));

        for (let i = 0; i < ordered.length; i++) {
          const part = ordered[i];
          const partRef = doc(db, 'users', props.uid, 'watchlist', String(part.id));
          const basePayload = {
            id: part.id,
            title: part.title || '',
            poster_path: part.poster_path || null,
            backdrop_path: part.backdrop_path || null,
            media_type: 'movie',
            status: 'Planned',
            addedAt: serverTimestamp(),
            release_date: part.release_date || '',
            region: 'International',
            season: 1, episode: 0,
            totalEps: 0,
            runtime: 0,
            franchises: { [folderId]: i + 1 }
          };
          if (existing.has(String(part.id))) {
            await setDoc(partRef, { franchises: { [folderId]: i + 1 } }, { merge: true });
          } else {
            await setDoc(partRef, basePayload, { merge: true });
          }
        }
      }
      props.showToast("Added to Vault! 🍿");
      props.onClose();
    } catch(err) {
      props.showToast("Error adding to vault.");
    }
  };

  const handleOpenPreview = (item) => {
    setPersonId(null);
    setTimeout(() => props.openPreview(item, 'fromPerson'), 50);
  };

  return (
    <div class="fixed inset-0 bg-black/70 backdrop-blur-md p-4 pt-16 sm:pt-24 z-[999999] flex justify-center items-center animate-fade-in" onClick={props.onClose}>
      <div class="w-full max-w-2xl mx-auto glass-surface rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col max-h-[75vh] border border-white/10 animate-pop-in bg-[#08090b]/95" onClick={e => e.stopPropagation()}>

        {/* Search Input */}
        <div class="p-5 lg:p-8 border-b border-white/5 flex gap-4 items-center bg-gradient-to-b from-white/5 to-transparent">
          <Icon name="search" class="text-[var(--p)] text-2xl"/>
          <input
            autofocus
            value={q()}
            onInput={e => setQ(e.target.value)}
            placeholder="Search movies, series, actors..."
            class="bg-transparent border-none w-full outline-none text-white text-xl font-medium placeholder-gray-600"
          />
          <Show when={q().length > 0}>
            <button onClick={() => setQ('')} class="text-gray-500 hover:text-white active:scale-95">
              <Icon name="backspace" class="text-sm"/>
            </button>
          </Show>
          <button onClick={props.onClose} class="bg-white/10 p-2 rounded-full hover:bg-white/20 active:scale-95 transition-all ml-2">
            <Icon name="close" class="text-white text-sm"/>
          </button>
        </div>


        <Show when={q().length === 0 && recentSearches().length > 0}>
          <div class="px-5 pb-4 flex flex-wrap gap-2 border-b border-white/5">
            <For each={recentSearches()}>{(term) => (
              <button onClick={() => setQ(term)} class="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border" style="background: var(--p-dim); border-color: var(--p); color: var(--p)">
                {term}
              </button>
            )}</For>
          </div>
        </Show>

        {/* Results */}
        <div class="overflow-y-auto p-3 hide-scrollbar relative">
          <Show when={searching()}>
            <div class="flex flex-col items-center justify-center p-12 gap-4 opacity-50">
              <Icon name="radar" class="text-[var(--p)] text-5xl animate-spin"/>
              <p class="text-[10px] uppercase font-black tracking-widest text-[var(--p)]">Scanning Database...</p>
            </div>
          </Show>
          <Show when={!searching() && q().length >= 2 && results().length === 0}>
            <div class="text-center p-12 text-gray-500">
              <Icon name="sentiment_dissatisfied" class="text-5xl mb-3 opacity-30"/>
              <p class="text-sm font-bold">No results found in this universe.</p>
              <Show when={didYouMean()}>
                <button onClick={() => setQ(didYouMean())} class="mt-4 text-[10px] font-black uppercase tracking-widest" style="color: var(--p)">Did you mean {didYouMean()}?</button>
              </Show>
            </div>
          </Show>

          <div class="space-y-2">
            <For each={results()}>{(item) => {
              // --- PERSON RESULT ---
              if (item.media_type === 'person') {
                return (
                  <div
                    onClick={() => setPersonId(item.id)}
                    class="flex items-center gap-4 p-3 glass-surface rounded-[1.5rem] border border-transparent hover:border-[var(--p)]/30 hover:bg-white/5 transition-all cursor-pointer group shadow-sm"
                  >
                    <img
                      src={item.profile_path
                        ? `https://image.tmdb.org/t/p/w92${item.profile_path}`
                        : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.name)}&backgroundColor=171921`}
                      class="w-12 h-12 rounded-full object-cover border border-white/10 group-hover:border-[var(--p)] shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <p class="font-black text-base text-gray-100 group-hover:text-[var(--p)] transition-colors line-clamp-1">{item.name}</p>
                      <p class="text-[9px] text-[var(--p)] uppercase font-black tracking-widest mt-0.5">
                        {item.known_for_department === 'Directing' ? '[DIRECTOR]' : '[ACTOR]'}
                      </p>
                    </div>
                    <Icon name="chevron_right" class="text-gray-500 group-hover:text-[var(--p)] shrink-0"/>
                  </div>
                );
              }

              // --- MOVIE / TV RESULT ---
              const isSaved = props.watchlist.some(w => String(w.id) === String(item.id));
              return (
                <div
                  onClick={() => !isSaved && props.openPreview(item)}
                  class={`flex gap-4 p-3 glass-surface rounded-[1.5rem] border border-transparent hover:border-[var(--p)]/30 hover:bg-white/5 transition-all ${isSaved ? 'opacity-60' : 'cursor-pointer'} group shadow-sm`}
                >
                  <Show when={item.poster_path} fallback={
                    <div class="w-14 h-20 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 bg-[#171921] shrink-0">
                      <Icon name="movie" class="text-gray-600"/>
                    </div>
                  }>
                    <img src={`https://image.tmdb.org/t/p/w200${item.poster_path}`} class="w-14 h-20 rounded-xl object-cover shadow-md bg-[#171921] shrink-0"/>
                  </Show>
                  <div class="flex flex-col justify-center flex-1 py-1 min-w-0">
                    <p class="font-black text-base text-gray-100 group-hover:text-[var(--p)] transition-colors line-clamp-1">{item.title || item.name}</p>
                    <div class="flex items-center gap-2 mt-1.5">
                      <span class="text-[8px] bg-white/10 text-gray-300 px-2 py-0.5 rounded font-black uppercase tracking-widest border border-white/5">
                        {item.media_type === 'tv' ? 'Series' : 'Movie'}
                      </span>
                      <span class="text-[10px] text-gray-500 font-bold">{(item.release_date || item.first_air_date || '').split('-')[0]}</span>
                    </div>
                  </div>
                  <div class="self-center pr-2 shrink-0">
                    <button
                      disabled={isSaved}
                      onClick={(e) => addMedia(item, e)}
                      class={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                        isSaved
                          ? 'bg-[var(--p)] text-[#08090b]'
                          : 'bg-[var(--p)]/10 text-[var(--p)] hover:bg-[var(--p)] hover:text-[#08090b]'
                      }`}
                    >
                      <Icon name={isSaved ? "check" : "add"} class="text-xl font-black"/>
                    </button>
                  </div>
                </div>
              );
            }}</For>
          </div>
        </div>
      </div>

      {/* PersonModal */}
      <Show when={personId()}>
        <PersonModal
          personId={personId()}
          uid={props.uid}
          watchlist={props.watchlist}
          showToast={props.showToast}
          onClose={() => setPersonId(null)}
          openPreview={handleOpenPreview}
          isGuest={props.isGuest}
          onLogin={props.onLogin}
        />
      </Show>
    </div>
  );
}
