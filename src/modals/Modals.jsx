import { createSignal, createEffect, For, Show } from 'solid-js';
import { Icon } from '../utils';

export function InsightsModal(props) {
  const stats = () => {
    let w = props.watchlist() || [];
    let total = w.length;
    let completed = w.filter(m => m.status === 'Completed').length;
    let movies = w.filter(m => m.media_type === 'movie').length;
    let tv = w.filter(m => m.media_type === 'tv').length;
    return { total, completed, movies, tv };
  };

  return (
    <div class="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-fade-in" onClick={props.onClose}>
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none"></div>
      <div class="w-full max-w-sm glass-surface rounded-[2rem] border border-white/10 relative shadow-2xl animate-pop-in p-6" onClick={e=>e.stopPropagation()}>
        <div class="flex justify-between items-center mb-6 px-1">
          <h3 class="font-black text-xl text-white flex items-center gap-2"><Icon name="bar_chart" class="text-[var(--primary)]"/> Insights</h3>
          <button onClick={props.onClose} class="text-gray-500 hover:text-white p-2 bg-white/5 rounded-full"><Icon name="close" class="text-sm"/></button>
        </div>
        
        {/* 🌟 Fix #5: Reverted to Premium 4-Block Grid */}
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col gap-1">
            <span class="text-[9px] text-gray-500 uppercase font-black tracking-widest">Total Titles</span>
            <span class="text-2xl font-black text-white">{stats().total}</span>
          </div>
          <div class="bg-[var(--primary)]/5 p-5 rounded-2xl border border-[var(--primary)]/10 flex flex-col gap-1">
            <span class="text-[9px] text-[var(--primary)] uppercase font-black tracking-widest">Completed</span>
            <span class="text-2xl font-black text-[var(--primary)]">{stats().completed}</span>
          </div>
          <div class="bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col gap-1">
            <span class="text-[9px] text-gray-500 uppercase font-black tracking-widest">Movies</span>
            <span class="text-2xl font-black text-white">{stats().movies}</span>
          </div>
          <div class="bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col gap-1">
            <span class="text-[9px] text-gray-500 uppercase font-black tracking-widest">TV Shows</span>
            <span class="text-2xl font-black text-white">{stats().tv}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsModal(props) {
  // 🌟 Restore 4 Themes (Fix #4)
  const themes = [
    { id: 'sage', name: 'Sage Green', color: '#b1a1ff' }, 
    { id: 'crimson', name: 'Crimson Red', color: '#ff4d4d' },
    { id: 'neon', name: 'Neon Blue', color: '#00f0ff' },
    { id: 'gold', name: 'Royal Gold', color: '#ffd700' }
  ];

  return (
    <div class="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-fade-in" onClick={props.onClose}>
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none"></div>
      <div class="w-full max-w-sm glass-surface rounded-[2rem] border border-white/10 relative shadow-2xl animate-pop-in p-6" onClick={e=>e.stopPropagation()}>
        <div class="flex justify-between items-center mb-6 px-1">
          <h3 class="font-black text-xl text-white flex items-center gap-2"><Icon name="palette" class="text-[var(--primary)]"/> Appearance</h3>
          <button onClick={props.onClose} class="text-gray-500 hover:text-white p-2 bg-white/5 rounded-full"><Icon name="close" class="text-sm"/></button>
        </div>
        <div class="space-y-3">
          <For each={themes}>{(t) => (
            <button onClick={() => props.setTheme(t.id)} class={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${props.currentTheme === t.id ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
              <span class="text-sm font-bold text-white uppercase tracking-tight">{t.name}</span>
              <div class="w-5 h-5 rounded-full border-2 border-white/10 shadow-lg" style={{ "background-color": t.color }}></div>
            </button>
          )}</For>
        </div>
      </div>
    </div>
  );
}
