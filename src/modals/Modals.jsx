import { createSignal, createEffect, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, cleanPlatform, TMDB_KEY, getSafeGenres, getSafePlatforms } from '../utils';

// --- SETTINGS MODAL ---
const ThemeBtn = (props) => <button onClick={() => { props.set(props.id); props.onClose(); }} class={`w-full p-4 rounded-xl border ${props.curr===props.id?'border-[var(--primary)] bg-[var(--primary)]/10':'border-white/5 hover:bg-white/5'} flex gap-4 items-center transition-colors`}><div class="w-6 h-6 rounded-full shadow-lg" style={{background: props.hex}}></div><span class="font-bold">{props.name}</span></button>;

export function SettingsModal(props) {
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');
  const themes = [{id:'sage', n:'Sage', h:'#b1a1ff'},{id:'matrix', n:'Matrix', h:'#00ff41'},{id:'netflix', n:'Netflix', h:'#e50914'},{id:'cyberpunk', n:'Cyberpunk', h:'#fce205'},{id:'interstellar', n:'Interstellar', h:'#38bdf8'},{id:'neonhorizon', n:'Neon Horizon', h:'#f472b6'},{id:'vibranium', n:'Vibranium', h:'#7c3aed'}];
  
  return (
    <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[999999]" onClick={props.onClose}>
      <div class="glass-surface w-full max-w-sm rounded-3xl p-6 border border-white/10 animate-pop-in" onClick={e=>e.stopPropagation()}>
        <div class="flex justify-between items-center border-b border-white/5 pb-4 mb-4"><h3 class="font-bold text-lg flex items-center gap-2"><Icon name="palette" class="text-[var(--primary)]"/> Themes</h3><button onClick={props.onClose}><Icon name="close" class="text-gray-500 hover:text-white"/></button></div>
        <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-2 hide-scrollbar"><For each={themes}>{t => <ThemeBtn id={t.id} name={t.n} hex={t.h} curr={props.currentTheme} set={props.setTheme} onClose={props.onClose} />}</For></div>
      </div>
    </div>
  );
}

