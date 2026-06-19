import { Icon } from '../../utils';

export function RatingsPanel(props) {
  return (
    <div class="grid grid-cols-3 gap-2 my-5 w-full">
      <div class="bg-black/40 backdrop-blur-md border border-white/10 py-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md">
        <div class="flex items-center gap-1 mb-0.5"><Icon name="star" fill class="text-[10px] text-[#f5c518]"/><span class="text-xs font-black text-white">{props.omdbData().imdb}</span></div>
        <span class="text-[7px] font-black text-gray-500 uppercase tracking-widest">IMDb</span>
      </div>
      <div class="bg-black/40 backdrop-blur-md border border-white/10 py-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md">
        <div class="flex items-center gap-1 mb-0.5"><span class="text-[10px]">🍅</span><span class="text-xs font-black text-white">{props.omdbData().rt}</span></div>
        <span class="text-[7px] font-black text-gray-500 uppercase tracking-widest">RT</span>
      </div>
      <div class="bg-[var(--primary)]/10 backdrop-blur-md border border-[var(--primary)]/20 py-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md">
        <div class="flex items-center gap-1 mb-0.5"><Icon name="person" fill class="text-[10px] text-[var(--primary)]"/><span class="text-xs font-black text-[var(--primary)]">{props.movie().rating ? `${props.movie().rating}/10` : '-'}</span></div>
        <span class="text-[7px] font-black text-[var(--primary)] uppercase tracking-widest opacity-70">Sage</span>
      </div>
    </div>
  );
}
