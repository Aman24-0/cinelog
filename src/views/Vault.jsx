import { createSignal, createEffect, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import { Icon, getSafeGenres, getSafePlatforms } from '../utils';
import { MovieCard } from '../components/MovieCard';

export function Vault(props) {
  const [search, setSearch] = createSignal('');
  const [filters, setFilters] = createSignal({ type: 'all', status: props.activeStatus || 'all', region: 'all', genre: 'all', platform: 'all', sort: 'recent', tag: 'all' });
  const [showFilter, setShowFilter] = createSignal(false);
  const [displayLimit, setDisplayLimit] = createSignal(30);

  createEffect(() => setFilters(f => ({ ...f, status: props.activeStatus || 'all' })));

  const handleScroll = () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500)
      setDisplayLimit(prev => prev + 30);
  };
  onMount(() => window.addEventListener('scroll', handleScroll));
  onCleanup(() => window.removeEventListener('scroll', handleScroll));

  const uniqueGenres = createMemo(() => [...new Set(props.watchlist().flatMap(m => getSafeGenres(m)))].filter(Boolean).sort());
  const uniquePlatforms = createMemo(() => [...new Set(props.watchlist().flatMap(m => getSafePlatforms(m)))].filter(Boolean).sort());
  const uniqueTags = createMemo(() => [...new Set(props.watchlist().map(m => m.tag).filter(Boolean))].sort());

  const filtered = createMemo(() => {
    let f = props.watchlist();
    if (search()) {
      const s = search().toLowerCase();
      f = f.filter(m =>
        (m.title || m.name || '').toLowerCase().includes(s) ||
        (m.castList && m.castList.some(c => c.toLowerCase().includes(s)))
      );
    }
    if (filters().type !== 'all') f = f.filter(m => m.media_type === filters().type);
    if (filters().status !== 'all') f = f.filter(m => m.status === filters().status || (filters().status === 'Planned' && m.status === 'Plan to Watch'));
    if (filters().region !== 'all') f = f.filter(m => (m.region || 'International') === filters().region);
    if (filters().genre !== 'all') f = f.filter(m => getSafeGenres(m).includes(filters().genre));
    if (filters().platform !== 'all') f = f.filter(m => getSafePlatforms(m).includes(filters().platform));
    if (filters().tag !== 'all') f = f.filter(m => m.tag === filters().tag);
    return f.sort((a, b) => {
      if (filters().sort === 'year_desc') return (parseInt(String(b.release_date || b.first_air_date || '').substring(0, 4)) || 0) - (parseInt(String(a.release_date || a.first_air_date || '').substring(0, 4)) || 0);
      if (filters().sort === 'rating_desc') return (b.rating || 0) - (a.rating || 0);
      if (filters().sort === 'title_asc') return (a.title || a.name || '').localeCompare(b.title || b.name || '');
      return (b.addedAt?.seconds || 0) - (a.addedAt?.seconds || 0);
    });
  });

  const activeFilterCount = createMemo(() => Object.values(filters()).filter(v => v !== 'all' && v !== 'recent').length);

  return (
    <div class="animate-fade-in pb-10">
      {/* Sticky header */}
      <div class="sticky top-0 z-40 pt-4 pb-5 -mx-5 px-5 border-b mb-6"
        style="background: rgba(5,6,10,0.88); backdrop-filter: blur(24px); border-color: var(--border)">
        <div class="flex justify-between items-center mb-4">
          <h2 class="font-headline text-4xl text-white">VAULT</h2>
          <button
            onClick={() => setShowFilter(true)}
            class="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold border"
            style="background: var(--surface); border-color: var(--border-active); color: var(--muted)"
          >
            <Icon name="tune" class="text-sm" />
            Filter
            {activeFilterCount() > 0 && (
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold text-black"
                style="background: var(--p)">{activeFilterCount()}</span>
            )}
          </button>
        </div>

        {/* Search */}
        <div class="flex items-center gap-3 rounded-xl px-4 py-3 border"
          style="background: var(--surface); border-color: var(--border); transition: border-color 0.25s"
          onFocusIn={e => e.currentTarget.style.borderColor = 'var(--p)'}
          onFocusOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <Icon name="search" style="color: var(--dim)" />
          <input
            value={search()}
            onInput={e => { setSearch(e.target.value); setDisplayLimit(30); }}
            placeholder="Search movies, series, actors..."
            class="bg-transparent border-none w-full outline-none text-white text-sm font-medium"
            style="color: var(--text)"
          />
          <Show when={search().length > 0 || activeFilterCount() > 0}>
            <button
              onClick={() => { setFilters({ type: 'all', status: 'all', region: 'all', genre: 'all', platform: 'all', sort: 'recent', tag: 'all' }); setSearch(''); setDisplayLimit(30); props.onFilterChange && props.onFilterChange('all'); }}
              class="text-[9px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest shrink-0"
              style="background: rgba(255,45,85,0.15); border: 1px solid rgba(255,45,85,0.4); color: #ff2d55"
            >
              Clear
            </button>
          </Show>
        </div>
      </div>

      <Show when={filtered().length === 0}>
        <div class="text-center p-12" style="color: var(--muted)">
          <Icon name="sentiment_dissatisfied" class="text-5xl mb-3" />
          <p class="font-semibold text-sm">No titles match your filters.</p>
        </div>
      </Show>

      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <For each={filtered().slice(0, displayLimit())}>
          {(m) => <MovieCard movie={m} onClick={() => props.openMovie(m.id)} />}
        </For>
      </div>

      <Show when={showFilter()}>
        <FilterModal
          filters={filters()}
          setFilters={(v) => { setFilters(v); setDisplayLimit(30); }}
          uniqueGenres={uniqueGenres()}
          uniquePlatforms={uniquePlatforms()}
          uniqueTags={uniqueTags()}
          onClose={() => setShowFilter(false)}
          onFilterChange={props.onFilterChange}
        />
      </Show>
    </div>
  );
}

