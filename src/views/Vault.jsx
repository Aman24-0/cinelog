import { createSignal, createEffect, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import { Icon, getSafeGenres, getSafePlatforms } from '../utils';
import { MovieCard } from '../components/MovieCard';

export function Vault(props) {
  const [search, setSearch] = createSignal('');
  const [filters, setFilters] = createSignal({ type: 'all', status: props.activeStatus || 'all', region: 'all', genre: 'all', platform: 'all', sort: 'recent', tag: 'all' });
  const [showFilter, setShowFilter] = createSignal(false);

  createEffect(() => setFilters(f => ({...f, status: props.activeStatus || 'all'})));

  const uniqueGenres = createMemo(() => [...new Set(props.watchlist().flatMap(m => getSafeGenres(m)))].filter(Boolean).sort());
  const uniquePlatforms = createMemo(() => [...new Set(props.watchlist().flatMap(m => getSafePlatforms(m)))].filter(Boolean).sort());
  const uniqueTags = createMemo(() => [...new Set(props.watchlist().map(m => m.tag).filter(Boolean))].sort());

  const filtered = createMemo(() => {
    let f = props.watchlist();
    if(search()) f = f.filter(m => (m.title||m.name||'').toLowerCase().includes(search().toLowerCase()));
    if(filters().type !== 'all') f = f.filter(m => m.media_type === filters().type);
    if(filters().status !== 'all') f = f.filter(m => m.status === filters().status || (filters().status === 'Planned' && m.status === 'Plan to Watch'));
    if(filters().region !== 'all') f = f.filter(m => (m.region || 'International') === filters().region);
    if(filters().genre !== 'all') f = f.filter(m => getSafeGenres(m).includes(filters().genre));
    if(filters().platform !== 'all') f = f.filter(m => getSafePlatforms(m).includes(filters().platform));
    if(filters().tag !== 'all') f = f.filter(m => m.tag === filters().tag);
    
    return f.sort((a, b) => {
      if(filters().sort === 'year_desc') return (parseInt(String(b.release_date||b.first_air_date||'').substring(0,4))||0) - (parseInt(String(a.release_date||a.first_air_date||'').substring(0,4))||0);
      if(filters().sort === 'rating_desc') return (b.rating||0) - (a.rating||0);
      if(filters().sort === 'title_asc') return (a.title||a.name||'').localeCompare(b.title||b.name||'');
      return (b.addedAt?.seconds||0) - (a.addedAt?.seconds||0);
    });
  });

  const activeFilterCount = createMemo(() => Object.values(filters()).filter(v => v !== 'all' && v !== 'recent').length);

  return (
    <div class="animate-fade-in pb-10">
      <div class="sticky top-0 z-40 bg-[#08090b]/80 backdrop-blur-2xl pt-4 pb-6 -mx-6 px-6 sm:mx-0 sm:px-0 border-b border-white/5 mb-6">
        <div class="flex justify-between items-center mb-5">
            <h2 class="text-3xl font-headline font-black drop-shadow-md">Vault</h2>
            <button onClick={() => setShowFilter(true)} class="glass-surface px-4 py-2.5 rounded-full text-xs font-bold flex gap-2 border border-white/10 hover:bg-white/10 active:scale-95 transition-all shadow-lg"><Icon name="tune" class="text-sm"/> Filter {activeFilterCount() > 0 && <span class="bg-[var(--primary)] text-[#0c0e14] px-2 py-0.5 rounded-full text-[10px]">{activeFilterCount()}</span>}</button>
        </div>
        <div class="relative group animate-pop-in">
            <div class="flex items-center gap-3 glass-surface rounded-2xl px-5 py-4 relative border border-white/10 focus-within:border-[var(--primary)]/50 transition-colors shadow-xl">
                <Icon name="search" class="text-gray-400" />
                <input value={search()} onInput={e => setSearch(e.target.value)} placeholder="Search your universe..." class="bg-transparent border-none w-full outline-none text-white text-sm font-medium placeholder-gray-600" />
                <Show when={search().length > 0 || activeFilterCount() > 0}>
                    <button onClick={() => { setFilters({ type: 'all', status: 'all', region: 'all', genre: 'all', platform: 'all', sort: 'recent', tag: 'all' }); setSearch(''); props.onFilterChange && props.onFilterChange('all'); }} class="text-[9px] text-white bg-red-500/20 border border-red-500/50 hover:bg-red-500 px-3 py-1.5 rounded-full font-black uppercase tracking-widest active:scale-95 transition-all shrink-0">Clear</button>
                </Show>
            </div>
        </div>
      </div>

      <Show when={filtered().length === 0}>
         <div class="text-center p-12 text-gray-500 opacity-50"><Icon name="sentiment_dissatisfied" class="text-5xl mb-3"/><p class="font-bold text-sm">No titles match your filters.</p></div>
      </Show>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4"><For each={filtered()}>{(m) => <MovieCard movie={m} onClick={() => props.openMovie(m.id)} />}</For></div>
      <Show when={showFilter()}><FilterModal filters={filters()} setFilters={setFilters} uniqueGenres={uniqueGenres()} uniquePlatforms={uniquePlatforms()} uniqueTags={uniqueTags()} onClose={() => setShowFilter(false)} onFilterChange={props.onFilterChange} /></Show>
    </div>
  );
}

function FilterModal(props) {
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');
  return (
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-[999999] animate-fade-in" onClick={props.onClose}>
      <div class="glass-surface w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-32 sm:p-8 border border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transform transition-transform animate-pop-in bg-[#08090b]/95" onClick={e=>e.stopPropagation()}>
        <div class="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 sm:hidden"></div>
        <div class="flex justify-between items-center border-b border-white/5 pb-4 mb-4"><h3 class="font-bold text-xl text-white flex items-center gap-2"><Icon name="tune" class="text-[var(--primary)]"/> Filters</h3><button onClick={props.onClose} class="bg-white/5 p-2 rounded-full active:scale-95 transition-all"><Icon name="close" class="text-gray-400 hover:text-white"/></button></div>
        <div class="space-y-4 max-h-[50vh] overflow-y-auto pr-2 hide-scrollbar">
          <FilterSel label="Status" val={props.filters.status} set={(v)=>{props.setFilters({...props.filters, status:v}); props.onFilterChange && props.onFilterChange(v);}} opts={[{l:'All',v:'all'},{l:'Planned',v:'Planned'},{l:'Watching',v:'Watching'},{l:'Completed',v:'Completed'}]} />
          <FilterSel label="Tags" val={props.filters.tag} set={(v)=>props.setFilters({...props.filters, tag:v})} opts={[{l:'All Tags', v:'all'}, ...props.uniqueTags.map(t=>({l:t, v:t}))]} />
          <FilterSel label="Type" val={props.filters.type} set={(v)=>props.setFilters({...props.filters, type:v})} opts={[{l:'All', v:'all'}, {l:'Movies', v:'movie'}, {l:'Series', v:'tv'}]} />
          <FilterSel label="Region" val={props.filters.region} set={(v)=>props.setFilters({...props.filters, region:v})} opts={[{l:'All',v:'all'},{l:'Indian',v:'Indian'},{l:'International',v:'International'}]} />
          <FilterSel label="Platform" val={props.filters.platform} set={(v)=>props.setFilters({...props.filters, platform:v})} opts={[{l:'All Platforms', v:'all'}, ...props.uniquePlatforms.map(p=>({l:p, v:p}))]} />
          <FilterSel label="Genre" val={props.filters.genre} set={(v)=>props.setFilters({...props.filters, genre:v})} opts={[{l:'All Genres', v:'all'}, ...props.uniqueGenres.map(g=>({l:g, v:g}))]} />
          <FilterSel label="Sort By" val={props.filters.sort} set={(v)=>props.setFilters({...props.filters, sort:v})} opts={[{l:'Recently Added', v:'recent'}, {l:'Release Year (Newest)', v:'year_desc'}, {l:'Rating (High-Low)', v:'rating_desc'}, {l:'Title (A-Z)', v:'title_asc'}]} />
        </div>
        <button onClick={props.onClose} class="w-full mt-6 bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14] font-black py-4 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-transform shadow-lg shadow-[var(--primary)]/20">Apply Filters</button>
      </div>
    </div>
  );
}

const FilterSel = (props) => <div class="grid grid-cols-[90px_1fr] items-center"><span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{props.label}</span><select value={props.val} onChange={e => props.set(e.target.value)} class="glass-surface p-2.5 rounded-lg text-xs text-white outline-none border border-white/5 focus:border-[var(--primary)]"><For each={props.opts}>{(o)=><option value={o.v||o}>{o.l||o}</option>}</For></select></div>;