// --- SEARCH MODAL ---
export function SearchModal(props) {
  const [q, setQ] = createSignal(''); const [results, setResults] = createSignal([]); const [searching, setSearching] = createSignal(false);
  onMount(() => { document.body.style.overflow = 'hidden'; }); onCleanup(() => { document.body.style.overflow = ''; });
  
  createEffect(() => {
    const query = q(); if (query.length < 2) return setResults([]); setSearching(true);
    const t = setTimeout(async () => { try { const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${query}`); const data = await res.json(); setResults(data.results ? data.results.filter(r => r.media_type !== 'person') : []); } catch(e){} setSearching(false); }, 500);
    return () => clearTimeout(t);
  });

  const addMedia = async (m) => {
    if(props.watchlist.some(item => String(item.id) === String(m.id))) return props.showToast("Already in vault!");
    const res = await fetch(`https://api.themoviedb.org/3/${m.media_type}/${m.id}?api_key=${TMDB_KEY}&append_to_response=watch/providers`); const data = await res.json();
    await setDoc(doc(db, 'users', props.uid, 'watchlist', String(m.id)), {
      id: m.id, title: m.title || m.name || '', poster_path: m.poster_path, backdrop_path: m.backdrop_path, media_type: m.media_type, status: 'Planned', addedAt: serverTimestamp(),
      platformsList: [...new Set((data['watch/providers']?.results?.IN?.flatrate || []).map(p => cleanPlatform(p.provider_name)))].filter(Boolean).slice(0,3), genresList: (data.genres || []).map(g => g.name),
      release_date: m.release_date || m.first_air_date || '', region: (data.origin_country?.includes('IN') ? 'Indian' : 'International'), season: 1, episode: 0, totalEps: data.number_of_episodes || 0, runtime: data.runtime || data.episode_run_time?.[0] || 0
    }); props.showToast("Added to Vault!"); props.onClose();
  };

  return (
    <div class="fixed inset-0 bg-black/70 backdrop-blur-md p-4 pt-16 sm:pt-24 z-[999999] flex justify-center items-start animate-fade-in" onClick={props.onClose}>
      <div class="w-full max-w-2xl mx-auto glass-surface rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col max-h-[75vh] border border-white/10 animate-pop-in bg-[#08090b]/95" onClick={e=>e.stopPropagation()}>
        <div class="p-5 border-b border-white/5 flex gap-4 items-center bg-gradient-to-b from-white/5 to-transparent relative">
            <Icon name="search" class="text-[var(--primary)] text-2xl"/>
            <input autofocus value={q()} onInput={e=>setQ(e.target.value)} placeholder="Search movies, series..." class="bg-transparent border-none w-full outline-none text-white text-xl font-medium placeholder-gray-600"/>
            <Show when={q().length > 0}><button onClick={() => setQ('')} class="text-gray-500 hover:text-white active:scale-95"><Icon name="backspace" class="text-sm"/></button></Show>
            <button onClick={props.onClose} class="bg-white/10 p-2 rounded-full hover:bg-white/20 active:scale-95 transition-all ml-2"><Icon name="close" class="text-white text-sm"/></button>
        </div>
        <div class="overflow-y-auto p-3 hide-scrollbar relative">
            <Show when={searching()}>
                <div class="flex flex-col items-center justify-center p-12 gap-4 opacity-50">
                    <Icon name="radar" class="text-[var(--primary)] text-5xl animate-spin"/>
                    <p class="text-[10px] uppercase font-black tracking-widest text-[var(--primary)]">Scanning Database...</p>
                </div>
            </Show>
            <Show when={!searching() && q().length >= 2 && results().length === 0}>
                <div class="text-center p-12 text-gray-500">
                    <Icon name="sentiment_dissatisfied" class="text-5xl mb-3 opacity-30"/>
                    <p class="text-sm font-bold">No results found in this universe.</p>
                </div>
            </Show>
            <div class="space-y-2">
                <For each={results()}>{(r) => (
                    <div onClick={() => addMedia(r)} class="flex gap-4 p-3 glass-surface rounded-[1.5rem] border border-transparent hover:border-[var(--primary)]/30 hover:bg-white/5 transition-all cursor-pointer group shadow-sm">
                        <Show when={r.poster_path} fallback={<div class="w-14 h-20 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 bg-[#171921]"><Icon name="movie" class="text-gray-600"/></div>}>
                            <img src={`https://image.tmdb.org/t/p/w200${r.poster_path}`} class="w-14 h-20 rounded-xl object-cover shadow-md bg-[#171921]" />
                        </Show>
                        <div class="flex flex-col justify-center flex-1 py-1 min-w-0">
                            <p class="font-black text-base text-gray-100 group-hover:text-[var(--primary)] transition-colors line-clamp-1">{r.title || r.name}</p>
                            <div class="flex items-center gap-2 mt-1.5">
                                <span class="text-[8px] bg-white/10 text-gray-300 px-2 py-0.5 rounded font-black uppercase tracking-widest border border-white/5">{r.media_type === 'tv' ? 'Series' : 'Movie'}</span>
                                <span class="text-[10px] text-gray-500 font-bold">{(r.release_date || r.first_air_date || '').split('-')[0]}</span>
                            </div>
                        </div>
                        <div class="self-center pr-2">
                            <button class="w-10 h-10 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center group-hover:bg-[var(--primary)] group-hover:text-[#08090b] transition-all shadow-lg active:scale-95">
                                <Icon name="add" class="text-xl font-black" />
                            </button>
                        </div>
                    </div>
                )}</For>
            </div>
        </div>
      </div>
    </div>
  );
}

// --- INSIGHTS MODAL ---
export function InsightsModal(props) {
  const [showWrapped, setShowWrapped] = createSignal(false);
  onMount(() => { document.body.style.overflow = 'hidden'; }); onCleanup(() => { document.body.style.overflow = ''; });
  
  const stats = createMemo(() => {
    let mins = 0; const genres = {}; const platforms = {}; const comp = props.watchlist().filter(m => m.status === 'Completed');
    comp.forEach(m => { mins += (parseInt(m.runtime)||0) * (m.media_type==='tv' ? (parseInt(m.episode)||1) : 1); getSafeGenres(m).forEach(g => genres[g]=(genres[g]||0)+1); getSafePlatforms(m).forEach(p => platforms[p]=(platforms[p]||0)+1); });
    const topG = Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,5); const topP = Object.entries(platforms).sort((a,b)=>b[1]-a[1]).slice(0,5);
    return { days: Math.floor(mins/1440), hours: Math.floor((mins%1440)/60), total: comp.length, topGenre: topG[0]?.[0] || 'N/A', topG, topP, maxG: topG[0]?.[1]||1, maxP: topP[0]?.[1]||1 };
  });

  return (
    <div class="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[999999] animate-fade-in" onClick={props.onClose}>
      <div class="w-full max-w-lg bg-[#08090b]/95 rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative animate-pop-in overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div class="absolute -top-20 -right-20 w-64 h-64 bg-[var(--primary)]/20 rounded-full blur-[80px] pointer-events-none"></div>
        <div class="flex justify-between items-center mb-8 relative z-10"><h2 class="text-3xl font-headline font-black text-white drop-shadow-md">Insights</h2><button onClick={props.onClose} class="bg-white/5 p-3 rounded-full hover:bg-white/10 active:scale-95 transition-all"><Icon name="close" class="text-white"/></button></div>
        
        {/* Infinity Ring UI */}
        <div class="flex justify-center mb-10 relative z-10">
            <div class="relative w-48 h-48 flex items-center justify-center rounded-full shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-[#0c0e14]">
                <svg class="absolute inset-0 w-full h-full -rotate-90 rounded-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="8" stroke-dasharray="283" stroke-dashoffset="0"></circle>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="var(--primary)" stroke-width="8" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="60" class="drop-shadow-[0_0_10px_var(--primary)]"></circle>
                </svg>
                <div class="text-center">
                    <p class="text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-widest">Watch Time</p>
                    <span class="text-5xl font-black font-headline text-white">{stats().days}<span class="text-sm text-gray-400 ml-1">d</span></span>
                    <div class="text-xl font-bold text-[var(--secondary)] mt-1">{stats().hours}<span class="text-[10px] uppercase text-gray-500 ml-1">hrs</span></div>
                </div>
            </div>
        </div>

        <button onClick={() => setShowWrapped(true)} class="w-full bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14] font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest mb-8 shadow-lg shadow-[var(--primary)]/20 flex items-center justify-center gap-2 active:scale-95 transition-transform relative z-10"><Icon name="auto_awesome"/> Open Wrapped</button>
        
        <div class="glass-surface rounded-[1.5rem] p-6 border border-white/5 relative z-10">
            <h3 class="font-bold mb-5 flex items-center gap-2 text-white"><Icon name="pie_chart" class="text-[var(--primary)]"/> Favorite Vibes</h3>
            <div class="space-y-4">
                <For each={stats().topG}>{([g, c]) => (
                    <div><div class="flex justify-between text-[10px] font-black uppercase mb-1.5 text-gray-400 tracking-widest"><span>{g}</span><span class="text-gray-500">{c} titles</span></div><div class="w-full bg-white/5 h-2 rounded-full overflow-hidden"><div style={{width: `${(c/stats().maxG)*100}%`}} class="h-full bg-[var(--primary)] rounded-full shadow-[0_0_10px_var(--primary)]"></div></div></div>
                )}</For>
            </div>
        </div>
      </div>
      
      <Show when={showWrapped()}>
        <div class="fixed inset-0 bg-black/98 flex items-center justify-center p-4 z-[9999999] animate-pop-in" onClick={() => setShowWrapped(false)}>
          <div class="bg-gradient-to-br from-[var(--primary)] via-[var(--secondary)] to-[#0c0e14] w-full max-w-sm h-[500px] rounded-[3rem] p-10 text-center flex flex-col justify-between shadow-2xl relative overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div class="mt-4 relative z-10">
                <h4 class="text-white/80 font-bold uppercase text-[10px] mb-3 tracking-widest">My Cinelog Wrapped</h4>
                <h2 class="text-4xl font-black font-headline text-white mb-8 leading-tight">I spent <br/><span class="text-[#0c0e14] bg-white px-3 py-1 mt-2 inline-block rounded-lg shadow-lg">{stats().days} Days</span><br/> in another universe.</h2>
                <div class="space-y-4 text-left bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                    <div><p class="text-[9px] uppercase font-bold text-white/50 tracking-widest mb-1">Masterpieces Finished</p><p class="text-2xl font-black text-white">{stats().total} Titles</p></div>
                    <div><p class="text-[9px] uppercase font-bold text-white/50 tracking-widest mb-1">Favorite Vibe</p><p class="text-2xl font-black text-[var(--secondary)]">{stats().topGenre}</p></div>
                </div>
            </div>
            <button onClick={() => setShowWrapped(false)} class="text-white bg-black/30 p-4 rounded-full mx-auto hover:bg-black transition-colors active:scale-95 relative z-10"><Icon name="close" /></button>
          </div>
        </div>
      </Show>
    </div>
  );
}