function FilterModal(props) {
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');

  return (
    <div class="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4 z-[999999] animate-fade-in"
      style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px)"
      onClick={props.onClose}>
      <div
        class="glass-surface w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-32 sm:p-8 shadow-2xl animate-slide-up sm:animate-pop-in"
        style="border-color: var(--border-active); background: rgba(9,11,16,0.97)"
        onClick={e => e.stopPropagation()}
      >
        <div class="w-12 h-1.5 rounded-full mx-auto mb-6 sm:hidden" style="background: var(--border-active)" />
        <div class="flex justify-between items-center border-b pb-4 mb-5" style="border-color: var(--border)">
          <h3 class="font-bold text-xl text-white flex items-center gap-2">
            <Icon name="tune" style="color: var(--p)" /> Filters
          </h3>
          <button onClick={props.onClose} class="p-2 rounded-full hover:bg-white/5" style="color: var(--muted)">
            <Icon name="close" />
          </button>
        </div>

        <div class="space-y-4 max-h-[50vh] overflow-y-auto pr-1 hide-scrollbar">
          <FilterSel label="Status" val={props.filters.status}
            set={(v) => { props.setFilters({ ...props.filters, status: v }); props.onFilterChange && props.onFilterChange(v); }}
            opts={[{ l: 'All', v: 'all' }, { l: 'Planned', v: 'Planned' }, { l: 'Watching', v: 'Watching' }, { l: 'Completed', v: 'Completed' }]} />
          <FilterSel label="Tags" val={props.filters.tag}
            set={(v) => props.setFilters({ ...props.filters, tag: v })}
            opts={[{ l: 'All Tags', v: 'all' }, ...props.uniqueTags.map(t => ({ l: t, v: t }))]} />
          <FilterSel label="Type" val={props.filters.type}
            set={(v) => props.setFilters({ ...props.filters, type: v })}
            opts={[{ l: 'All', v: 'all' }, { l: 'Movies', v: 'movie' }, { l: 'Series', v: 'tv' }]} />
          <FilterSel label="Region" val={props.filters.region}
            set={(v) => props.setFilters({ ...props.filters, region: v })}
            opts={[{ l: 'All', v: 'all' }, { l: 'Indian', v: 'Indian' }, { l: 'International', v: 'International' }]} />
          <FilterSel label="Platform" val={props.filters.platform}
            set={(v) => props.setFilters({ ...props.filters, platform: v })}
            opts={[{ l: 'All Platforms', v: 'all' }, ...props.uniquePlatforms.map(p => ({ l: p, v: p }))]} />
          <FilterSel label="Genre" val={props.filters.genre}
            set={(v) => props.setFilters({ ...props.filters, genre: v })}
            opts={[{ l: 'All Genres', v: 'all' }, ...props.uniqueGenres.map(g => ({ l: g, v: g }))]} />
          <FilterSel label="Sort By" val={props.filters.sort}
            set={(v) => props.setFilters({ ...props.filters, sort: v })}
            opts={[{ l: 'Recently Added', v: 'recent' }, { l: 'Release Year (Newest)', v: 'year_desc' }, { l: 'Rating (High-Low)', v: 'rating_desc' }, { l: 'Title (A-Z)', v: 'title_asc' }]} />
        </div>

        <button
          onClick={props.onClose}
          class="w-full mt-6 font-bold py-4 rounded-xl text-xs uppercase tracking-widest text-black"
          style="background: var(--p); box-shadow: 0 0 20px var(--p-glow)"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}

const FilterSel = (props) => (
  <div class="grid grid-cols-[90px_1fr] items-center gap-2">
    <span class="label-mono">{props.label}</span>
    <select value={props.val} onChange={e => props.set(e.target.value)} class="w-full">
      <For each={props.opts}>{(o) => <option value={o.v || o}>{o.l || o}</option>}</For>
    </select>
  </div>
);
