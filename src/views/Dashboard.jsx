// src/views/Dashboard.jsx
import { createMemo, For, Show } from 'solid-js';
import { Icon } from '../utils';
import { MovieCard } from '../components/MovieCard';

export function Dashboard(props) {

  const continueWatchingList = createMemo(() => {
    return props.watchlist()
      .filter(m => {
        if (!m.watchProgress || m.watchProgress.currentTime <= 0) return false;
        if (m.status !== 'Watching') return false;
        if (m.media_type !== 'tv') return true;
        const wpSeason = parseInt(m.watchProgress.season || 1);
        const wpEpisode = parseInt(m.watchProgress.episode || 1);
        const currentSeason = parseInt(m.season || 1);
        const currentEpisode = parseInt(m.episode || 1);
        return wpSeason === currentSeason && wpEpisode === currentEpisode;
      })
      .sort((a, b) => new Date(b.watchProgress.updatedAt).getTime() - new Date(a.watchProgress.updatedAt).getTime());
  });

  const featuredItem = createMemo(() => {
    if (continueWatchingList().length > 0) return continueWatchingList()[0];
    if (props.watchlist().length > 0) return props.watchlist()[0];
    return null;
  });

  return (
    <div class="animate-fade-in pb-6 space-y-8">

      {/* ── FEATURED HERO ── */}
      <Show when={featuredItem()} fallback={
        <div class="featured-hero flex flex-col items-center justify-center text-center p-6 bg-[#141414]">
          <Show when={props.isGuest} fallback={
            <p class="text-sm text-gray-400">Add titles to your vault to get started</p>
          }>
            <p class="text-sm text-gray-400 mb-4">Your cinematic universe starts here</p>
            <button onClick={props.onLogin} class="px-6 py-2 rounded-full font-bold text-black text-xs uppercase tracking-widest active:scale-95 transition-all" style="background: var(--p);">
              Sign In
            </button>
          </Show>
        </div>
      }>
        {(item) => {
          const bgImg = item().backdrop_path ? `https://image.tmdb.org/t/p/w780${item().backdrop_path}` : (item().poster_path ? `https://image.tmdb.org/t/p/w500${item().poster_path}` : '');
          return (
            <div class="featured-hero">
              <Show when={bgImg}>
                <img src={bgImg} class="w-full h-full object-cover" />
              </Show>
              <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />
              <div class="absolute bottom-0 left-0 w-full p-4 lg:p-6 flex flex-col gap-2">
                <h2 class="font-headline text-3xl lg:text-5xl text-white leading-none">{item().title || item().name}</h2>
                <div class="flex items-center gap-2 text-sm text-gray-300 font-medium">
                  <span>{(item().release_date || item().first_air_date || '').split('-')[0]}</span>
                  <Show when={item().imdbRating || item().rating}>
                    <span class="flex items-center gap-1">
                      <Icon name="star" class="text-xs text-yellow-500" />
                      {item().imdbRating || item().rating}
                    </span>
                  </Show>
                </div>
                <div class="flex items-center gap-3 mt-2">
                  <button 
                    onClick={() => {
                      const isContinue = continueWatchingList().some(m => m.id === item().id);
                      props.openMovie(isContinue ? 'RESUME_' + item().id : item().id);
                    }}
                    class="bg-white text-black px-6 py-2 rounded-full font-bold flex items-center gap-2 active:scale-95 transition-transform"
                  >
                    <Icon name="play_arrow" fill class="text-xl" /> Play
                  </button>
                  <button 
                    onClick={() => props.openMovie(item().id)}
                    class="bg-transparent border border-white text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 active:scale-95 transition-transform hover:bg-white/10"
                  >
                    <Icon name="info" class="text-xl" /> Info
                  </button>
                </div>
              </div>
            </div>
          );
        }}
      </Show>

      {/* ── GUEST HERO BANNER ── */}
      <Show when={props.isGuest}>
        <div class="bg-[#141414] p-6 rounded-3xl border border-white/10 mb-8 relative overflow-hidden">
          <h3 class="font-headline text-3xl text-white mb-2">Welcome to Cinelog</h3>
          <p class="text-xs text-gray-400 mb-5 max-w-sm relative z-10">You are exploring in Preview Mode. Sign in to start building your personal cinematic universe, track your watch progress, and get AI recommendations.</p>
          <button onClick={props.onLogin} class="px-6 py-3 rounded-full font-bold text-black text-[10px] uppercase tracking-widest active:scale-95 transition-all relative z-10" style="background: var(--p);">
            Start Building Vault
          </button>
        </div>
      </Show>

      {/* ── CONTINUE WATCHING ── */}
      <Show when={continueWatchingList().length > 0}>
        <div class="animate-fade-up mt-2">
          <p class="section-title">Continue Watching</p>
          <div class="flex gap-4 overflow-x-auto hide-scrollbar pb-4 snap-x">
            <For each={continueWatchingList()}>
              {(m) => {
                 const runtimeBasedDuration = (Number(m.runtime) > 0 ? Number(m.runtime) * 60 : 0);
                 const fallbackDuration = m.media_type === 'tv' ? 45 * 60 : 120 * 60;
                 const effectiveDuration = Number(m.watchProgress.duration) > 0
                  ? Math.max(Number(m.watchProgress.duration), runtimeBasedDuration || 0)
                  : (runtimeBasedDuration || fallbackDuration);
                 const pct = effectiveDuration > 0
                  ? Math.min(100, Math.max(0, (Number(m.watchProgress.currentTime || 0) / effectiveDuration) * 100))
                  : 0;
                 const bgImg = m.backdrop_path ? `https://image.tmdb.org/t/p/w500${m.backdrop_path}` : (m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '');

                 return (
                   <div onClick={() => props.openMovie('RESUME_' + m.id)}
                        class="relative w-64 h-36 shrink-0 rounded-2xl overflow-hidden cursor-pointer group snap-start shadow-lg bg-[#111] border border-white/10">
                      <Show when={bgImg} fallback={<div class="w-full h-full flex items-center justify-center"><Icon name="movie" class="text-4xl text-gray-700"/></div>}>
                          <img src={bgImg} class="w-full h-full object-cover opacity-60 group-hover:scale-105 group-hover:opacity-90 transition-all duration-700" />
                      </Show>
                      <div class="absolute inset-0 bg-gradient-to-t from-[#000] via-[#000]/40 to-transparent pointer-events-none" />

                      <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                          <div class="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center border text-white" style="border-color: var(--p2)">
                              <Icon name="play_arrow" fill class="text-2xl" style="color: var(--p2)" />
                          </div>
                      </div>

                      <div class="p-4 absolute bottom-0 left-0 w-full z-10">
                         <h4 class="font-bold text-sm text-white truncate drop-shadow-md mb-2">{m.title || m.name}</h4>
                         <div class="w-full bg-black/50 h-1.5 rounded-full overflow-hidden shadow-inner border border-white/5">
                            <div class="h-full rounded-full transition-all duration-500" style={`background: var(--p2); width: ${pct}%`} />
                         </div>
                         <div class="flex justify-between items-center mt-2">
                            <span class="text-[8px] font-black text-gray-300 uppercase tracking-widest">{m.media_type === 'tv' ? `S${m.season||1} E${m.episode||1}` : 'Movie'}</span>
                            <span class="text-[8px] font-black uppercase tracking-widest" style="color: var(--p2)">{Math.round(pct)}%</span>
                         </div>
                      </div>
                   </div>
                 )
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* ── RECENTLY ADDED ── */}
      <div>
        <div class="flex justify-between items-center mb-4 mt-4">
          <p class="section-title !mt-0 !mb-0">Recently Added</p>
          <button
            onClick={() => { props.setActiveVaultStatus('all'); props.setView('watchlist'); }}
            class="flex items-center gap-1 hover:text-white transition-colors uppercase font-bold tracking-widest"
            style="font-size: 9px; color: var(--p)"
          >
            View All <Icon name="arrow_forward" class="text-xs" />
          </button>
        </div>
        <div class="flex gap-3 overflow-x-auto hide-scrollbar pb-4 stagger">
          <For each={props.watchlist().slice(0, 10)}>
            {(m) => <div class="w-[100px] sm:w-[130px] shrink-0"><MovieCard movie={m} onClick={() => props.openMovie(m.id)} /></div>}
          </For>
        </div>
      </div>

    </div>
  );
}
