import { For } from 'solid-js';
import { Icon } from '../utils';

export function LoadingScreen() {
  // 40 empty items for the CSS skeleton grid
  const gridItems = Array(40).fill(0);
  
  return (
    <div class="h-screen w-full flex items-center justify-center bg-[#08090b] overflow-hidden relative">
      
      {/* 1. Pure CSS Animated Background (Zero Images) */}
      <div class="absolute inset-0 flex justify-center items-center opacity-30 pointer-events-none">
        <div class="grid grid-cols-5 md:grid-cols-8 gap-4 transform -rotate-12 scale-[1.5] md:scale-125 w-[150vw]">
          <For each={gridItems}>{() => (
            <div class="w-16 h-24 md:w-20 md:h-28 rounded-xl bg-white/5 animate-pulse border border-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)]"></div>
          )}</For>
        </div>
      </div>
      
      {/* 2. Dark Fade Overlay */}
      <div class="absolute inset-0 bg-gradient-to-b from-[#08090b]/40 via-[#08090b]/80 to-[#08090b] z-10"></div>
      
      {/* 3. Main Glowing Logo & Loader */}
      <div class="relative z-20 flex flex-col items-center animate-pop-in">
        <div class="relative mb-6">
            <h1 class="text-5xl md:text-7xl font-black font-headline text-transparent bg-clip-text bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] tracking-tighter relative z-10 drop-shadow-2xl">
                CINELOG
            </h1>
            {/* Core Glow Effect */}
            <div class="absolute inset-0 bg-[var(--primary)]/30 blur-[40px] rounded-full z-0 animate-pulse"></div>
        </div>
        
        {/* Glassmorphic Loading Pill */}
        <div class="flex items-center gap-2 text-[var(--primary)] text-[10px] font-black uppercase tracking-widest bg-black/50 backdrop-blur-md px-5 py-2.5 rounded-full border border-[var(--primary)]/30 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <Icon name="radar" class="text-sm animate-spin" /> Scanning Universe...
        </div>
      </div>
      
    </div>
  );
}
