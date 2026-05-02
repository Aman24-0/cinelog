import { createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, cleanPlatform, TMDB_KEY, formatRuntime, SafeInfoRow } from '../utils';

function UpcomingDetailsModal(props) {
  const [details, setDetails] = createSignal(props.movie);
  const [trailerKey, setTrailerKey] = createSignal(null); const [playTrailer, setPlayTrailer] = createSignal(false);
  const [ottPlatform, setOttPlatform] = createSignal('');

  onMount(() => { document.body.style.overflow = 'hidden'; }); onCleanup(() => { document.body.style.overflow = ''; });
  createEffect(() => {
      const mediaType = props.movie.media_type || 'movie';
      fetch(`https://api.themoviedb.org/3/${mediaType}/${props.movie.id}?api_key=${TMDB_KEY}&append_to_response=videos,credits,watch/providers`).then(r=>r.json()).then(d=>{
          setDetails(d); const vids = d.videos ? d.videos.results : null;
          if(vids){ let t = vids.find(x=>x.site==='YouTube' && (x.type==='Trailer' || x.type==='Teaser')) || vids.find(x=>x.site==='YouTube'); if(t) setTrailerKey(t.key); }
          const inProviders = d['watch/providers']?.results?.IN; let foundProviders = [];
          if(inProviders) { const providers = [...(inProviders.flatrate || []), ...(inProviders.free || []), ...(inProviders.ads || []), ...(inProviders.buy || [])]; foundProviders = [...new Set(providers.map(p => cleanPlatform(p.provider_name)))].filter(Boolean); }
          if (foundProviders.length === 0 && d.networks) { foundProviders = [...new Set(d.networks.map(n => cleanPlatform(n.name)))].filter(Boolean); }
          if(foundProviders.length > 0) setOttPlatform(foundProviders.join(', '));
      }).catch(()=>{});
  });

  const runtimeVal = () => details().runtime || details().episode_run_time?.[0] || 0;

  return (
      <div class="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[999999] animate-fade-in" onClick={props.onClose}>
          <div class="w-full max-w-xl bg-[#0c0e14] rounded-3xl overflow-hidden border border-white/10 relative max-h-[90vh] shadow-2xl animate-pop-in flex flex-col" onClick={e=>e.stopPropagation()}>
              <button onClick={props.onClose} class="absolute top-4 right-4 z-[100] bg-black/50 backdrop-blur-md border border-white/10 p-2.5 rounded-full hover:bg-black/80 active:scale-95 transition-all"><Icon name="close" class="text-sm text-white"/></button>
              <div class="overflow-y-auto hide-scrollbar w-full">
                  <div class="relative h-48 md:h-64 bg-black">
                      <Show when={!playTrailer()} fallback={<iframe class="w-full h-full absolute inset-0 z-10" src={`https://www.youtube.com/embed/${trailerKey()}?autoplay=1&rel=0`} frameborder="0" allowfullscreen></iframe>}>
                          <Show when={details().backdrop_path} fallback={<div class="w-full h-full flex items-center justify-center text-gray-700 bg-[#171921]"><Icon name="movie" class="text-6xl"/></div>}><img src={`https://image.tmdb.org/t/p/original${details().backdrop_path}`} class="w-full h-full object-cover opacity-40" /></Show>
                          <div class="absolute inset-0 bg-gradient-to-t from-[#0c0e14] to-transparent pointer-events-none" />
                          <Show when={trailerKey()} fallback={<div class="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-gray-400 border border-white/5">No Video Available</div>}>
                              <button onClick={() => setPlayTrailer(true)} class="absolute inset-0 flex items-center justify-center z-10 group"><div class="w-14 h-14 bg-[var(--primary)]/30 backdrop-blur-md rounded-full flex items-center justify-center border border-[var(--primary)]/50 group-hover:scale-110 transition-transform shadow-lg"><Icon name="play_arrow" fill class="text-white text-3xl"/></div></button>
                          </Show>
                      </Show>
                  </div>
                  <div class="p-6 md:px-8 pb-28 -mt-16 relative z-10">
                      <h2 class="text-3xl font-black drop-shadow-md mb-2">{details().title || details().name}</h2>
                      <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6">{details().release_date || details().first_air_date} • {props.movie.media_type === 'tv' ? 'SERIES' : 'MOVIE'}<Show when={runtimeVal() > 0}> • {formatRuntime(runtimeVal())}</Show></p>
                      <p class="text-gray-400 text-sm mb-6 leading-relaxed">{details().overview || 'No overview available.'}</p>
                      <div class="glass-surface p-5 rounded-2xl border border-white/5 space-y-3 mb-6">
                          <SafeInfoRow icon="format_list_bulleted" label="Genre" value={<span class="text-xs text-gray-300">{(details().genres||[]).map(g=>g.name).join(', ')||'N/A'}</span>} />
                          <SafeInfoRow icon="language" label="Language" value={<span class="text-xs text-gray-300">{(details().spoken_languages?.[0]?.english_name) || (details().original_language ? details().original_language.toUpperCase() : 'N/A')}</span>} />
                          <Show when={ottPlatform()}><SafeInfoRow icon="connected_tv" label="Platform" value={<span class="text-xs font-bold text-[var(--secondary)]">{ottPlatform()}</span>} /></Show>
                      </div>
                      <Show when={details().credits || details().created_by}>
                        <div class="mb-8"><h3 class="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-3 px-1">Cast & Crew</h3><div class="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
                                <Show when={details().credits?.crew?.find(c => c.job === 'Director') || details().created_by?.[0]}>{(dir) => { const d = dir(); return (
                                        <div class="flex flex-col items-center min-w-[70px] shrink-0"><img src={d.profile_path ? `https://image.tmdb.org/t/p/w200${d.profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${d.name}&backgroundColor=171921`} class="w-12 h-12 rounded-full object-cover border border-[var(--primary)] mb-2 bg-[#171921]" /><p class="text-[9px] font-bold text-center text-white truncate w-full">{d.name}</p><p class="text-[8px] text-[var(--primary)] font-bold text-center uppercase tracking-widest mt-0.5">{details().created_by ? 'Creator' : 'Director'}</p></div>
                                )}}</Show>
                                <For each={details().credits?.cast?.slice(0, 5)}>{(c) => (<div class="flex flex-col items-center min-w-[70px] shrink-0"><img src={c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${c.name}&backgroundColor=171921`} class="w-12 h-12 rounded-full object-cover border border-white/10 mb-2 bg-[#171921]" /><p class="text-[9px] font-bold text-center text-white truncate w-full">{c.name}</p><p class="text-[8px] text-gray-500 text-center uppercase truncate w-full mt-0.5">{c.character}</p></div>)}</For>
                            </div></div>
                      </Show>
                      <button onClick={props.onAdd} class="w-full bg-[var(--primary)] text-[#0c0e14] font-bold py-4 rounded-xl text-sm uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-[var(--primary)]/20"><Icon name="add_circle" fill /> Add to Vault</button>
                  </div>
              </div>
          </div>
      </div>
  );
}

export function UpcomingView(props) {
  const [activeTab, setActiveTab] = createSignal('Indian');
  const [mediaType, setMediaType] = createSignal('movie'); 
  const [lang, setLang] = createSignal('all');
  const [selectedDate, setSelectedDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [movies, setMovies] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [previewMovie, setPreviewMovie] = createSignal(null);

  createEffect(() => {
    setLoading(true);
    const dateObj = new Date(selectedDate());
    const startDate = dateObj.toISOString().split('T')[0];
    dateObj.setDate(dateObj.getDate() + 30); 
    const endDate = dateObj.toISOString().split('T')[0];
    
    let mUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&primary_release_date.gte=${startDate}&primary_release_date.lte=${endDate}&sort_by=popularity.desc`;
    let tUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&air_date.gte=${startDate}&air_date.lte=${endDate}&sort_by=popularity.desc&without_genres=10764,10767`;
    
    if (activeTab() === 'Indian') {
        mUrl += '&with_origin_country=IN'; tUrl += '&with_origin_country=IN';
        if (lang() !== 'all') { mUrl += `&with_original_language=${lang()}`; tUrl += `&with_original_language=${lang()}`; }
    }
    
    Promise.all([
        fetch(mUrl + '&page=1').then(r=>r.json()), fetch(mUrl + '&page=2').then(r=>r.json()),
        fetch(tUrl + '&page=1').then(r=>r.json()), fetch(tUrl + '&page=2').then(r=>r.json())
    ]).then(async ([m1, m2, t1, t2]) => { 
        let combinedMovies = [...(m1.results||[]), ...(m2.results||[])].map(m => ({...m, media_type: 'movie', calc_date: m.release_date}));
        let tvBaseList = [...(t1.results||[]), ...(t2.results||[])];
        
        const tvDetailsPromises = tvBaseList.slice(0, 25).map(t => fetch(`https://api.themoviedb.org/3/tv/${t.id}?api_key=${TMDB_KEY}`).then(r=>r.json()).catch(()=>null));
        const tvDetailsData = await Promise.all(tvDetailsPromises);
        
        let combinedTv = tvDetailsData.filter(Boolean).map(t => {
            let nextEp = t.next_episode_to_air;
            let d = nextEp ? nextEp.air_date : (t.first_air_date || startDate);
            let isReturning = !!nextEp;
            let epTag = nextEp ? `S${nextEp.season_number} E${nextEp.episode_number}` : 'New Drop';
            return {...t, media_type: 'tv', title: t.name, release_date: t.first_air_date, calc_date: d, isReturning, epTag};
        });

        const vaultIds = new Set(props.watchlist().map(w => String(w.id)));
        combinedTv = combinedTv.filter(t => !t.isReturning || vaultIds.has(String(t.id)));

        if (activeTab() === 'International') {
            const isIndian = (item) => (item.origin_country || []).includes('IN') || ['hi', 'te', 'ta', 'ml', 'bn'].includes(item.original_language);
            combinedMovies = combinedMovies.filter(m => !isIndian(m));
            combinedTv = combinedTv.filter(t => !isIndian(t));
        }

        let resList = [...combinedMovies, ...combinedTv].filter(item => item.calc_date && item.poster_path);
        resList.sort((a,b) => new Date(a.calc_date) - new Date(b.calc_date));
        
        const unique = []; const seen = new Set();
        for(const item of resList) { if(!seen.has(item.id)) { seen.add(item.id); unique.push(item); } }
        setMovies(unique); setLoading(false); 
    }).catch(()=>setLoading(false));
  });

  const handleAdd = async (m) => {
    if(props.watchlist().some(item => String(item.id) === String(m.id))) return props.showToast("Already in vault!");
    const endpoint = m.media_type === 'tv' ? 'tv' : 'movie';
    const detailRes = await fetch(`https://api.themoviedb.org/3/${endpoint}/${m.id}?api_key=${TMDB_KEY}`); const fullData = await detailRes.json();
    await setDoc(doc(db, 'users', props.uid, 'watchlist', String(m.id)), {
      id: m.id, title: m.title || m.name, poster_path: m.poster_path, backdrop_path: m.backdrop_path, media_type: m.media_type, status: 'Planned', addedAt: serverTimestamp(),
      release_date: m.calc_date || '', region: activeTab() === 'Indian' ? 'Indian' : 'International', season: 1, episode: 0, totalEps: fullData.number_of_episodes || 0, runtime: fullData.runtime || fullData.episode_run_time?.[0] || 0
    }); props.showToast("Added to Vault"); setPreviewMovie(null);
  };

  return (
    <div class="pb-10 animate-fade-in">
      <h2 class="text-3xl font-headline font-black drop-shadow-md mb-6">Upcoming</h2>
      <div class="flex gap-2 glass-surface p-1.5 rounded-2xl mb-4 border border-white/5 shadow-lg"><button onClick={()=>{setActiveTab('Indian'); setLang('all');}} class={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab()==='Indian'?'bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14] shadow-md':'text-gray-400 hover:text-white'}`}>Indian</button><button onClick={()=>{setActiveTab('International'); setLang('all');}} class={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab()==='International'?'bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14] shadow-md':'text-gray-400 hover:text-white'}`}>International</button></div>
      <div class="flex gap-2 glass-surface p-1.5 rounded-2xl mb-4 border border-white/5 shadow-lg"><button onClick={()=>setMediaType('movie')} class={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${mediaType()==='movie'?'bg-[var(--primary)] text-[#0c0e14] shadow-md':'text-gray-400 hover:text-white'}`}>Movies</button><button onClick={()=>setMediaType('tv')} class={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${mediaType()==='tv'?'bg-[var(--primary)] text-[#0c0e14] shadow-md':'text-gray-400 hover:text-white'}`}>Series</button></div>

      <Show when={activeTab() === 'Indian'}>
        <div class="flex gap-2 overflow-x-auto hide-scrollbar mb-6 glass-surface p-2 rounded-2xl border border-white/5 shadow-inner">
            <For each={['all', 'hi', 'te', 'ta', 'ml']}>{(l) => (<button onClick={()=>setLang(l)} class={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${lang()===l?'bg-[var(--primary)]/20 text-[var(--primary)]':'text-gray-400 hover:text-white'}`}>{l === 'all' ? 'All' : l.toUpperCase()}</button>)}</For>
        </div>
      </Show>

      <div class="flex justify-center mb-8">
          <div class="glass-surface p-2 pr-6 rounded-[2rem] flex items-center gap-4 border border-white/10 focus-within:border-[var(--primary)]/50 transition-colors shadow-xl relative overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/10 to-transparent pointer-events-none"></div>
              <div class="bg-[var(--primary)] w-12 h-12 rounded-full flex items-center justify-center shadow-[0_0_15px_var(--primary)] relative z-10"><Icon name="calendar_month" class="text-[#0c0e14] text-xl"/></div>
              <div class="flex flex-col relative z-10">
                  <span class="text-[9px] uppercase font-black text-gray-400 tracking-widest mb-0.5">Scan Radar From</span>
                  <input type="date" value={selectedDate()} onInput={e => setSelectedDate(e.target.value)} class="bg-transparent border-none outline-none text-white font-black text-sm [color-scheme:dark] p-0 m-0 w-32" />
              </div>
          </div>
      </div>

      <Show when={loading()} fallback={
        <Show when={movies().filter(m => m.media_type === mediaType()).length > 0} fallback={<div class="text-center p-12 glass-surface rounded-[2rem] text-gray-500 text-sm font-bold border border-white/5 flex flex-col items-center gap-3"><Icon name="event_busy" class="text-4xl opacity-50"/> No releases found.</div>}>
          <div class="space-y-6 relative before:absolute before:inset-0 before:ml-[38px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
            <For each={movies().filter(m => m.media_type === mediaType())}>{(m) => {
              const day = new Date(m.calc_date).getDate(); const month = new Date(m.calc_date).toLocaleString('default', { month: 'short' });
              return (
              <div onClick={() => setPreviewMovie(m)} class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group cursor-pointer">
                <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#08090b] border-4 border-[var(--primary)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_15px_var(--primary)] z-10 ml-5 md:ml-0 overflow-hidden"><div class="flex flex-col items-center justify-center leading-none"><span class="text-[10px] font-black text-white">{day}</span><span class="text-[7px] font-bold text-[var(--primary)] uppercase">{month}</span></div></div>
                <div class="w-[calc(100%-5rem)] md:w-[calc(50%-3rem)] glass-surface p-3 rounded-[1.5rem] border border-white/5 hover:border-[var(--primary)]/50 transition-all shadow-lg flex gap-4 animate-pop-in">
                  <Show when={m.poster_path} fallback={<div class="w-16 h-24 bg-[#171921] rounded-xl flex items-center justify-center"><Icon name="movie" class="text-gray-600"/></div>}><img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} class="w-16 h-24 rounded-xl object-cover shadow-md bg-[#171921]" /></Show>
                  <div class="flex-1 flex flex-col justify-center py-1 min-w-0">
                    <p class="font-bold text-sm text-gray-100 line-clamp-2 group-hover:text-[var(--primary)] transition-colors">{m.title}</p>
                    <div class="flex items-center gap-2 mt-2">
                        <Show when={m.media_type === 'tv'} fallback={<span class="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded font-black uppercase tracking-widest flex items-center gap-1 w-max"><Icon name="theaters" class="text-[10px]"/> Theatrical</span>}>
                            <span class="text-[8px] bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 px-2 py-1 rounded font-black uppercase tracking-widest flex items-center gap-1 w-max"><Icon name="tv" class="text-[10px]"/> {m.epTag || 'Series Drop'}</span>
                        </Show>
                    </div>
                  </div>
                </div>
              </div>
            )}}</For>
          </div>
        </Show>
      }><div class="text-center p-12 flex flex-col items-center gap-4 text-[var(--primary)] animate-pulse font-bold text-sm tracking-widest uppercase"><Icon name="radar" class="text-5xl animate-spin"/> Scanning Radar...</div></Show>

      <Show when={previewMovie()}><UpcomingDetailsModal movie={previewMovie()} onClose={() => setPreviewMovie(null)} onAdd={() => handleAdd(previewMovie())} /></Show>
    </div>
  );
}
