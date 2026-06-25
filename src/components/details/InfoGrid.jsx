import { Show, For } from 'solid-js';
import { SafeInfoRow, Icon } from '../../utils';

export function InfoGrid(props) {
  return (
    <div class="glass-surface p-5 rounded-2xl space-y-4 border border-white/5">
        <Show when={!props.isPreview}><SafeInfoRow icon="adjust" label="Status" value={<span class="text-[var(--primary)] font-black uppercase text-[10px] tracking-widest">{props.movie?.status||'Planned'}</span>} /></Show>
        
        <Show when={!props.isPreview && (props.movie?.media_type !== 'tv' || !props.movie?.seasonDates || Object.keys(props.movie?.seasonDates || {}).length === 0)}>
            <SafeInfoRow icon="calendar_today" label="Watch Date" value={<span class="text-xs text-gray-300">{props.movie?.watchDate || 'Not set'}</span>} />
        </Show>

        <Show when={!props.isPreview}><SafeInfoRow icon="public" label="Region" value={props.movie?.region || 'International'} /></Show>
        <SafeInfoRow icon="format_list_bulleted" label="Genre" value={<span class="text-xs text-gray-300">{props.genresText}</span>} />
        
        <SafeInfoRow icon="connected_tv" label="Available On" value={
            <Show when={props.richPlatforms?.length > 0} fallback={<span class="text-xs font-bold text-gray-500">-</span>}>
                <div class="flex flex-wrap gap-2 mt-1">
                    <For each={props.richPlatforms.slice(0, 6)}>{(p) => (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.name} class="flex flex-col items-center gap-1 bg-white/5 hover:bg-[var(--primary)]/20 border border-white/10 hover:border-[var(--primary)]/50 px-2 py-2 rounded-xl transition-all group shadow-sm min-w-[58px]">
                            <Show when={!p.isCss && p.logo} fallback={
                                <div class="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shadow-inner" style={{ "background-color": p.color || 'var(--p-dim)', color: p.color === '#ffffff' ? '#000' : 'var(--p)' }}>
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                            }>
                                <img src={p.logo} alt={p.name} class="w-7 h-7 rounded-lg object-cover bg-black border border-white/10" loading="lazy" />
                            </Show>
                            <span class="text-[8px] font-black text-gray-300 group-hover:text-white uppercase tracking-widest max-w-[54px] truncate">{p.name}</span>
                        </a>
                    )}</For>
                </div>
            </Show>
        } />
        
        <Show when={!props.isPreview && props.movie?.tag}><SafeInfoRow icon="label" label="Tag" value={<span class="text-[9px] font-black uppercase tracking-widest bg-white/10 text-white px-2 py-0.5 rounded border border-white/20">{props.movie.tag}</span>} /></Show>
        <Show when={!props.isPreview && props.movieFranchises}><SafeInfoRow icon="folder_special" label="Lists" value={<span class="text-xs font-bold text-white">{props.movieFranchises}</span>} /></Show>
        <Show when={!props.isPreview && props.movie?.notes && typeof props.movie.notes === 'string'}><div class="border-t border-white/5 pt-3 mt-3"><p class="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1 flex items-center gap-1"><Icon name="edit_note" class="text-[14px]"/> Notes</p><p class="text-sm text-gray-300 italic">"{props.movie.notes}"</p></div></Show>

        <Show when={props.similarItems?.length > 0}>
          <div class="mb-8 mt-6">
            <h3 class="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-3 px-1 flex items-center gap-2">
              <Icon name="auto_awesome" class="text-[12px]" style="color: var(--p)"/> More Like This
            </h3>
            <div class="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
              <For each={props.similarItems}>{(item) => (
                <div 
                  onClick={() => props.onSimilarClick(item)}
                  class="min-w-[110px] w-[110px] shrink-0 cursor-pointer active:scale-95 transition-transform"
                >
                  <img src={`https://image.tmdb.org/t/p/w200${item.poster_path}`} class="w-full h-[160px] rounded-xl object-cover bg-[#171921] mb-2 border border-white/5" />
                  <p class="text-[10px] font-bold text-gray-200 line-clamp-2 leading-tight">{item.title || item.name}</p>
                </div>
              )}</For>
            </div>
          </div>
        </Show>

        <Show when={!props.isPreview && props.movie?.media_type === 'tv' && props.movie?.seasonDates && Object.keys(props.movie.seasonDates).length > 0 && Object.keys(props.movie.seasonDates).some(k => props.movie.seasonDates[k].start || props.movie.seasonDates[k].end)}>
            <div class="border-t border-white/5 pt-4 mt-2">
                <p class="text-[10px] uppercase font-black text-[var(--primary)] tracking-widest mb-2 flex items-center gap-1.5"><Icon name="history" class="text-[14px]"/> Season Timeline</p>
                <div class="space-y-1.5">
                    <For each={Object.entries(props.movie.seasonDates).filter(e => e[1].start || e[1].end).sort((a,b)=>Number(a[0])-Number(b[0]))}>
                        {([s, d]) => {
                            const days = props.calculateDays(d.start, d.end);
                            const formatD = (ds) => ds ? new Date(ds).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'2-digit'}) : 'Present';
                            return (
                                <div class="flex justify-between items-center bg-black/40 px-3 py-2 rounded-xl border border-white/5 shadow-inner">
                                    <span class="text-[10px] font-black text-white tracking-widest uppercase">Season {s}</span>
                                    <div class="flex items-center gap-2.5">
                                        <span class="text-[9px] text-gray-300 font-bold tracking-wider flex items-center gap-1.5">
                                            {formatD(d.start)} <Icon name="arrow_forward" class="text-[10px] text-gray-500"/> {d.end ? formatD(d.end) : <span class="text-gray-500">Present</span>}
                                        </span>
                                        <Show when={days !== null}>
                                            <span class="text-[8px] bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 px-1.5 py-0.5 rounded font-black uppercase tracking-widest shadow-sm">{days} Day{days !== 1 ? 's' : ''}</span>
                                        </Show>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </div>
        </Show>
    </div>
  );
}
