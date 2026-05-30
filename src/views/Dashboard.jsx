import { createMemo, For, Show } from 'solid-js';
import { Icon } from '../utils';
import { MovieCard } from '../components/MovieCard';
import { AIRecommend } from '../components/AIRecommend';

export function Dashboard(props) {

  const stats = createMemo(() => ({
    total:     props.watchlist().length,
    completed: props.watchlist().filter(m => m.status === 'Completed').length,
    watching:  props.watchlist().filter(m => m.status === 'Watching').length,
    planned:   props.watchlist().filter(m => m.status === 'Planned' || m.status === 'Plan to Watch').length,
  }));

  const continueWatchingList = createMemo(() => {
    return props.watchlist()
      .filter(m => {
        if (!m.watchProgress || m.watchProgress.currentTime <= 0 || m.status === 'Completed') return false;
        if (m.media_type !== 'tv') return true;
        const wpSeason = parseInt(m.watchProgress.season || 1);
        const wpEpisode = parseInt(m.watchProgress.episode || 1);
        const currentSeason = parseInt(m.season || 1);
        const currentEpisode = parseInt(m.episode || 1);
        return wpSeason === currentSeason && wpEpisode === currentEpisode;
      })
      .sort((a, b) => new Date(b.watchProgress.updatedAt).getTime() - new Date(a.watchProgress.updatedAt).getTime());
  });

  const pickRandom = () => {
    if (props.isGuest) {
      props.showToast("Sign in to shuffle your vault! 🔒");
      return props.onLogin();
    }
    const p = props.watchlist().filter(m => m.status === 'Planned' || m.status === 'Plan to Watch');
    if (p.length) {
      props.showToast("🎲 Picking random title...");
      setTimeout(() => props.openMovie(p[Math.floor(Math.random() * p.length)].id), 500);
    } else {
      alert("Planned list is empty!");
    }
  };

  return (
    <div class="animate-fade-in pb-6 space-y-8">

      {/* ── GUEST HERO BANNER ── */}
      <Show when={props.isGuest}>
        <div class="glass-surface p-6 rounded-[2rem] border mb-8 relative overflow-hidden" style="border-color: var(--p)">
          <div class="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none" style="background: var(--p)"></div>
          <h3 class="font-headline text-3xl text-white mb-2">Welcome to Cinelog</h3>
          <p class="text-xs text-gray-400 mb-5 max-w-sm relative z-10">You are exploring in Preview Mode. Sign in to start building your personal cinematic universe, track your watch progress, and get AI recommendations.</p>
          <button onClick={props.onLogin} class="px-6 py-3 rounded-full font-bold text-black text-[10px] uppercase tracking-widest active:scale-95 transition-all relative z-10" style="background: var(--p); box-shadow: 0 0 16px var(--p-glow)">
            Start Building Vault
          </button>
        </div>
      </Show>

      {/* ── HERO RANDOM PICKER ── */}
      <div onClick={pickRandom} class="hero-picker">
        <div class="hero-top-line" />
        <div class="flex items-center justify-between relative z-10">
          <div>
            <div class="label-mono mb-2" style="color: var(--p)">◈ Let the vault decide</div>
            <h2 class="font-headline text-5xl text-white leading-none">
              What to<br />
              <span style="color: var(--p)">Watch?</span>
            </h2>
          </div>
          <div class="flex flex-col items-center gap-2">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center border"
              style="background: var(--p-dim); border-color: var(--p); box-shadow: 0 0 20px var(--p-glow)">
              <Icon name="casino" fill class="text-2xl" style="color: var(--p)" />
            </div>
            <span class="label-mono" style="font-size:8px; color: var(--p)">RANDOM</span>
          </div>
        </div>
        <div class="absolute -right-8 -bottom-8 opacity-[0.04]">
          <Icon name="casino" fill class="text-[10rem]" />
        </div>
      </div>

      {/* ── STATS GRID (VAULT OVERVIEW) ── */}
      <div>
        <div class="label-mono mb-4">◈ Vault Overview</div>
        <div class="grid grid-cols-2 gap-3 stagger">

          {/* Total */}
          <div class="stat-card animate-fade-up col-span-2 sm:col-span-1">
            <div class="absolute -right-3 -bottom-3 opacity-[0.06]">
              <Icon name="inventory_2" fill class="text-8xl" />
            </div>
            <div class="label-mono mb-2">Total Titles</div>
            <div class="font-headline text-6xl text-white relative z-10">{stats().total}</div>
            <div class="progress-bar mt-3 relative z-10">
              <div class="progress-bar-fill" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Completed */}
          <div class="stat-card animate-fade-up col-span-2 sm:col-span-1"
            style="border-color: rgba(var(--p), 0.2)">
            <div class="absolute -right-3 -bottom-3 opacity-[0.07]" style="color: var(--p)">
              <Icon name="done_all" fill class="text-8xl" />
            </div>
            <div class="label-mono mb-2" style="color: var(--p)">Completed</div>
            <div class="font-headline text-6xl relative z-10" style="color: var(--p)">{stats().completed}</div>
            <div class="progress-bar mt-3 relative z-10">
              <div class="progress-bar-fill"
                style={{ width: `${stats().total ? (stats().completed / stats().total) * 100 : 0}%` }} />
            </div>
          </div>

          {/* Watching */}
          <div
            onClick={() => { props.setActiveVaultStatus('Watching'); props.setView('watchlist'); }}
            class="stat-card animate-fade-up cursor-pointer"
          >
            <div class="absolute -right-2 -bottom-2 opacity-[0.06]" style="color: var(--p2)">
              <Icon name="play_circle" fill class="text-7xl" />
            </div>
            <div class="label-mono mb-2" style="color: var(--p2)">Watching</div>
            <div class="font-headline text-5xl relative z-10" style="color: var(--p2)">{stats().watching}</div>
            <div class="flex items-center gap-1 mt-2 relative z-10">
              <div class="w-2 h-2 rounded-full animate-pulse" style="background: var(--p2); box-shadow: 0 0 8px var(--p2)" />
              <span class="label-mono" style="font-size:8px; color: var(--p2)">Live</span>
            </div>
          </div>

          {/* Planned */}
          <div
            onClick={() => { props.setActiveVaultStatus('Planned'); props.setView('watchlist'); }}
            class="stat-card animate-fade-up cursor-pointer"
          >
            <div class="absolute -right-2 -bottom-2 opacity-[0.05]">
              <Icon name="bookmark" fill class="text-7xl" />
            </div>
            <div class="label-mono mb-2">Planned</div>
            <div class="font-headline text-5xl text-white relative z-10">{stats().planned}</div>
            <div class="flex items-center gap-1 mt-2 relative z-10">
              <Icon name="chevron_right" class="text-sm text-muted" />
              <span class="label-mono" style="font-size:8px">View Queue</span>
            </div>
          </div>

        </div>
      </div>


      {/* ── CONTINUE WATCHING (MOVED HERE) ── */}
      <Show when={continueWatchingList().length > 0}>
        <div class="animate-fade-up mt-2">
          <div class="flex items-center gap-2 mb-4 px-1">
             <Icon name="play_circle" class="text-[18px]" style="color: var(--p2)" />
             <div class="label-mono font-bold uppercase tracking-widest text-[10px]" style="color: var(--p2)">Continue Watching</div>
          </div>
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
                        class="relative w-64 h-36 shrink-0 rounded-2xl overflow-hidden cursor-pointer group snap-start shadow-lg"
                        style="border: 1px solid var(--border); background: var(--surface)">
                      <Show when={bgImg} fallback={<div class="w-full h-full bg-[#171921] flex items-center justify-center"><Icon name="movie" class="text-4xl text-gray-700"/></div>}>
                          <img src={bgImg} class="w-full h-full object-cover opacity-60 group-hover:scale-105 group-hover:opacity-90 transition-all duration-700" />
                      </Show>
                      <div class="absolute inset-0 bg-gradient-to-t from-[#05060a] via-[#05060a]/40 to-transparent pointer-events-none" />

                      <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                          <div class="w-12 h-12 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border text-white shadow-[0_0_15px_rgba(0,0,0,0.5)]" style="border-color: var(--p2)">
                              <Icon name="play_arrow" fill class="text-2xl" style="color: var(--p2)" />
                          </div>
                      </div>

                      <div class="p-4 absolute bottom-0 left-0 w-full z-10">
                         <h4 class="font-bold text-sm text-white truncate drop-shadow-md mb-2">{m.title || m.name}</h4>
                         <div class="w-full bg-black/50 h-1.5 rounded-full overflow-hidden backdrop-blur-md shadow-inner border border-white/5">
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
        <div class="flex justify-between items-center mb-4">
          <div>
            <div class="label-mono mb-1">◈ Recently Added</div>
          </div>
          <button
            onClick={() => { props.setActiveVaultStatus('all'); props.setView('watchlist'); }}
            class="flex items-center gap-1 label-mono hover:text-white transition-colors"
            style="font-size: 9px; color: var(--p)"
          >
            View All <Icon name="arrow_forward" class="text-xs" />
          </button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger">
          <For each={props.watchlist().slice(0, 6)}>
            {(m) => <MovieCard movie={m} onClick={() => props.openMovie(m.id)} />}
          </For>
        </div>
      </div>

      {/* ── AI RECOMMENDATIONS ── */}
      <Show when={!props.isGuest}>
        <div class="mt-2">
          <AIRecommend watchlist={props.watchlist} onSearch={props.onSearch} />
        </div>
      </Show>

    </div>
  );
}
