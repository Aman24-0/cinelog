import { createMemo, For } from 'solid-js';
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

  const pickRandom = () => {
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

      {/* ── STATS GRID ── */}
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
      <div class="mt-2">
        <AIRecommend watchlist={props.watchlist} />
      </div>

    </div>
  );
}
