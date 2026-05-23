import { createSignal, createEffect, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import { Icon, getSafeGenres, getSafePlatforms } from '../utils';
import { MovieCard } from '../components/MovieCard';

export function Vault(props) {
  const [search, setSearch] = createSignal('');
  const [filters, setFilters] = createSignal({ type: 'all', status: props.activeStatus || 'all', region: 'all', genre: 'all', platform: 'all', sort: 'recent', tag: 'all' });
  const [showFilter, setShowFilter] = createSignal(false);
  const [displayLimit, setDisplayLimit] = createSignal(30);
  const [viewMode, setViewMode] = createSignal('grid'); // 'grid' or 'timeline'

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
      // NEW: Watch Date Sorting
      if (filters().sort === 'watch_desc') {
          const dA = a.watchDate ? new Date(a.watchDate).getTime() : (a.addedAt?.seconds * 1000 || 0);
          const dB = b.watchDate ? new Date(b.watchDate).getTime() : (b.addedAt?.seconds * 1000 || 0);
          return dB - dA; // Newest first
      }
      if (filters().sort === 'watch_asc') {
          const dA = a.watchDate ? new Date(a.watchDate).getTime() : (a.addedAt?.seconds * 1000 || 0);
          const dB = b.watchDate ? new Date(b.watchDate).getTime() : (b.addedAt?.seconds * 1000 || 0);
          return dA - dB; // Oldest first
      }
      
      // Existing Sorting
      if (filters().sort === 'year_desc') return (parseInt(String(b.release_date || b.first_air_date || '').substring(0, 4)) || 0) - (parseInt(String(a.release_date || a.first_air_date || '').substring(0, 4)) || 0);
      if (filters().sort === 'rating_desc') return (b.rating || 0) - (a.rating || 0);
      if (filters().sort === 'title_asc') return (a.title || a.name || '').localeCompare(b.title || b.name || '');
      
      // Default: Recently Added to Vault
      return (b.addedAt?.seconds || 0) - (a.addedAt?.seconds || 0);
    });
  });

  const activeFilterCount = createMemo(() => Object.values(filters()).filter(v => v !== 'all' && v !== 'recent').length);

  // Helper memo to group movies by Month and Year for the Timeline View
  const groupedTimeline = createMemo(() => {
    const list = filtered().slice(0, displayLimit());
    const groups = [];
    let currentGroup = null;

    list.forEach(m => {
      const dateObj = m.watchDate ? new Date(m.watchDate) : (m.addedAt ? new Date(m.addedAt.seconds * 1000) : new Date(0));
      const monthYear = isNaN(dateObj.getTime()) ? 'Unknown Date' : dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

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
      {/* Sticky header */}
      <div class="sticky top-0 z-40 pt-4 pb-5 -mx-5 px-5 border-b mb-6"
        style="background: rgba(5,6,10,0.88); backdrop-filter: blur(24px); border-color: var(--border)">
        <div class="flex justify-between items-center mb-4">
          <h2 class="font-headline text-4xl text-white">VAULT</h2>
          
          <div class="flex items-center gap-2 sm:gap-3">
            {/* View Mode Toggle */}
            <div class="flex p-1 rounded-full border shadow-sm" style="background: var(--surface); border-color: var(--border-active)">
                <button 
                    onClick={() => setViewMode('grid')} 
                    class={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${viewMode() === 'grid' ? 'bg-[var(--p)] text-[#0c0e14] shadow-[0_0_12px_var(--p-glow)]' : 'text-gray-500 hover:text-white'}`}
                    title="Grid View"
                >
                    <Icon name="grid_view" class="text-sm sm:text-base" />
                </button>
                <button 
                    onClick={() => setViewMode('timeline')} 
                    class={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${viewMode() === 'timeline' ? 'bg-[var(--p)] text-[#0c0e14] shadow-[0_0_12px_var(--p-glow)]' : 'text-gray-500 hover:text-white'}`}
                    title="Timeline View"
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
              <span class="hidden sm:inline">Filter</span>
              {activeFilterCount() > 0 && (
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold text-black"
                  style="background: var(--p)">{activeFilterCount()}</span>
              )}
            </button>
          </div>
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
        <Show when={props.isGuest} fallback={
          <div class="text-center p-12" style="color: var(--muted)">
            <Icon name="sentiment_dissatisfied" class="text-5xl mb-3" />
            <p class="font-semibold text-sm">No titles match your filters.</p>
          </div>
        }>
          <div class="text-center p-12 animate-fade-in border rounded-[2rem] glass-surface" style="border-color: var(--border-active)">
            <Icon name="video_library" class="text-6xl mb-4 opacity-50" style="color: var(--p)" />
            <h3 class="font-headline text-3xl text-white mb-2">Your Vault is Empty</h3>
            <p class="text-sm text-gray-400 mb-6 max-w-sm mx-auto">Sign in to start tracking movies and series, add custom tags, and build your collection.</p>
            <button onClick={props.onLogin} class="px-8 py-3 rounded-full font-bold text-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all" style="background: var(--p); box-shadow: 0 0 16px var(--p-glow)">
              Sign In Now
            </button>
          </div>
        </Show>
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
      <Show when={viewMode() === 'timeline' && filtered().length > 0}>
        <div class="relative before:absolute before:inset-0 before:ml-[1.25rem] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent space-y-10 animate-fade-in pb-10">
          <For each={groupedTimeline()}>
            {(group) => (
              <div class="relative">
                {/* Month/Year Label Sticky Node */}
                <div class="sticky top-[150px] z-30 inline-flex items-center gap-2 text-[#0c0e14] font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-full ml-10 mb-5 shadow-[0_0_15px_var(--p-glow)]" style="background: var(--p)">
                  <Icon name="event" class="text-[14px]"/> {group.label}
                </div>
                
                <div class="space-y-4">
                  <For each={group.items}>
                    {(m) => {
                      const theDate = m.watchDate ? new Date(m.watchDate) : (m.addedAt ? new Date(m.addedAt.seconds * 1000) : null);
                      const day = theDate && !isNaN(theDate) ? theDate.getDate() : '--';
                      
                      return (
                        <div class="relative flex items-center group cursor-pointer pl-10 pr-2" onClick={() => props.openMovie(m.id)}>
                          
                          {/* Timeline Dot with Day */}
                          <div class="absolute left-[1.25rem] -translate-x-1/2 w-8 h-8 rounded-full bg-[#08090b] border-2 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform z-10" style="border-color: var(--p)">
                             <span class="text-[10px] font-black text-white">{day}</span>
                          </div>
                          
                          {/* Movie Content Horizontal Card */}
                          <div class="glass-surface w-full p-2.5 sm:p-3 rounded-[1.5rem] border hover:bg-white/5 transition-all shadow-md flex gap-4 animate-pop-in" style="border-color: var(--border)">
                            <Show when={m.poster_path} fallback={
                               <div class="w-14 h-20 sm:w-16 sm:h-24 bg-[#171921] rounded-xl flex items-center justify-center shrink-0 border border-white/5"><Icon name="movie" class="text-gray-600"/></div>
                            }>
                               <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} class="w-14 h-20 sm:w-16 sm:h-24 rounded-xl object-cover shadow-md bg-[#171921] shrink-0" />
                            </Show>
                            
                            <div class="flex-1 flex flex-col justify-center py-1 min-w-0 pr-2">
                              <p class="font-bold text-sm sm:text-base text-gray-100 group-hover:text-white transition-colors truncate">{m.title || m.name}</p>
                              
                              <div class="flex items-center gap-2 mt-1.5">
                                  <span class="text-[8px] bg-white/10 text-gray-300 px-2 py-0.5 rounded font-black uppercase tracking-widest border border-white/5 shrink-0">
                                    {m.media_type === 'tv' ? 'Series' : 'Movie'}
                                  </span>
                                  <Show when={m.status}>
                                    <span class="text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest shrink-0" style="color: var(--p); background: var(--p-dim); border: 1px solid var(--p)">
                                      {m.status === 'Plan to Watch' ? 'Planned' : m.status}
                                    </span>
                                  </Show>
                              </div>

                              <Show when={m.rating || m.imdbRating}>
                                 <div class="flex items-center gap-3 mt-2.5">
                                    <Show when={m.rating}>
                                        <span class="text-[10px] font-black flex items-center gap-1" style="color: var(--p)"><Icon name="star" class="text-[12px]"/> {m.rating}/10</span>
                                    </Show>
                                    <Show when={m.imdbRating}>
                                        <span class="text-[10px] font-black flex items-center gap-1 text-[#f5c518]"><span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">IMDb</span> {m.imdbRating}</span>
                                    </Show>
                                 </div>
                              </Show>
                            </div>
                            
                            {/* Action Icon on Hover */}
                            <div class="hidden sm:flex self-center pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                               <Icon name="chevron_right" class="text-2xl" style="color: var(--p)"/>
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

      {/* FILTER MODAL */}
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
          
          {/* NEW SORT OPTIONS ADDED HERE */}
          <FilterSel label="Sort By" val={props.filters.sort}
            set={(v) => props.setFilters({ ...props.filters, sort: v })}
            opts={[
                { l: 'Recently Added', v: 'recent' }, 
                { l: 'Watch Date (Newest)', v: 'watch_desc' }, 
                { l: 'Watch Date (Oldest)', v: 'watch_asc' }, 
                { l: 'Release Year (Newest)', v: 'year_desc' }, 
                { l: 'Rating (High-Low)', v: 'rating_desc' }, 
                { l: 'Title (A-Z)', v: 'title_asc' }
            ]} />
        </div>

        <button
          onClick={props.onClose}
          class="w-full mt-6 font-bold py-4 rounded-xl text-xs uppercase tracking-widest text-[#0c0e14]"
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
    <select value={props.val} onChange={e => props.set(e.target.value)} class="w-full text-white font-medium cursor-pointer">
      <For each={props.opts}>{(o) => <option value={o.v || o} class="bg-[#0c0e14]">{o.l || o}</option>}</For>
    </select>
  </div>
);
