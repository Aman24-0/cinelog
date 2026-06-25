import { Show, For } from 'solid-js';
import { Icon } from '../../utils';

export function EditForm(props) {
  return (
    <div class="glass-surface p-6 rounded-2xl space-y-4 animate-fade-in border mt-4 shadow-xl" style="border-color: var(--border-active);">
        <div class="grid grid-cols-2 gap-4">
            <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Status</label><select value={props.form.status} onChange={e=>props.setForm({...props.form, status: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--p)] transition-colors"><option value="Planned">Planned</option><option value="Watching">Watching</option><option value="Completed">Completed</option></select></div>
            <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Personal Rating</label><input type="number" step="0.1" min="0" max="10" value={props.form.rating} onChange={e=>props.setForm({...props.form, rating: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--p)] transition-colors"/></div>
        </div>
        
        <Show when={props.movie?.media_type === 'tv'}>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Season</label><input type="number" value={props.form.season} onInput={e=>props.setForm({...props.form, season: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--p)] transition-colors"/></div>
                <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Episode</label><input type="number" value={props.form.episode} onInput={e=>props.setForm({...props.form, episode: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--p)] transition-colors"/></div>
            </div>
        </Show>
        
        <div class="grid grid-cols-2 gap-4">
            <Show when={props.movie?.media_type === 'movie'}>
                <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Watch Date</label><input type="date" value={props.form.watchDate} onInput={e=>props.setForm({...props.form, watchDate: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white [color-scheme:dark] outline-none focus:border-[var(--p)] transition-colors"/></div>
            </Show>
            <div class={props.movie?.media_type === 'tv' ? 'col-span-2' : ''}><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Region</label><select value={props.form.region} onChange={e=>props.setForm({...props.form, region: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--p)] transition-colors"><option>International</option><option>Indian</option></select></div>
        </div>

        <Show when={props.movie?.media_type === 'tv'}>
            <div class="mt-4">
                <label class="text-[9px] uppercase font-black text-gray-500 mb-2 block tracking-widest flex items-center gap-1"><Icon name="history" class="text-[14px]"/> Season Timelines</label>
                <div class="space-y-2 bg-black/40 p-3 rounded-2xl border border-white/5 shadow-inner max-h-48 overflow-y-auto hide-scrollbar">
                    <For each={Array.from({length: Math.max(1, parseInt(props.form.season) || 1)})}>
                        {(_, i) => {
                            const s = i() + 1;
                            const d = props.form.seasonDates[s] || { start: '', end: '' };
                            return (
                                <div class="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#0c0e14] p-2 rounded-xl border border-white/5">
                                    <span class="text-[10px] font-black w-8 text-center py-1 rounded-md" style="color: var(--p); background: var(--p-dim)">S{s}</span>
                                    <div class="flex flex-1 items-center gap-2">
                                        <div class="flex-1">
                                            <input type="date" value={d.start} onInput={e => props.setForm({...props.form, seasonDates: {...props.form.seasonDates, [s]: {...(props.form.seasonDates[s]||{}), start: e.target.value}}})} class="w-full bg-transparent border-b border-white/10 p-1 text-xs text-white [color-scheme:dark] outline-none focus:border-[var(--p)] transition-colors" title={`Season ${s} Start Date`}/>
                                        </div>
                                        <Icon name="arrow_forward" class="text-gray-600 text-[12px]"/>
                                        <div class="flex-1">
                                            <input type="date" value={d.end} onInput={e => props.setForm({...props.form, seasonDates: {...props.form.seasonDates, [s]: {...(props.form.seasonDates[s]||{}), end: e.target.value}}})} class="w-full bg-transparent border-b border-white/10 p-1 text-xs text-white [color-scheme:dark] outline-none focus:border-[var(--p)] transition-colors" title={`Season ${s} End Date`}/>
                                        </div>
                                    </div>
                                </div>
                            )
                        }}
                    </For>
                </div>
            </div>
        </Show>

        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Custom Tag</label><input placeholder="e.g. Theatre" value={props.form.tag} onInput={e=>props.setForm({...props.form, tag: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--p)] transition-colors placeholder-gray-700"/></div>
        
        {/* FIXED: Available Platforms Chips Color */}
        <div>
            <label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Available Platforms</label>
            <div class="flex flex-wrap gap-2 p-3 bg-[#0c0e14] border border-white/5 rounded-xl">
                <For each={props.allAvailablePlatforms()}>
                    {p => (
                        <button type="button" onClick={()=>props.togglePlatform(p)} 
                            class="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm active:scale-95 border"
                            style={props.form.platforms.split(',').map(s=>s.trim()).includes(p) 
                                ? 'background: var(--p); color: #000; border-color: var(--p); box-shadow: 0 0 12px var(--p-glow)' 
                                : 'background: rgba(255,255,255,0.05); color: #9ca3af; border-color: rgba(255,255,255,0.05)'}>
                            {p}
                        </button>
                    )}
                </For>
            </div>
        </div>

        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Genres (Comma separated)</label><input value={props.form.genres} onInput={e=>props.setForm({...props.form, genres: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--p)] transition-colors"/></div>
        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">My Notes</label><textarea value={props.form.notes} onInput={e=>props.setForm({...props.form, notes: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--p)] transition-colors placeholder-gray-700" rows="3" placeholder="Write your thoughts..."></textarea></div>
        
        <button onClick={props.saveChanges} class="w-full font-black py-4 rounded-xl text-[10px] uppercase tracking-widest mt-2 active:scale-95 transition-all flex items-center justify-center gap-2" style="background: var(--p); color: #05060a; box-shadow: 0 0 28px var(--p-glow), 0 4px 16px rgba(0,0,0,0.4)">Save Universe Changes</button>
    </div>
  );
}
