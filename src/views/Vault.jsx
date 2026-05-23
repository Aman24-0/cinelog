import { createSignal, createEffect, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import { Icon, getSafeGenres, getSafePlatforms } from '../utils';
import { MovieCard } from '../components/MovieCard';

export function Vault(props) {
  const [search, setSearch] = createSignal('');
  const [filters, setFilters] = createSignal({ type: 'all', status: props.activeStatus || 'all', region: 'all', genre: 'all', platform: 'all', sort: 'recent', tag: 'all' });
  const [showFilter, setShowFilter] = createSignal(false);
  const [displayLimit, setDisplayLimit] = createSignal(30);
  const [viewMode, setViewMode] = createSignal('grid');

  // Fix 2: Auto-switch to Grid if Status is not 'Completed'
  createEffect(() => {
    if (filters().status !== 'Completed' && viewMode() === 'timeline') {
      setViewMode('grid');
    }
  });

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
      if (filters().sort === 'watch_desc') {
          const dA = a.watchDate ? new Date(a.watchDate).getTime() : 0;
          const dB = b.watchDate ? new Date(b.watchDate).getTime() : 0;
          return dB - dA;
      }
      if (filters().sort === 'watch_asc') {
          const dA = a.watchDate ? new Date(a.watchDate).getTime() : Infinity;
          const dB = b.watchDate ? new Date(b.watchDate).getTime() : Infinity;
          return dA - dB;
      }
      if (filters().sort === 'year_desc') return (parseInt(String(b.release_date || b.first_air_date || '').substring(0, 4)) || 0) - (parseInt(String(a.release_date || a.first_air_date || '').substring(0, 4)) || 0);
      if (filters().sort === 'rating_desc') return (b.rating || 0) - (a.rating || 0);
      if (filters().sort === 'title_asc') return (a.title || a.name || '').localeCompare(b.title || b.name || '');
      return (b.addedAt?.seconds || 0) - (a.addedAt?.seconds || 0);
    });
  });

  const activeFilterCount = createMemo(() => Object.values(filters()).filter(v => v !== 'all' && v !== 'recent').length);

  // Fix 1: Timeline Logic - Strictly filter out items without watchDate
  const groupedTimeline = createMemo(() => {
    const list = filtered().filter(m => m.watchDate); // Only items with watchDate
    const groups = [];
    let currentGroup = null;

    list.forEach(m => {
      const dateObj = new Date(m.watchDate);
      const monthYear = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      if (!currentGroup || currentGroup.label !== monthYear) {
        currentGroup = { label: monthYear, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(m);
    });
    return groups;
  });

  return (
    <div class="animate-fade-in pb-10">
      <div class="sticky top-0 z-40 pt-4 pb-5 -mx-5 px-5 border-b mb-6"
        style="background: rgba(5,6,10,0.88); backdrop-filter: blur(24px); border-color: var(--border)">
        <div class="flex justify-between items-center mb-4">
          <h2 class="font-headline text-4xl text-white">VAULT</h2>
          
          <div class="flex items-center gap-2 sm:gap-3">
            {/* View Mode Toggle - Disabled for non-Completed status */}
            <div class="flex p-1 rounded-full border shadow-sm" style={`background: var(--surface); border-color: var(--border-active); opacity: ${filters().status === 'Completed' ? '1' : '0.5'}`}>
                <button 
                    onClick={() => setViewMode('grid')} 
                    class={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${viewMode() === 'grid' ? 'bg-[var(--p)] text-[#0c0e14] shadow-[0_0_12px_var(--p-glow)]' : 'text-gray-500 hover:text-white'}`}
                >
                    <Icon name="grid_view" class="text-sm sm:text-base" />
                </button>
                <button 
                    disabled={filters().status !== 'Completed'}
                    onClick={() => setViewMode('timeline')} 
                    class={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${viewMode() === 'timeline' ? 'bg-[var(--p)] text-[#0c0e14] shadow-[0_0_12px_var(--p-glow)]' : 'text-gray-500 hover:text-white'}`}
                >
                    <Icon name="timeline" class="text-sm sm:text-base" />
                </button>
            </div>

            <button
              onClick={() => setShowFilter(true)}
              class="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs font-semibold border active:scale-95 transition-transform"
              style="background: var(--surface); border-color: var(--border-active); color: var(--muted)"
            >
              <Icon name="tune" class="text-sm" />
              {activeFilterCount() > 0 && <span class="px-2 py-0.5 rounded-full text-[10px] font-bold text-black" style="background: var(--p)">{activeFilterCount()}</span>}
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-xl px-4 py-3 border" style="background: var(--surface); border-color: var(--border)">
          <Icon name="search" style="color: var(--dim)" />
          <input
            value={search()}
            onInput={e => { setSearch(e.target.value); setDisplayLimit(30); }}
            placeholder="Search movies, series, actors..."
            class="bg-transparent border-none w-full outline-none text-white text-sm font-medium"
          />
        </div>
      </div>

      <Show when={filtered().length === 0}>
         <div class="text-center p-12" style="color: var(--muted)">
            <Icon name="sentiment_dissatisfied" class="text-5xl mb-3" />
            <p class="font-semibold text-sm">No titles found.</p>
         </div>
      </Show>

      {/* RENDER GRID VIEW */}
      <Show when={viewMode() === 'grid' && filtered().length > 0}>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 animate-fade-in">
          <For each={filtered().slice(0, displayLimit())}>
            {(m) => <MovieCard movie={m} onClick={() => props.openMovie(m.id)} />}
          </For>
        </div>
      </Show>

      {/* RENDER TIMELINE VIEW */}
      <Show when={viewMode() === 'timeline' && filters().status === 'Completed' && groupedTimeline().length > 0}>
        <div class="relative before:absolute before:inset-0 before:ml-[1.25rem] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent space-y-10 animate-fade-in pb-10">
          <For each={groupedTimeline()}>
            {(group) => (
              <div class="relative">
                <div class="sticky top-[150px] z-30 inline-flex items-center gap-2 text-[#0c0e14] font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-full ml-10 mb-5 shadow-[0_0_15px_var(--p-glow)]" style="background: var(--p)">
                  <Icon name="event" class="text-[14px]"/> {group.label}
                </div>
                <div class="space-y-4">
                  <For each={group.items}>
                    {(m) => {
                      const theDate = new Date(m.watchDate);
                      const day = theDate.getDate();
                      return (
                        <div class="relative flex items-center group cursor-pointer pl-10 pr-2" onClick={() => props.openMovie(m.id)}>
                          <div class="absolute left-[1.25rem] -translate-x-1/2 w-8 h-8 rounded-full bg-[#08090b] border-2 flex items-center justify-center shadow-lg z-10" style="border-color: var(--p)">
                             <span class="text-[10px] font-black text-white">{day}</span>
                          </div>
                          <div class="glass-surface w-full p-2.5 sm:p-3 rounded-[1.5rem] border hover:bg-white/5 transition-all shadow-md flex gap-4" style="border-color: var(--border)">
                            <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} class="w-14 h-20 rounded-xl object-cover shadow-md bg-[#171921] shrink-0" />
                            <div class="flex-1 flex flex-col justify-center py-1 min-w-0 pr-2">
                              <p class="font-bold text-sm text-gray-100 truncate">{m.title || m.name}</p>
                            </div>
                          </div>
                        </div>
                      )
                    }}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* FILTER MODAL (Same as before) */}
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

// FilterModal Component... (Remains unchanged)
function FilterModal(props) {
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');
  return (
    <div class="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4 z-[999999] animate-fade-in" style="background: rgba(0,0,0,0.7); backdrop-blur: blur(8px)" onClick={props.onClose}>
      <div class="glass-surface w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-32 sm:p-8 shadow-2xl animate-slide-up" style="border-color: var(--border-active); background: rgba(9,11,16,0.97)" onClick={e => e.stopPropagation()}>
        <div class="space-y-4 max-h-[50vh] overflow-y-auto pr-1 hide-scrollbar">
            {/* ... Filters Select code stays exactly the same as previously provided ... */}
            <FilterSel label="Sort By" val={props.filters.sort} set={(v) => props.setFilters({ ...props.filters, sort: v })} opts={[{ l: 'Recently Added', v: 'recent' }, { l: 'Watch Date (Newest)', v: 'watch_desc' }, { l: 'Watch Date (Oldest)', v: 'watch_asc' }, { l: 'Release Year (Newest)', v: 'year_desc' }, { l: 'Rating (High-Low)', v: 'rating_desc' }, { l: 'Title (A-Z)', v: 'title_asc' }]} />
        </div>
        <button onClick={props.onClose} class="w-full mt-6 font-bold py-4 rounded-xl text-xs uppercase tracking-widest text-[#0c0e14]" style="background: var(--p)">Apply Filters</button>
      </div>
    </div>
  );
}

const FilterSel = (props) => (
  <div class="grid grid-cols-[90px_1fr] items-center gap-2">
    <span class="label-mono">{props.label}</span>
    <select value={props.val} onChange={e => props.set(e.target.value)} class="w-full text-white font-medium cursor-pointer bg-transparent border-b border-white/10 pb-1">
      <For each={props.opts}>{(o) => <option value={o.v || o} class="bg-[#0c0e14]">{o.l || o}</option>}</For>
    </select>
  </div>
);
