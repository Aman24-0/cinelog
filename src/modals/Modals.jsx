import { createSignal, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import { Icon, getSafeGenres, getSafePlatforms } from '../utils';

// --- SETTINGS MODAL ---
const ThemeBtn = (props) => <button onClick={() => { props.set(props.id); props.onClose(); }} class={`w-full p-4 rounded-xl border ${props.curr===props.id?'border-[var(--primary)] bg-[var(--primary)]/10':'border-white/5 hover:bg-white/5'} flex gap-4 items-center transition-colors`}><div class="w-6 h-6 rounded-full shadow-lg" style={{background: props.hex}}></div><span class="font-bold">{props.name}</span></button>;

export function SettingsModal(props) {
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');
  const themes = [{id:'sage', n:'Sage', h:'#b1a1ff'},{id:'matrix', n:'Matrix', h:'#00ff41'},{id:'netflix', n:'Netflix', h:'#e50914'},{id:'cyberpunk', n:'Cyberpunk', h:'#fce205'},{id:'interstellar', n:'Interstellar', h:'#38bdf8'},{id:'neonhorizon', n:'Neon Horizon', h:'#f472b6'},{id:'vibranium', n:'Vibranium', h:'#7c3aed'}];
  
  return (
    <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[999999]" onClick={props.onClose}>
      <div class="glass-surface w-full max-w-sm rounded-3xl p-6 border border-white/10 animate-pop-in" onClick={e=>e.stopPropagation()}>
        <div class="flex justify-between items-center border-b border-white/5 pb-4 mb-4"><h3 class="font-bold text-lg flex items-center gap-2"><Icon name="palette" class="text-[var(--primary)]"/> Themes</h3><button onClick={props.onClose}><Icon name="close" class="text-gray-500 hover:text-white"/></button></div>
        <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-2 hide-scrollbar"><For each={themes}>{t => <ThemeBtn id={t.id} name={t.n} hex={t.h} curr={props.currentTheme} set={props.setTheme} onClose={props.onClose} />}</For></div>
      </div>
    </div>
  );
}
// --- INSIGHTS MODAL ---
export function InsightsModal(props) {
  const [showWrapped, setShowWrapped] = createSignal(false);
  onMount(() => { document.body.style.overflow = 'hidden'; }); onCleanup(() => { document.body.style.overflow = ''; });
  
  const stats = createMemo(() => {
    let mins = 0; const genres = {}; const platforms = {}; const comp = props.watchlist().filter(m => m.status === 'Completed');
    comp.forEach(m => { mins += (parseInt(m.runtime)||0) * (m.media_type==='tv' ? (parseInt(m.episode)||1) : 1); getSafeGenres(m).forEach(g => genres[g]=(genres[g]||0)+1); getSafePlatforms(m).forEach(p => platforms[p]=(platforms[p]||0)+1); });
    const topG = Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,5); const topP = Object.entries(platforms).sort((a,b)=>b[1]-a[1]).slice(0,5);
    return { days: Math.floor(mins/1440), hours: Math.floor((mins%1440)/60), total: comp.length, topGenre: topG[0]?.[0] || 'N/A', topG, topP, maxG: topG[0]?.[1]||1, maxP: topP[0]?.[1]||1 };
  });

  return (
    <div class="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[999999] animate-fade-in" onClick={props.onClose}>
      <div class="w-full max-w-lg bg-[#08090b]/95 rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative animate-pop-in overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div class="absolute -top-20 -right-20 w-64 h-64 bg-[var(--primary)]/20 rounded-full blur-[80px] pointer-events-none"></div>
        <div class="flex justify-between items-center mb-8 relative z-10"><h2 class="text-3xl font-headline font-black text-white drop-shadow-md">Insights</h2><button onClick={props.onClose} class="bg-white/5 p-3 rounded-full hover:bg-white/10 active:scale-95 transition-all"><Icon name="close" class="text-white"/></button></div>
        
        {/* Infinity Ring UI */}
        <div class="flex justify-center mb-10 relative z-10">
            <div class="relative w-48 h-48 flex items-center justify-center rounded-full shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-[#0c0e14]">
                <svg class="absolute inset-0 w-full h-full -rotate-90 rounded-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="8" stroke-dasharray="283" stroke-dashoffset="0"></circle>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="var(--primary)" stroke-width="8" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="60" class="drop-shadow-[0_0_10px_var(--primary)]"></circle>
                </svg>
                <div class="text-center">
                    <p class="text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-widest">Watch Time</p>
                    <span class="text-5xl font-black font-headline text-white">{stats().days}<span class="text-sm text-gray-400 ml-1">d</span></span>
                    <div class="text-xl font-bold text-[var(--secondary)] mt-1">{stats().hours}<span class="text-[10px] uppercase text-gray-500 ml-1">hrs</span></div>
                </div>
            </div>
        </div>

        <button onClick={() => setShowWrapped(true)} class="w-full bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14] font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest mb-8 shadow-lg shadow-[var(--primary)]/20 flex items-center justify-center gap-2 active:scale-95 transition-transform relative z-10"><Icon name="auto_awesome"/> Open Wrapped</button>
        
        <div class="glass-surface rounded-[1.5rem] p-6 border border-white/5 relative z-10">
            <h3 class="font-bold mb-5 flex items-center gap-2 text-white"><Icon name="pie_chart" class="text-[var(--primary)]"/> Favorite Vibes</h3>
            <div class="space-y-4">
                <For each={stats().topG}>{([g, c]) => (
                    <div><div class="flex justify-between text-[10px] font-black uppercase mb-1.5 text-gray-400 tracking-widest"><span>{g}</span><span class="text-gray-500">{c} titles</span></div><div class="w-full bg-white/5 h-2 rounded-full overflow-hidden"><div style={{width: `${(c/stats().maxG)*100}%`}} class="h-full bg-[var(--primary)] rounded-full shadow-[0_0_10px_var(--primary)]"></div></div></div>
                )}</For>
            </div>
        </div>
      </div>
      
      <Show when={showWrapped()}>
        <div class="fixed inset-0 bg-black/98 flex items-center justify-center p-4 z-[9999999] animate-pop-in" onClick={() => setShowWrapped(false)}>
          <div class="bg-gradient-to-br from-[var(--primary)] via-[var(--secondary)] to-[#0c0e14] w-full max-w-sm h-[500px] rounded-[3rem] p-10 text-center flex flex-col justify-between shadow-2xl relative overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div class="mt-4 relative z-10">
                <h4 class="text-white/80 font-bold uppercase text-[10px] mb-3 tracking-widest">My Cinelog Wrapped</h4>
                <h2 class="text-4xl font-black font-headline text-white mb-8 leading-tight">I spent <br/><span class="text-[#0c0e14] bg-white px-3 py-1 mt-2 inline-block rounded-lg shadow-lg">{stats().days} Days</span><br/> in another universe.</h2>
                <div class="space-y-4 text-left bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                    <div><p class="text-[9px] uppercase font-bold text-white/50 tracking-widest mb-1">Masterpieces Finished</p><p class="text-2xl font-black text-white">{stats().total} Titles</p></div>
                    <div><p class="text-[9px] uppercase font-bold text-white/50 tracking-widest mb-1">Favorite Vibe</p><p class="text-2xl font-black text-[var(--secondary)]">{stats().topGenre}</p></div>
                </div>
            </div>
            <button onClick={() => setShowWrapped(false)} class="text-white bg-black/30 p-4 rounded-full mx-auto hover:bg-black transition-colors active:scale-95 relative z-10"><Icon name="close" /></button>
          </div>
        </div>
      </Show>
    </div>
  );
}
