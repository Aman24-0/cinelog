import { For } from 'solid-js';
import { Icon } from '../utils';

export function LoadingScreen() {
  const posters = ["/qJ2tW6WMUDux911r6m7haRef0WH.jpg", "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg", "/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg", "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg"];
  const gridItems = Array(72).fill(0).map((_, i) => posters[i % posters.length]);
  
  return (
    <div class="h-screen w-full flex items-center justify-center bg-[#0c0e14] overflow-hidden relative">
      <div class="absolute inset-0 flex justify-center items-center opacity-20 pointer-events-none">
        <div class="grid grid-cols-6 md:grid-cols-10 gap-3 transform -rotate-45 scale-[1.7] md:scale-150 w-[200vw] md:w-[150vw]">
          <For each={gridItems}>{src => (<img src={`https://image.tmdb.org/t/p/w200${src}`} class="w-20 h-28 md:w-24 md:h-36 object-cover rounded-lg shadow-2xl bg-[#171921]" />)}</For>
        </div>
      </div>
      <div class="absolute inset-0 bg-gradient-to-b from-[#0c0e14]/10 via-[#0c0e14]/80 to-[#0c0e14] z-10"></div>
      <div class="relative z-20 flex flex-col items-center">
        <h1 class="text-5xl font-black font-headline text-[var(--primary)] mb-3 tracking-tighter">CINELOG</h1>
        <div class="flex items-center gap-2 text-[var(--primary)] text-[10px] font-bold uppercase tracking-widest animate-pulse"><Icon name="hourglass_empty" class="text-sm animate-spin" /> Loading Universe...</div>
      </div>
    </div>
  );
}
