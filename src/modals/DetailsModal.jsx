import { createSignal, createEffect, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon, formatRuntime, cleanPlatform, getSafeGenres, getSafePlatforms, SafeInfoRow, TMDB_KEY, OMDB_KEY } from '../utils';

export function DetailsModal(props) {
  const movie = createMemo(() => props.watchlist.find(m => String(m.id) === String(props.id)));
  const [details, setDetails] = createSignal({});
  const [isEdit, setIsEdit] = createSignal(false); const [trailerKey, setTrailerKey] = createSignal(null); const [playTrailer, setPlayTrailer] = createSignal(false);
  const [showPlayer, setShowPlayer] = createSignal(false); const [activeServer, setActiveServer] = createSignal('VidLink');
  const [omdbData, setOmdbData] = createSignal({ imdb: '-', rt: '-' });
  const [form, setForm] = createSignal({ status: '', rating: '', watchDate: '', notes: '', region: '', season: 1, episode: 1, tag: '', platforms: '', genres: '' });
  
  onMount(() => { document.body.style.overflow = 'hidden'; }); onCleanup(() => { document.body.style.overflow = ''; });
  const allAvailablePlatforms = createMemo(() => [...new Set(props.watchlist.flatMap(m => getSafePlatforms(m)))].filter(Boolean).sort());

  createEffect(() => { 
      if(movie()) { 
          setForm({ status: movie().status||'Planned', rating: movie().rating||'', watchDate: typeof movie().watchDate==='string'?movie().watchDate:'', notes: typeof movie().notes==='string'?movie().notes:'', region: movie().region||'International', season: movie().season||1, episode: movie().episode||1, tag: movie().tag||'', platforms: getSafePlatforms(movie()).join(', '), genres: getSafeGenres(movie()).join(', ') }); 
          
          fetch(`https://api.themoviedb.org/3/${movie().media_type||'movie'}/${movie().id}?api_key=${TMDB_KEY}&append_to_response=videos,credits`).then(r=>r.json()).then(d=>{ 
              setDetails(d);
              const v = d?.videos?.results; if(v){ let t = v.find(x=>x.site==='YouTube'&&x.type==='Trailer')||v.find(x=>x.site==='YouTube'&&x.type==='Teaser')||v.find(x=>x.site==='YouTube'); if(t) setTrailerKey(t.key); } 
          });

          const title = movie().title || movie().name;
          fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`).then(r=>r.json()).then(d=>{
              if(d.Response === 'True') {
                  const rt = d.Ratings?.find(r=>r.Source === 'Rotten Tomatoes')?.Value || '-';
                  setOmdbData({ imdb: d.imdbRating || '-', rt: rt });
                  updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), { imdbRating: d.imdbRating || '-', rtRating: rt.replace('%','') });
              }
          });
      } 
  });

  const togglePlatform = (p) => { let curr = form().platforms.split(',').map(s=>s.trim()).filter(Boolean); if(curr.includes(p)) curr = curr.filter(x=>x!==p); else curr.push(p); setForm({...form(), platforms: curr.join(', ')}); };
  const saveChanges = async () => { await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), { status: form().status, rating: parseFloat(form().rating)||0, watchDate: form().watchDate, notes: form().notes, region: form().region, season: parseInt(form().season)||1, episode: parseInt(form().episode)||1, tag: form().tag, genresList: form().genres.split(',').map(s=>s.trim()).filter(Boolean), platformsList: form().platforms.split(',').map(s=>cleanPlatform(s.trim())).filter(Boolean) }); props.showToast("Saved"); setIsEdit(false); };
  
  const isCompleted = createMemo(() => movie()?.status === 'Completed');
  const progressPct = createMemo(() => isCompleted() ? 100 : Math.min(((movie()?.episode||0) / (movie()?.totalEps||1)) * 100, 100));
  const movieFranchises = createMemo(() => props.franchises?.filter(f => movie()?.franchises?.[f.id] !== undefined).map(f => f.name).join(', '));
  const getStreamUrl = (server) => { const id = movie().id; const s = movie().season || 1; const e = movie().episode || 1; const pColor = 'b1a1ff'; if (server === 'VidLink') { return movie().media_type === 'tv' ? `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=${pColor}&autoplay=false` : `https://vidlink.pro/movie/${id}?primaryColor=${pColor}&autoplay=false`; } return movie().media_type === 'tv' ? `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?tmdb=${id}`; };

  return (
    <div class="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={props.onClose}>
      <div class="absolute inset-0 bg-[#08090b] overflow-hidden pointer-events-none"><Show when={movie()?.backdrop_path}><img src={`https://image.tmdb.org/t/p/w500${movie().backdrop_path}`} class="w-full h-full object-cover opacity-40 blur-3xl scale-125" /></Show><div class="absolute inset-0 bg-black/60"></div></div>
      <Show when={movie()}>
        <div class="w-full max-w-xl bg-[#08090b]/80 backdrop-blur-3xl rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 relative max-h-[95vh] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-pop-in flex flex-col" onClick={e=>e.stopPropagation()}>
          
          <button onClick={props.onClose} class="absolute top-4 right-4 z-[100] bg-black/50 backdrop-blur-md border border-white/10 p-2.5 rounded-full hover:bg-black/80 active:scale-95 transition-all"><Icon name="close" class="text-sm text-white"/></button>
          
          <div class="overflow-y-auto hide-scrollbar w-full">
              <div class="h-56 md:h-72 relative bg-black shrink-0">
                <Show when={!playTrailer()} fallback={<iframe class="w-full h-full absolute inset-0 z-10" src={`https://www.youtube.com/embed/${trailerKey()}?autoplay=1&rel=0`} frameborder="0" allowfullscreen></iframe>}>
                  <Show when={movie().backdrop_path} fallback={<div class="w-full h-full flex items-center justify-center text-gray-700 bg-[#171921]"><Icon name="movie" class="text-6xl"/></div>}><img src={`https://image.tmdb.org/t/p/original${movie().backdrop_path}`} class="w-full h-full object-cover opacity-60" /></Show>
                  <div class="absolute inset-0 bg-gradient-to-t from-[#08090b]/90 via-[#08090b]/40 to-transparent pointer-events-none" />
                  <Show when={trailerKey()}><button onClick={() => setPlayTrailer(true)} class="absolute inset-0 flex items-center justify-center z-10 group"><div class="w-16 h-16 bg-[var(--primary)]/30 backdrop-blur-md rounded-full flex items-center justify-center border border-[var(--primary)]/50 group-hover:scale-110 active:scale-95 transition-transform shadow-2xl"><Icon name="play_arrow" fill class="text-white text-4xl"/></div></button></Show>
                </Show>
              </div>

              <div class="px-6 md:px-8 pb-28 -mt-16 relative z-10">
                <div class="flex justify-between items-start mb-2">
                    <div class="pr-2">
                        <h2 class="text-3xl font-black drop-shadow-md leading-tight">{movie().title || movie().name}</h2>
                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                            {movie().release_date || details().release_date || 'N/A'} • {movie().media_type === 'tv' ? 'SERIES' : 'MOVIE'} 
                            <Show when={details().runtime || details().episode_run_time?.[0]}> • {formatRuntime(details().runtime || details().episode_run_time?.[0])}</Show>
                        </p>
                    </div>
                    <button onClick={()=>setIsEdit(!isEdit())} class={`p-2.5 rounded-full border transition-colors shrink-0 ${isEdit() ? 'bg-[var(--primary)] text-[#0c0e14] border-[var(--primary)]' : 'glass-surface text-gray-400 hover:text-white'}`}><Icon name={isEdit()?'check':'edit'} class="text-sm"/></button>
                </div>
                
                <div class="grid grid-cols-3 gap-2 my-5 w-full">
                    <div class="bg-black/40 backdrop-blur-md border border-white/10 py-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md">
                        <div class="flex items-center gap-1 mb-0.5"><Icon name="star" fill class="text-[10px] text-[#f5c518]"/><span class="text-xs font-black text-white">{omdbData().imdb}</span></div>
                        <span class="text-[7px] font-black text-gray-500 uppercase tracking-widest">IMDb</span>
                    </div>
                    <div class="bg-black/40 backdrop-blur-md border border-white/10 py-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md">
                        <div class="flex items-center gap-1 mb-0.5"><span class="text-[10px]">🍅</span><span class="text-xs font-black text-white">{omdbData().rt}</span></div>
                        <span class="text-[7px] font-black text-gray-500 uppercase tracking-widest">RT</span>
                    </div>
                    <div class="bg-[var(--primary)]/10 backdrop-blur-md border border-[var(--primary)]/20 py-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md">
                        <div class="flex items-center gap-1 mb-0.5"><Icon name="person" fill class="text-[10px] text-[var(--primary)]"/><span class="text-xs font-black text-[var(--primary)]">{movie().rating ? `${movie().rating}/10` : '-'}</span></div>
                        <span class="text-[7px] font-black text-[var(--primary)] uppercase tracking-widest opacity-70">Sage</span>
                    </div>
                </div>

                <Show when={isEdit()} fallback={
                  <div class="animate-fade-in">
                    <div class="flex gap-2 mb-6">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveServer('VidLink'); setShowPlayer(true); }} class="flex-1 bg-[var(--primary)] text-[#0c0e14] font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--primary)]/20"><Icon name="play_circle" fill class="text-[16px]"/> VidLink</button>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveServer('Vidsrc'); setShowPlayer(true); }} class="flex-1 bg-[#10b981] text-[#0c0e14] font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#10b981]/20"><Icon name="backup" fill class="text-[16px]"/> Vidsrc</button>
                    </div>

                    <p class="text-gray-400 text-sm mb-6 leading-relaxed italic border-l-2 border-[var(--primary)]/30 pl-3">"{details().overview || (typeof movie().overview === 'string' ? movie().overview : 'No overview available.')}"</p>
                    
                    <Show when={movie().media_type === 'tv'}>
                        <div class="glass-surface p-5 rounded-2xl border border-white/5 mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"><Icon name="video_library" class="text-[14px] text-[var(--primary)]"/> Tracker</span>
                                <span class="font-black text-sm text-white">{isCompleted() ? 'Completed' : `S${movie().season||1} E${movie().episode||1}`}</span>
                            </div>
                            <div class="w-full h-2 bg-black rounded-full overflow-hidden mb-4"><div class="h-full bg-[var(--primary)] transition-all shadow-[0_0_10px_var(--primary)]" style={{width:`${progressPct()}%`}}></div></div>
                            <Show when={!isCompleted()}>
                                <button onClick={async () => { let n = (parseInt(movie().episode)||1)+1; let s = movie().status==='Planned'?'Watching':movie().status; if(movie().totalEps>0 && n>=movie().totalEps) { s='Completed'; props.showToast("Completed! 🎉"); } await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), {episode: n, status: s}); }} class="w-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--primary)] hover:text-[#0c0e14] active:scale-95 transition-all">+1 Episode</button>
                            </Show>
                        </div>
                    </Show>

                    <Show when={details().credits}>
                        <div class="mb-8">
                            <h3 class="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-4">Cast & Crew</h3>
                            <div class="flex gap-5 overflow-x-auto hide-scrollbar pb-2">
                                <For each={details().credits.cast.slice(0, 8)}>{(c) => (
                                    <div class="flex flex-col items-center min-w-[75px] shrink-0">
                                        <img src={c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${c.name}&backgroundColor=171921`} class="w-16 h-16 rounded-full object-cover border border-white/10 mb-2 shadow-lg bg-[#171921]" />
                                        <p class="text-[9px] font-black text-center text-white truncate w-full">{c.name}</p>
                                        <p class="text-[7px] text-gray-500 text-center uppercase truncate w-full font-bold mt-0.5">{c.character}</p>
                                    </div>
                                )}</For>
                                <For each={details().credits.crew.filter(x=>x.job==='Director' || x.job==='Producer').slice(0,3)}>{(c) => (
                                    <div class="flex flex-col items-center min-w-[75px] shrink-0">
                                        <img src={c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${c.name}&backgroundColor=171921`} class="w-16 h-16 rounded-full object-cover border border-[var(--secondary)] mb-2 shadow-lg bg-[#171921]" />
                                        <p class="text-[9px] font-black text-center text-white truncate w-full">{c.name}</p>
                                        <p class="text-[7px] text-[var(--secondary)] text-center uppercase font-black tracking-widest mt-0.5">{c.job}</p>
                                    </div>
                                )}</For>
                            </div>
                        </div>
                    </Show>

                    <div class="glass-surface p-5 rounded-2xl space-y-4 border border-white/5">
                        <SafeInfoRow icon="adjust" label="Status" value={<span class="text-[var(--primary)] font-black uppercase text-[10px] tracking-widest">{movie().status||'Planned'}</span>} />
                        <SafeInfoRow icon="calendar_today" label="Watch Date" value={<span class="text-xs text-gray-300">{movie().watchDate || 'Not set'}</span>} />
                        <SafeInfoRow icon="public" label="Region" value={movie().region || 'International'} />
                        <SafeInfoRow icon="format_list_bulleted" label="Genre" value={<span class="text-xs text-gray-300">{getSafeGenres(movie()).join(', ') || 'N/A'}</span>} />
                        <SafeInfoRow icon="connected_tv" label="Available On" value={<span class="text-xs font-bold text-[var(--secondary)]">{getSafePlatforms(movie()).join(', ') || 'N/A'}</span>} />
                        <Show when={movie().tag}><SafeInfoRow icon="label" label="Tag" value={<span class="text-[9px] font-black uppercase tracking-widest bg-white/10 text-white px-2 py-0.5 rounded border border-white/20">{movie().tag}</span>} /></Show>
                        <Show when={movieFranchises()}><SafeInfoRow icon="folder_special" label="Lists" value={<span class="text-xs font-bold text-white">{movieFranchises()}</span>} /></Show>
                        <Show when={movie().notes && typeof movie().notes === 'string'}><div class="border-t border-white/5 pt-3 mt-3"><p class="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1 flex items-center gap-1"><Icon name="edit_note" class="text-[14px]"/> Notes</p><p class="text-sm text-gray-300 italic">"{movie().notes}"</p></div></Show>
                    </div>

                    <div class="mt-8 flex justify-end"><button onClick={async () => { if(confirm("Permanently delete?")) { await deleteDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id))); props.showToast("Deleted"); props.onClose(); } }} class="text-red-500/50 hover:text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors mx-auto active:scale-95"><Icon name="delete" class="text-sm"/> Remove from Universe</button></div>
                  </div>
                }>
                  <div class="glass-surface p-6 rounded-2xl space-y-4 animate-fade-in border border-[var(--primary)]/30 mt-4 shadow-lg shadow-[var(--primary)]/10">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Status</label><select value={form().status} onChange={e=>setForm({...form(), status: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"><option value="Planned">Planned</option><option value="Watching">Watching</option><option value="Completed">Completed</option></select></div>
                        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Personal Rating</label><input type="number" step="0.1" min="0" max="10" value={form().rating} onChange={e=>setForm({...form(), rating: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div>
                    </div>
                    <Show when={movie().media_type === 'tv'}><div class="grid grid-cols-2 gap-4"><div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Season</label><input type="number" value={form().season} onInput={e=>setForm({...form(), season: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div><div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Episode</label><input type="number" value={form().episode} onInput={e=>setForm({...form(), episode: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div></div></Show>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Watch Date</label><input type="date" value={form().watchDate} onInput={e=>setForm({...form(), watchDate: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white [color-scheme:dark] outline-none focus:border-[var(--primary)]"/></div>
                        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Region</label><select value={form().region} onChange={e=>setForm({...form(), region: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"><option>International</option><option>Indian</option></select></div>
                    </div>
                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Custom Tag</label><input placeholder="e.g. Theatre" value={form().tag} onInput={e=>setForm({...form(), tag: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)] placeholder-gray-700"/></div>
                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Available Platforms</label><div class="flex flex-wrap gap-2 p-3 bg-[#0c0e14] border border-white/5 rounded-xl"><For each={allAvailablePlatforms()}>{p => <button type="button" onClick={()=>togglePlatform(p)} class={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors shadow-sm active:scale-95 ${form().platforms.split(',').map(s=>s.trim()).includes(p) ? 'bg-gradient-to-tr from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14]' : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'}`}>{p}</button>}</For></div></div>
                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Genres (Comma separated)</label><input value={form().genres} onInput={e=>setForm({...form(), genres: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div>
                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">My Notes</label><textarea value={form().notes} onInput={e=>setForm({...form(), notes: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)] placeholder-gray-700" rows="3" placeholder="Write your thoughts..."></textarea></div>
                    <button onClick={saveChanges} class="w-full bg-[var(--primary)] text-[#0c0e14] font-black py-4 rounded-xl text-[10px] uppercase tracking-widest mt-2 active:scale-95 transition-transform shadow-lg shadow-[var(--primary)]/20">Save Universe Changes</button>
                  </div>
                </Show>
              </div>
          </div>
        </div>
      </Show>

      <Show when={showPlayer()}>
        <div class="fixed inset-0 bg-black z-[10000000] flex flex-col animate-fade-in" onClick={(e)=>e.stopPropagation()}>
          <div class="p-4 flex justify-between items-center bg-[#0c0e14] border-b border-white/5 shadow-xl">
            <div class="flex items-center gap-3 overflow-hidden pr-2">
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowPlayer(false); }} class="p-2 bg-white/5 hover:bg-white/10 rounded-full active:scale-95 transition-all"><Icon name="arrow_back" class="text-sm" /></button>
                <h3 class="font-bold text-sm text-white truncate">{movie().title || movie().name}</h3>
            </div>
            <div class="flex gap-2 shrink-0">
                <button type="button" onClick={(e)=>{e.stopPropagation(); setActiveServer('VidLink');}} class={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all ${activeServer()==='VidLink'?'bg-[var(--primary)] text-[#0c0e14] shadow-[0_0_10px_var(--primary)]':'bg-white/5 text-gray-400 hover:text-white'}`}>VidLink</button>
                <button type="button" onClick={(e)=>{e.stopPropagation(); setActiveServer('Vidsrc');}} class={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all ${activeServer()==='Vidsrc'?'bg-[#10b981] text-[#0c0e14] shadow-[0_0_10px_#10b981]':'bg-white/5 text-gray-400 hover:text-white'}`}>Vidsrc</button>
            </div>
          </div>
          <div class="flex-1 bg-black w-full h-full relative">
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none"><Icon name="hourglass_empty" class="text-white/20 text-4xl animate-spin"/></div>
            <iframe src={getStreamUrl(activeServer())} class="w-full h-full border-none relative z-10" allowfullscreen ></iframe>
          </div>
        </div>
      </Show>
    </div>
  );
}
