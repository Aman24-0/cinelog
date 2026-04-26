import { createSignal, onMount, onCleanup, createEffect, For, Show, createMemo, ErrorBoundary } from 'solid-js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, addDoc, writeBatch, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';

// 1. FIREBASE & TMDB CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAvV2m7IAbDGSr0ZdFNv9Rnq9oUEAgufyI",
  authDomain: "watchlist-bcdfd.firebaseapp.com",
  projectId: "watchlist-bcdfd",
  storageBucket: "watchlist-bcdfd.firebasestorage.app",
  messagingSenderId: "479628005507",
  appId: "1:479628005507:web:12e0aa5b98977c82860bb6"
};
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY || ['415186758', 'b41cc5f8', 'c0ea969f6', 'd6c165'].join('');
const OMDB_KEY = import.meta.env.VITE_OMDB_API_KEY || '2a444b24';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 2. UTILITIES
const cleanPlatform = (p) => {
  if (!p) return null; const l = p.toLowerCase();
  if (l.includes('netflix')) return 'Netflix'; if (l.includes('prime') || l.includes('amazon')) return 'Amazon Prime Video';
  if (l.includes('hotstar') || l.includes('jio') || l.includes('disney')) return 'JioHotstar';
  if (l.includes('sony') || l.includes('liv')) return 'Sony LIV'; if (l.includes('zee')) return 'Zee5';
  if (l.includes('apple')) return 'Apple TV'; if (l.includes('crunchyroll')) return 'Crunchyroll';
  return p.trim();
};
const getSafeGenres = (m) => m?.genresList || (typeof m?.genres === 'string' ? m.genres.split(',') : []) || [];
const getSafePlatforms = (m) => [...new Set((m?.platformsList || []).map(cleanPlatform).filter(Boolean))];
const Icon = (props) => <span class={`material-symbols-outlined ${props.fill ? 'filled' : ''} ${props.class || ''}`}>{props.name}</span>;
const SafeInfoRow = (props) => <div class="grid grid-cols-[100px_1fr] items-center py-1"><span class="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2"><Icon name={props.icon} class="text-[14px]" /> {props.label}</span><div class="text-sm font-bold text-gray-200">{props.value}</div></div>;

const formatRuntime = (mins) => {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}` : `${m}m`;
};

// 3. MAIN APP
export default function App() {
  const [user, setUser] = createSignal(null);
  const [watchlist, setWatchlist] = createSignal([]);
  const [franchises, setFranchises] = createSignal([]);
  const [view, setView] = createSignal('dashboard');
  const [theme, setTheme] = createSignal(localStorage.getItem('cinelog_theme') || 'sage');
  const [loading, setLoading] = createSignal(true);
  const [activeVaultStatus, setActiveVaultStatus] = createSignal('all');
  
  const [searchModal, setSearchModal] = createSignal(false);
  const [detailsId, setDetailsId] = createSignal(null);
  const [settingsModal, setSettingsModal] = createSignal(false);
  const [statsModal, setStatsModal] = createSignal(false);
  const [userMenuOpen, setUserMenuOpen] = createSignal(false);
  const [toast, setToast] = createSignal({ show: false, msg: '' });

  const showToast = (msg) => { setToast({ show: true, msg }); setTimeout(() => setToast({ show: false, msg: '' }), 3000); };
  createEffect(() => { document.body.className = `theme-${theme()}`; localStorage.setItem('cinelog_theme', theme()); });
  createEffect(() => { view(); window.scrollTo(0, 0); });

  onMount(() => {
    onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        let wReady = false; let fReady = false;
        onSnapshot(query(collection(db, 'users', u.uid, 'watchlist'), orderBy('addedAt', 'desc')), (snap) => { 
            setWatchlist(snap.docs.map(d => ({ id: d.id, ...d.data() }))); wReady = true; if(fReady) setLoading(false);
        });
        onSnapshot(collection(db, 'users', u.uid, 'franchises'), (snap) => { 
            setFranchises(snap.docs.map(d => ({ id: d.id, ...d.data() }))); fReady = true; if(wReady) setLoading(false);
        });
      } else { setLoading(false); }
    });
  });

  const nukeCollection = async () => {
    if(confirm("DANGER: Entire Vault will be wiped. Sure?")) {
      showToast("Nuking Vault...");
      const snap = await getDocs(collection(db, 'users', user().uid, 'watchlist'));
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      showToast("Vault wiped!"); setUserMenuOpen(false);
    }
  };

  return (
    <ErrorBoundary fallback={(err) => <div class="h-screen flex flex-col items-center justify-center p-10 text-center"><Icon name="error" class="text-red-500 text-6xl mb-4"/><h2 class="text-xl font-bold text-white mb-2">Something broke!</h2><p class="text-xs text-gray-500 mb-6">{err.toString()}</p><button onClick={()=>window.location.reload()} class="bg-red-500 text-white px-6 py-2 rounded-lg font-bold">Reload App</button></div>}>
    <div class="min-h-screen pb-28" onClick={() => setUserMenuOpen(false)}>
      <Show when={!loading()} fallback={<LoadingScreen />}>
        <Show when={user()} fallback={
          <div class="h-screen flex flex-col items-center justify-center p-6 text-center">
            <h1 class="text-5xl font-black font-headline text-[var(--primary)] mb-4 tracking-tighter">CINELOG</h1>
            <p class="text-gray-400 mb-10 text-sm">Ultimate Edition</p>
            <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} class="bg-[var(--primary)] text-black font-bold py-4 px-10 rounded-full shadow-lg hover:scale-105 transition-transform">Sign In with Google</button>
          </div>
        }>
          
          <header class="flex justify-between items-center p-6 pb-2 relative">
            <h2 class="text-2xl font-black font-headline text-[var(--primary)] tracking-tighter">Cinelog</h2>
            <div class="flex items-center gap-3">
              <button onClick={() => setSettingsModal(true)} class="text-gray-500 glass-surface p-2 rounded-full active:scale-95 transition-transform"><Icon name="palette" class="text-sm" /></button>
              <div class="relative">
                <img src={user().photoURL} onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen()); }} class="w-9 h-9 rounded-full border-2 border-[var(--primary)] cursor-pointer object-cover relative active:scale-95 transition-transform" />
                <Show when={userMenuOpen()}>
                  <div class="fixed inset-0 z-[90]" onClick={() => setUserMenuOpen(false)}></div>
                  <div class="absolute right-0 mt-3 w-48 glass-surface rounded-2xl shadow-2xl py-2 z-[100] animate-pop-in border border-white/10 overflow-hidden">
                    <button onClick={() => { setStatsModal(true); setUserMenuOpen(false); }} class="w-full text-left px-5 py-3 text-sm font-bold text-[var(--primary)] hover:bg-white/5 flex items-center gap-3"><Icon name="bar_chart" class="text-[18px]"/> Insights</button>
                    <div class="border-t border-white/5 my-1"></div>
                    <button onClick={() => { setView('sync'); setUserMenuOpen(false); }} class="w-full text-left px-5 py-3 text-sm font-bold text-gray-300 hover:bg-white/5 flex items-center gap-3"><Icon name="import_export" class="text-[18px]"/> Data Sync</button>
                    <button onClick={() => signOut(auth)} class="w-full text-left px-5 py-3 text-sm font-bold text-gray-300 hover:bg-white/5 flex items-center gap-3"><Icon name="logout" class="text-[18px]"/> Logout</button>
                    <div class="border-t border-white/5 my-1"></div>
                    <button onClick={nukeCollection} class="w-full text-left px-5 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10 flex items-center gap-3"><Icon name="delete_forever" class="text-[18px]"/> Nuke Vault</button>
                  </div>
                </Show>
              </div>
            </div>
          </header>

          <main class="p-6 max-w-7xl mx-auto relative">
            <Show when={view() === 'dashboard'}><Dashboard watchlist={watchlist} openMovie={setDetailsId} setView={setView} showToast={showToast} setActiveVaultStatus={setActiveVaultStatus} /></Show>
            <Show when={view() === 'watchlist'}><Vault watchlist={watchlist} openMovie={setDetailsId} activeStatus={activeVaultStatus()} onFilterChange={setActiveVaultStatus} /></Show>
            <Show when={view() === 'franchises'}><FranchisesView watchlist={watchlist} franchises={franchises} uid={user().uid} openMovie={setDetailsId} showToast={showToast} /></Show>
            <Show when={view() === 'upcoming'}><UpcomingView watchlist={watchlist} uid={user().uid} showToast={showToast} /></Show>
            <Show when={view() === 'sync'}><DataSync watchlist={watchlist} uid={user().uid} showToast={showToast} /></Show>
          </main>

          <div class="fixed bottom-6 left-0 w-full px-4 flex justify-center z-50 pointer-events-none">
            <nav class="glass-surface backdrop-blur-xl w-full max-w-md rounded-full flex justify-around items-center px-2 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 pointer-events-auto">
              <NavBtn icon="dashboard" label="Home" active={view()==='dashboard'} onClick={() => setView('dashboard')} />
              <NavBtn icon="visibility" label="Vault" active={view()==='watchlist'} onClick={() => setView('watchlist')} />
              <div class="relative -mt-8 mx-1">
                  <button onClick={() => setSearchModal(true)} class="bg-gradient-to-tr from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14] w-14 h-14 rounded-full flex items-center justify-center shadow-xl shadow-[var(--primary)]/30 active:scale-95 transition-transform border-4 border-[#08090b]">
                      <Icon name="add" class="text-3xl font-black" />
                  </button>
              </div>
              <NavBtn icon="folder_special" label="Lists" active={view()==='franchises'} onClick={() => setView('franchises')} />
              <NavBtn icon="calendar_month" label="Upcoming" active={view()==='upcoming'} onClick={() => setView('upcoming')} />
            </nav>
          </div>

          <Show when={searchModal()}><SearchModal onClose={() => setSearchModal(false)} uid={user().uid} showToast={showToast} watchlist={watchlist()} /></Show>
          <Show when={detailsId()}><DetailsModal id={detailsId()} watchlist={watchlist()} franchises={franchises()} onClose={() => setDetailsId(null)} uid={user().uid} showToast={showToast} theme={theme} /></Show>
          <Show when={statsModal()}><InsightsModal watchlist={watchlist} onClose={() => setStatsModal(false)} /></Show>
          <Show when={settingsModal()}><SettingsModal currentTheme={theme()} setTheme={setTheme} onClose={() => setSettingsModal(false)} /></Show>
          
          <Show when={toast().show}>
            <div class="fixed bottom-28 left-1/2 -translate-x-1/2 glass-surface border border-[var(--primary)] text-white px-6 py-3 rounded-full shadow-2xl z-[999999] flex gap-2 items-center text-sm font-bold whitespace-nowrap animate-pop-in"><Icon name="check_circle" class="text-[var(--primary)]" fill /> {toast().msg}</div>
          </Show>
        </Show>
      </Show>
    </div>
    </ErrorBoundary>
  );
}

// --- SUB COMPONENTS ---

function LoadingScreen() {
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

const ThemeBtn = (props) => <button onClick={() => { props.set(props.id); props.onClose(); }} class={`w-full p-4 rounded-xl border ${props.curr===props.id?'border-[var(--primary)] bg-[var(--primary)]/10':'border-white/5 hover:bg-white/5'} flex gap-4 items-center transition-colors`}><div class="w-6 h-6 rounded-full shadow-lg" style={{background: props.hex}}></div><span class="font-bold">{props.name}</span></button>;
const NavBtn = (props) => <button onClick={props.onClick} class={`flex flex-col items-center gap-1 w-14 transition-colors ${props.active ? 'text-[var(--primary)]' : 'text-gray-500'}`}><Icon name={props.icon} fill={props.active} /><span class="text-[8px] font-bold uppercase tracking-wide">{props.label}</span></button>;

function SettingsModal(props) {
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

// 4. MOVIE CARD
const MovieCard = (props) => (
  <div onClick={props.onClick} class="group cursor-pointer animate-pop-in relative">
    <div class="aspect-[2/3] rounded-3xl overflow-hidden relative shadow-[0_8px_30px_rgb(0,0,0,0.5)] group-hover:-translate-y-2 transition-all duration-300 border border-white/10 group-hover:border-[var(--primary)]/50 bg-[#171921]">
      <Show when={props.movie.poster_path} fallback={<div class="w-full h-full flex items-center justify-center skeleton-bg"><Icon name="movie" class="text-4xl text-gray-600"/></div>}>
        <img src={`https://image.tmdb.org/t/p/w500${props.movie.poster_path}`} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
      </Show>
      <div class="absolute inset-0 bg-gradient-to-t from-[#08090b] via-[#08090b]/40 to-transparent opacity-90 transition-opacity group-hover:opacity-100 pointer-events-none"></div>
      
      <div class="absolute top-2 left-2 bg-black/40 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-full text-[8px] font-black text-[var(--primary)] uppercase tracking-wider">{props.movie.status === 'Plan to Watch' ? 'Planned' : (props.movie.status || 'NEW')}</div>
      <Show when={props.movie.tag}>
         <div class="absolute top-2 right-2 bg-black/40 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-full text-[8px] font-black text-white uppercase tracking-wider shadow-lg max-w-[60px] truncate">{props.movie.tag}</div>
      </Show>
      
      <div class="absolute bottom-0 left-0 w-full p-3 flex flex-col justify-end">
        <h4 class="text-xs font-black truncate text-white drop-shadow-md mb-1 leading-tight">{props.movie.title || props.movie.name}</h4>
        
        <p class="text-[9px] text-gray-300 font-bold mb-1 flex items-center gap-1 drop-shadow-md whitespace-nowrap overflow-hidden">
            {(props.movie.release_date||'').split('-')[0] || 'N/A'} • {props.movie.media_type === 'tv' ? 'Series' : 'Movie'} <Show when={props.movie.runtime > 0}>• {formatRuntime(props.movie.runtime)}</Show>
        </p>

        {/* Fixed Rating Pill Grid - Ensures no cut-off on small screens */}
        <div class="grid grid-cols-3 gap-1 mt-1 w-full">
            <span class="text-[8px] py-1 rounded-md bg-black/60 border border-white/5 font-black text-[#f5c518] flex items-center justify-center gap-0.5 shadow-sm truncate"><Icon name="star" class="text-[10px]" fill/> {props.movie.imdbRating || '-'}</span>
            <span class="text-[8px] py-1 rounded-md bg-black/60 border border-white/5 font-black text-red-500 flex items-center justify-center gap-0.5 shadow-sm truncate">🍅 {props.movie.rtRating || '-'}</span>
            <span class="text-[8px] py-1 rounded-md bg-[var(--primary)]/20 border border-[var(--primary)]/20 font-black text-[var(--primary)] flex items-center justify-center gap-0.5 shadow-sm truncate"><Icon name="person" class="text-[10px]" fill/> {props.movie.rating || '-'}</span>
        </div>
      </div>
    </div>
  </div>
);

// 5. DASHBOARD
function Dashboard(props) {
  const stats = createMemo(() => ({ total: props.watchlist().length, completed: props.watchlist().filter(m => m.status === 'Completed').length, watching: props.watchlist().filter(m => m.status === 'Watching').length, planned: props.watchlist().filter(m => m.status === 'Planned' || m.status === 'Plan to Watch').length }));
  return (
    <div class="animate-fade-in pb-4">
      <div onClick={() => { const p = props.watchlist().filter(m => m.status === 'Planned' || m.status === 'Plan to Watch'); if(p.length) { props.showToast("🎲 Picking random title..."); setTimeout(()=>props.openMovie(p[Math.floor(Math.random()*p.length)].id), 500); } else alert("Planned list is empty!"); }} class="bg-gradient-to-br from-[var(--secondary)] to-[var(--primary)] p-8 rounded-[2rem] mb-6 flex justify-between items-center shadow-2xl shadow-[var(--primary)]/20 cursor-pointer text-[#0c0e14] active:scale-95 transition-transform relative overflow-hidden group">
        <div class="relative z-10"><h2 class="text-3xl font-black font-headline flex items-center gap-2 mb-1"><Icon name="casino" fill class="text-3xl" /> What to Watch?</h2><p class="text-[10px] font-bold uppercase tracking-widest opacity-80">Let the vault decide</p></div>
        <Icon name="arrow_forward_ios" class="opacity-40 text-3xl relative z-10 group-hover:translate-x-2 transition-transform" />
        <div class="absolute -right-6 -bottom-6 opacity-10 transform rotate-12 scale-150"><Icon name="casino" fill class="text-9xl" /></div>
      </div>
      
      <div class="grid grid-cols-2 gap-4 mb-8">
        <div class="glass-surface p-6 rounded-[2rem] relative overflow-hidden flex flex-col justify-end min-h-[120px] group hover:border-[var(--primary)]/30 transition-colors col-span-2 sm:col-span-1">
          <Icon name="inventory_2" class="absolute -right-4 -bottom-4 text-7xl text-white/5 group-hover:scale-110 transition-transform" fill />
          <p class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1 relative z-10">Total Titles</p>
          <h3 class="text-4xl font-headline font-black text-white relative z-10">{stats().total}</h3>
        </div>
        <div class="glass-surface p-6 rounded-[2rem] relative overflow-hidden flex flex-col justify-end min-h-[120px] group hover:border-[var(--primary)]/30 transition-colors col-span-2 sm:col-span-1 bg-gradient-to-br from-[var(--primary)]/5 to-transparent">
          <Icon name="done_all" class="absolute -right-4 -bottom-4 text-7xl text-[var(--primary)]/10 group-hover:scale-110 transition-transform" fill />
          <p class="text-[10px] text-[var(--primary)] opacity-80 uppercase font-bold tracking-widest mb-1 relative z-10">Completed</p>
          <h3 class="text-4xl font-headline font-black text-[var(--primary)] relative z-10">{stats().completed}</h3>
        </div>
        <div onClick={() => { props.setActiveVaultStatus('Watching'); props.setView('watchlist'); }} class="glass-surface p-5 rounded-[1.5rem] relative overflow-hidden flex flex-col justify-center items-center text-center group hover:border-white/10 transition-colors cursor-pointer active:scale-95">
          <Icon name="play_circle" class="absolute inset-0 m-auto text-6xl text-white/5 group-hover:scale-110 transition-transform" fill />
          <h3 class="text-3xl font-headline font-black text-[var(--secondary)] relative z-10 mb-1">{stats().watching}</h3>
          <p class="text-[9px] text-gray-500 uppercase font-bold tracking-widest relative z-10">Watching</p>
        </div>
        <div onClick={() => { props.setActiveVaultStatus('Planned'); props.setView('watchlist'); }} class="glass-surface p-5 rounded-[1.5rem] relative overflow-hidden flex flex-col justify-center items-center text-center group hover:border-white/10 transition-colors cursor-pointer active:scale-95">
          <Icon name="bookmark" class="absolute inset-0 m-auto text-6xl text-white/5 group-hover:scale-110 transition-transform" fill />
          <h3 class="text-3xl font-headline font-black text-gray-300 relative z-10 mb-1">{stats().planned}</h3>
          <p class="text-[9px] text-gray-500 uppercase font-bold tracking-widest relative z-10">Planned</p>
        </div>
      </div>
      
      <div class="flex justify-between items-end mb-5 px-1"><h3 class="text-xl font-bold font-headline">Recently Added</h3><button onClick={()=>{props.setActiveVaultStatus('all'); props.setView('watchlist');}} class="text-[var(--primary)] text-[10px] font-bold uppercase tracking-widest hover:underline flex items-center gap-1">View All <Icon name="chevron_right" class="text-[14px]"/></button></div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4"><For each={props.watchlist().slice(0, 6)}>{(m) => <MovieCard movie={m} onClick={() => props.openMovie(m.id)} />}</For></div>
    </div>
  );
}

// 6. VAULT
function Vault(props) {
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


// 7. FRANCHISES
function AddToFolderModal(props) {
  const [search, setSearch] = createSignal('');
  onMount(() => { document.body.style.overflow = 'hidden'; }); onCleanup(() => { document.body.style.overflow = ''; });
  const available = createMemo(() => { const q = search().toLowerCase(); return props.watchlist().filter(m => m.franchises?.[props.folderId] === undefined).filter(m => !q || (m.title || m.name || '').toLowerCase().includes(q)); });

  const addToFolder = async (m) => {
    const nextOrder = props.currentMovies().length + 1;
    await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(m.id)), { [`franchises.${props.folderId}`]: nextOrder });
    props.showToast(`Added!`);
  };

  return (
    <div class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[999999] animate-fade-in" onClick={props.onClose}>
      <div class="w-full max-w-lg bg-[#08090b]/97 rounded-[2rem] border border-white/10 shadow-2xl animate-pop-in overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div class="p-5 border-b border-white/5 flex justify-between items-center shrink-0"><h3 class="font-black text-lg text-white flex items-center gap-2"><Icon name="playlist_add" class="text-[var(--primary)]"/> Vault se Add karo</h3><button onClick={props.onClose} class="bg-white/5 p-2 rounded-full active:scale-95 hover:bg-white/10 transition-all"><Icon name="close" class="text-gray-400"/></button></div>
        <div class="p-4 border-b border-white/5 shrink-0"><div class="flex items-center gap-3 glass-surface rounded-2xl px-4 py-3 border border-white/10 focus-within:border-[var(--primary)]/50 transition-colors"><Icon name="search" class="text-gray-500 text-sm shrink-0"/><input autofocus value={search()} onInput={e => setSearch(e.target.value)} placeholder="Movie ya series dhundo..." class="bg-transparent border-none w-full outline-none text-white text-sm font-medium placeholder-gray-600"/></div></div>
        <div class="overflow-y-auto hide-scrollbar p-3 space-y-2">
          <Show when={available().length === 0}><div class="text-center py-12 text-gray-500"><Icon name="check_circle" class="text-4xl mb-2 opacity-30"/><p class="text-sm font-bold">Saari movies folder mein hain already!</p></div></Show>
          <For each={available()}>{(m) => (
            <div class="flex items-center gap-3 glass-surface p-3 rounded-2xl border border-white/5 hover:border-[var(--primary)]/30 transition-all group">
              <Show when={m.poster_path} fallback={<div class="w-10 h-14 bg-white/5 rounded-xl shrink-0 flex items-center justify-center"><Icon name="movie" class="text-gray-600 text-sm"/></div>}><img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} class="w-10 h-14 rounded-xl object-cover shrink-0 bg-[#171921]"/></Show>
              <div class="flex-1 min-w-0"><p class="font-bold text-sm text-white truncate">{m.title || m.name}</p><p class="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">{(m.release_date || m.first_air_date || '').split('-')[0]} • {m.media_type === 'tv' ? 'Series' : 'Movie'}</p></div>
              <button onClick={() => addToFolder(m)} class="w-9 h-9 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center hover:bg-[var(--primary)] hover:text-[#0c0e14] transition-all active:scale-95 shrink-0"><Icon name="add" class="text-lg"/></button>
            </div>
          )}</For>
        </div>
      </div>
    </div>
  );
}

function FranchisesView(props) {
  const [currentFolder, setCurrentFolder] = createSignal(null);
  const [sortMode, setSortMode] = createSignal('order');
  const [showAddModal, setShowAddModal] = createSignal(false);

  const subFolders = createMemo(() => props.franchises().filter(f => f.parentId === currentFolder()).sort((a,b) => a.name.localeCompare(b.name)));
  const currentMovies = createMemo(() => {
    let list = props.watchlist().filter(m => m.franchises && m.franchises[currentFolder()] !== undefined);
    return list.sort((a, b) => sortMode() === 'year' ? (parseInt(String(b.release_date||b.first_air_date||'').substring(0,4))||0) - (parseInt(String(a.release_date||a.first_air_date||'').substring(0,4))||0) : a.franchises[currentFolder()] - b.franchises[currentFolder()]);
  });
  
  const createFolder = async () => { const n = prompt("Folder Name:"); if(n && n.trim()) { await addDoc(collection(db, 'users', props.uid, 'franchises'), { name: n.trim(), parentId: currentFolder(), createdAt: serverTimestamp() }); props.showToast("Folder created!"); } };
  const moveMovie = async (index, dir) => { let arr = [...currentMovies()]; if (index + dir < 0 || index + dir >= arr.length) return; const batch = writeBatch(db); [arr[index], arr[index+dir]] = [arr[index+dir], arr[index]]; arr.forEach((m, i) => batch.update(doc(db, 'users', props.uid, 'watchlist', String(m.id)), { [`franchises.${currentFolder()}`]: i + 1 })); await batch.commit(); };
  const removeFromFolder = async (m) => { if(!confirm(`"${m.title || m.name}" ko folder se hatayein?`)) return; const updated = { ...m.franchises }; delete updated[currentFolder()]; await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(m.id)), { franchises: updated }); props.showToast("Removed from folder"); };

  return (
    <div class="pb-10 animate-fade-in">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-3xl font-headline font-black drop-shadow-md">Lists</h2>
        <Show when={!currentFolder()} fallback={<button onClick={() => setShowAddModal(true)} class="bg-[var(--primary)] text-[#0c0e14] px-4 py-2 rounded-full text-xs font-black border border-[var(--primary)] active:scale-95 transition-all shadow-lg flex items-center gap-1"><Icon name="playlist_add" class="text-[16px]"/> Add Movie</button>}>
          <button onClick={createFolder} class="bg-white/10 text-white px-4 py-2 rounded-full text-xs font-bold border border-white/5 hover:bg-white/20 active:scale-95 transition-all shadow-lg flex items-center gap-1"><Icon name="add" class="text-[16px]"/> Folder</button>
        </Show>
      </div>

      <Show when={currentFolder()}><button onClick={() => setCurrentFolder(null)} class="mb-6 glass-surface px-4 py-2 rounded-full text-white text-[10px] font-bold uppercase flex items-center gap-2 tracking-widest w-max active:scale-95 transition-transform"><Icon name="arrow_back" class="text-[14px]"/> Back</button></Show>
      
      <Show when={subFolders().length > 0}>
        <div class="flex flex-col gap-5 mb-10">
          <For each={subFolders()}>{(f) => {
            const firstMovie = () => props.watchlist().find(m => m.franchises && m.franchises[f.id] !== undefined);
            const bgImage = () => firstMovie()?.backdrop_path ? `https://image.tmdb.org/t/p/w500${firstMovie().backdrop_path}` : 'none';
            const movieCount = () => props.watchlist().filter(m => m.franchises && m.franchises[f.id] !== undefined).length;
            return (
              <div onClick={() => setCurrentFolder(f.id)} class="relative rounded-[2rem] cursor-pointer group hover:-translate-y-1 transition-all shadow-2xl flex flex-col justify-end min-h-[160px] overflow-hidden border border-white/10 bg-[#171921]">
                <Show when={bgImage() !== 'none'}><img src={bgImage()} class="absolute inset-0 w-full h-full object-cover z-0"/><div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10"></div></Show>
                <div class="relative z-20 p-6 sm:p-8 w-full h-full flex flex-col justify-end">
                  <div class="w-full pr-12"><p class="text-[10px] text-[var(--primary)] font-bold uppercase tracking-widest mb-1 opacity-90 drop-shadow-md">Collection</p><h3 class="font-black font-headline text-2xl sm:text-3xl text-white leading-tight drop-shadow-lg">{f.name}</h3><p class="text-[10px] text-gray-300 mt-1 font-bold">{movieCount()} titles</p></div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); confirm("Delete folder?") && deleteDoc(doc(db, 'users', props.uid, 'franchises', f.id)); }} class="absolute top-4 right-4 z-30 text-white hover:text-red-500 w-10 h-10 flex items-center justify-center bg-black/50 border border-white/20 rounded-full backdrop-blur-md transition-all active:scale-95"><Icon name="delete" class="text-[18px]"/></button>
                <Show when={bgImage() === 'none'}><Icon name="folder" class="absolute right-6 top-1/2 -translate-y-1/2 text-white/5 text-8xl pointer-events-none z-10" fill /></Show>
              </div>
            );
          }}</For>
        </div>
      </Show>

      <Show when={currentFolder()}>
        <div class="flex justify-between items-end mb-4 px-2">
          <h3 class="font-bold text-xl font-headline">Titles <span class="text-[var(--primary)] text-sm">({currentMovies().length})</span></h3>
          <select value={sortMode()} onChange={e => setSortMode(e.target.value)} class="bg-[#08090b] text-[var(--primary)] text-[10px] font-bold uppercase outline-none border border-white/10 rounded-full px-3 py-1.5 shadow-lg">
            <option value="order">Sort: Custom</option>
            <option value="year">Sort: Year</option>
          </select>
        </div>
        <Show when={currentMovies().length === 0}><div class="text-center py-16 opacity-40"><Icon name="video_library" class="text-5xl text-[var(--primary)] mb-3"/><p class="text-sm font-bold text-gray-300">Folder empty hai</p><p class="text-[11px] text-gray-500 mt-1">"Add Movie" button se vault se add karo</p></div></Show>
        <div class="space-y-3">
          <For each={currentMovies()}>{(m, i) => (
            <div class="flex items-center gap-3 glass-surface p-3 rounded-[1.5rem] border border-white/5 shadow-lg group hover:border-white/20 transition-all">
              <Show when={sortMode() === 'order'}>
                <div class="flex flex-col items-center justify-center bg-white/5 rounded-xl p-1 shrink-0"><button onClick={() => moveMovie(i(), -1)} class={`text-gray-500 hover:text-white ${i()===0?'opacity-20 pointer-events-none':''}`}><Icon name="keyboard_arrow_up" class="text-[18px]"/></button><span class="text-[10px] font-black text-[var(--primary)]">{i()+1}</span><button onClick={() => moveMovie(i(), 1)} class={`text-gray-500 hover:text-white ${i()===currentMovies().length-1?'opacity-20 pointer-events-none':''}`}><Icon name="keyboard_arrow_down" class="text-[18px]"/></button></div>
              </Show>
              <div class="flex-1 flex items-center gap-3 cursor-pointer min-w-0" onClick={() => props.openMovie(m.id)}>
                <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} class="w-11 h-16 rounded-xl object-cover shadow-md shrink-0"/>
                <div class="min-w-0"><p class="font-bold text-sm text-gray-100 group-hover:text-[var(--primary)] transition-colors truncate">{m.title || m.name}</p><p class="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{(m.release_date||m.first_air_date||'').split('-')[0]}</p></div>
              </div>
              <button onClick={() => removeFromFolder(m)} class="w-8 h-8 rounded-full text-gray-600 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all active:scale-95 shrink-0"><Icon name="remove_circle" class="text-[18px]"/></button>
            </div>
          )}</For>
        </div>
      </Show>
      <Show when={showAddModal() && currentFolder()}><AddToFolderModal uid={props.uid} folderId={currentFolder()} watchlist={props.watchlist} currentMovies={currentMovies} showToast={props.showToast} onClose={() => setShowAddModal(false)} /></Show>
    </div>
  );
}

// 8. UPCOMING RADAR
function UpcomingView(props) {
  const [activeTab, setActiveTab] = createSignal('Indian');
  const [mediaType, setMediaType] = createSignal('movie'); 
  const [lang, setLang] = createSignal('all');
  const [selectedDate, setSelectedDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [movies, setMovies] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [previewMovie, setPreviewMovie] = createSignal(null);

  createEffect(() => {
    setLoading(true);
    const dateObj = new Date(selectedDate());
    const startDate = dateObj.toISOString().split('T')[0];
    dateObj.setDate(dateObj.getDate() + 30); 
    const endDate = dateObj.toISOString().split('T')[0];
    
    let mUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&primary_release_date.gte=${startDate}&primary_release_date.lte=${endDate}&sort_by=popularity.desc`;
    let tUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&air_date.gte=${startDate}&air_date.lte=${endDate}&sort_by=popularity.desc&without_genres=10764,10767`;
    
    if (activeTab() === 'Indian') {
        mUrl += '&with_origin_country=IN'; tUrl += '&with_origin_country=IN';
        if (lang() !== 'all') { mUrl += `&with_original_language=${lang()}`; tUrl += `&with_original_language=${lang()}`; }
    }
    
    Promise.all([
        fetch(mUrl + '&page=1').then(r=>r.json()), fetch(mUrl + '&page=2').then(r=>r.json()),
        fetch(tUrl + '&page=1').then(r=>r.json()), fetch(tUrl + '&page=2').then(r=>r.json())
    ]).then(async ([m1, m2, t1, t2]) => { 
        let combinedMovies = [...(m1.results||[]), ...(m2.results||[])].map(m => ({...m, media_type: 'movie', calc_date: m.release_date}));
        let tvBaseList = [...(t1.results||[]), ...(t2.results||[])];
        
        const tvDetailsPromises = tvBaseList.slice(0, 25).map(t => fetch(`https://api.themoviedb.org/3/tv/${t.id}?api_key=${TMDB_KEY}`).then(r=>r.json()).catch(()=>null));
        const tvDetailsData = await Promise.all(tvDetailsPromises);
        
        let combinedTv = tvDetailsData.filter(Boolean).map(t => {
            let nextEp = t.next_episode_to_air;
            let d = nextEp ? nextEp.air_date : (t.first_air_date || startDate);
            let isReturning = !!nextEp;
            let epTag = nextEp ? `S${nextEp.season_number} E${nextEp.episode_number}` : 'New Drop';
            return {...t, media_type: 'tv', title: t.name, release_date: t.first_air_date, calc_date: d, isReturning, epTag};
        });

        const vaultIds = new Set(props.watchlist().map(w => String(w.id)));
        combinedTv = combinedTv.filter(t => !t.isReturning || vaultIds.has(String(t.id)));

        if (activeTab() === 'International') {
            const isIndian = (item) => (item.origin_country || []).includes('IN') || ['hi', 'te', 'ta', 'ml', 'bn'].includes(item.original_language);
            combinedMovies = combinedMovies.filter(m => !isIndian(m));
            combinedTv = combinedTv.filter(t => !isIndian(t));
        }

        let resList = [...combinedMovies, ...combinedTv].filter(item => item.calc_date && item.poster_path);
        resList.sort((a,b) => new Date(a.calc_date) - new Date(b.calc_date));
        
        const unique = []; const seen = new Set();
        for(const item of resList) { if(!seen.has(item.id)) { seen.add(item.id); unique.push(item); } }
        setMovies(unique); setLoading(false); 
    }).catch(()=>setLoading(false));
  });

  const handleAdd = async (m) => {
    if(props.watchlist().some(item => String(item.id) === String(m.id))) return props.showToast("Already in vault!");
    const endpoint = m.media_type === 'tv' ? 'tv' : 'movie';
    const detailRes = await fetch(`https://api.themoviedb.org/3/${endpoint}/${m.id}?api_key=${TMDB_KEY}`); const fullData = await detailRes.json();
    await setDoc(doc(db, 'users', props.uid, 'watchlist', String(m.id)), {
      id: m.id, title: m.title || m.name, poster_path: m.poster_path, backdrop_path: m.backdrop_path, media_type: m.media_type, status: 'Planned', addedAt: serverTimestamp(),
      release_date: m.calc_date || '', region: activeTab() === 'Indian' ? 'Indian' : 'International', season: 1, episode: 0, totalEps: fullData.number_of_episodes || 0, runtime: fullData.runtime || fullData.episode_run_time?.[0] || 0
    }); props.showToast("Added to Vault"); setPreviewMovie(null);
  };

  return (
    <div class="pb-10 animate-fade-in">
      <h2 class="text-3xl font-headline font-black drop-shadow-md mb-6">Upcoming</h2>
      <div class="flex gap-2 glass-surface p-1.5 rounded-2xl mb-4 border border-white/5 shadow-lg"><button onClick={()=>{setActiveTab('Indian'); setLang('all');}} class={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab()==='Indian'?'bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14] shadow-md':'text-gray-400 hover:text-white'}`}>Indian</button><button onClick={()=>{setActiveTab('International'); setLang('all');}} class={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab()==='International'?'bg-gradient-to-r from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14] shadow-md':'text-gray-400 hover:text-white'}`}>International</button></div>
      <div class="flex gap-2 glass-surface p-1.5 rounded-2xl mb-4 border border-white/5 shadow-lg"><button onClick={()=>setMediaType('movie')} class={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${mediaType()==='movie'?'bg-[var(--primary)] text-[#0c0e14] shadow-md':'text-gray-400 hover:text-white'}`}>Movies</button><button onClick={()=>setMediaType('tv')} class={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${mediaType()==='tv'?'bg-[var(--primary)] text-[#0c0e14] shadow-md':'text-gray-400 hover:text-white'}`}>Series</button></div>

      <Show when={activeTab() === 'Indian'}>
        <div class="flex gap-2 overflow-x-auto hide-scrollbar mb-6 glass-surface p-2 rounded-2xl border border-white/5 shadow-inner">
            <For each={['all', 'hi', 'te', 'ta', 'ml']}>{(l) => (<button onClick={()=>setLang(l)} class={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${lang()===l?'bg-[var(--primary)]/20 text-[var(--primary)]':'text-gray-400 hover:text-white'}`}>{l === 'all' ? 'All' : l.toUpperCase()}</button>)}</For>
        </div>
      </Show>

      <div class="flex justify-center mb-8">
          <div class="glass-surface p-2 pr-6 rounded-[2rem] flex items-center gap-4 border border-white/10 focus-within:border-[var(--primary)]/50 transition-colors shadow-xl relative overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/10 to-transparent pointer-events-none"></div>
              <div class="bg-[var(--primary)] w-12 h-12 rounded-full flex items-center justify-center shadow-[0_0_15px_var(--primary)] relative z-10"><Icon name="calendar_month" class="text-[#0c0e14] text-xl"/></div>
              <div class="flex flex-col relative z-10">
                  <span class="text-[9px] uppercase font-black text-gray-400 tracking-widest mb-0.5">Scan Radar From</span>
                  <input type="date" value={selectedDate()} onInput={e => setSelectedDate(e.target.value)} class="bg-transparent border-none outline-none text-white font-black text-sm [color-scheme:dark] p-0 m-0 w-32" />
              </div>
          </div>
      </div>

      <Show when={loading()} fallback={
        <Show when={movies().filter(m => m.media_type === mediaType()).length > 0} fallback={<div class="text-center p-12 glass-surface rounded-[2rem] text-gray-500 text-sm font-bold border border-white/5 flex flex-col items-center gap-3"><Icon name="event_busy" class="text-4xl opacity-50"/> No releases found.</div>}>
          <div class="space-y-6 relative before:absolute before:inset-0 before:ml-[38px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
            <For each={movies().filter(m => m.media_type === mediaType())}>{(m) => {
              const day = new Date(m.calc_date).getDate(); const month = new Date(m.calc_date).toLocaleString('default', { month: 'short' });
              return (
              <div onClick={() => setPreviewMovie(m)} class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group cursor-pointer">
                <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#08090b] border-4 border-[var(--primary)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_15px_var(--primary)] z-10 ml-5 md:ml-0 overflow-hidden"><div class="flex flex-col items-center justify-center leading-none"><span class="text-[10px] font-black text-white">{day}</span><span class="text-[7px] font-bold text-[var(--primary)] uppercase">{month}</span></div></div>
                <div class="w-[calc(100%-5rem)] md:w-[calc(50%-3rem)] glass-surface p-3 rounded-[1.5rem] border border-white/5 hover:border-[var(--primary)]/50 transition-all shadow-lg flex gap-4 animate-pop-in">
                  <Show when={m.poster_path} fallback={<div class="w-16 h-24 bg-[#171921] rounded-xl flex items-center justify-center"><Icon name="movie" class="text-gray-600"/></div>}><img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} class="w-16 h-24 rounded-xl object-cover shadow-md bg-[#171921]" /></Show>
                  <div class="flex-1 flex flex-col justify-center py-1 min-w-0">
                    <p class="font-bold text-sm text-gray-100 line-clamp-2 group-hover:text-[var(--primary)] transition-colors">{m.title}</p>
                    <div class="flex items-center gap-2 mt-2">
                        <Show when={m.media_type === 'tv'} fallback={<span class="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded font-black uppercase tracking-widest flex items-center gap-1 w-max"><Icon name="theaters" class="text-[10px]"/> Theatrical</span>}>
                            <span class="text-[8px] bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 px-2 py-1 rounded font-black uppercase tracking-widest flex items-center gap-1 w-max"><Icon name="tv" class="text-[10px]"/> {m.epTag || 'Series Drop'}</span>
                        </Show>
                    </div>
                  </div>
                </div>
              </div>
            )}}</For>
          </div>
        </Show>
      }><div class="text-center p-12 flex flex-col items-center gap-4 text-[var(--primary)] animate-pulse font-bold text-sm tracking-widest uppercase"><Icon name="radar" class="text-5xl animate-spin"/> Scanning Radar...</div></Show>

      <Show when={previewMovie()}><UpcomingDetailsModal movie={previewMovie()} onClose={() => setPreviewMovie(null)} onAdd={() => handleAdd(previewMovie())} /></Show>
    </div>
  );
}

function UpcomingDetailsModal(props) {
  const [details, setDetails] = createSignal(props.movie);
  const [trailerKey, setTrailerKey] = createSignal(null);
  const [playTrailer, setPlayTrailer] = createSignal(false);
  const [ottPlatform, setOttPlatform] = createSignal('');

  onMount(() => { document.body.style.overflow = 'hidden'; }); onCleanup(() => { document.body.style.overflow = ''; });
  createEffect(() => {
      const mediaType = props.movie.media_type || 'movie';
      fetch(`https://api.themoviedb.org/3/${mediaType}/${props.movie.id}?api_key=${TMDB_KEY}&append_to_response=videos,credits,watch/providers`).then(r=>r.json()).then(d=>{
          setDetails(d); const vids = d.videos ? d.videos.results : null;
          if(vids){ let t = vids.find(x=>x.site==='YouTube' && (x.type==='Trailer' || x.type==='Teaser')) || vids.find(x=>x.site==='YouTube'); if(t) setTrailerKey(t.key); }
          const inProviders = d['watch/providers']?.results?.IN; let foundProviders = [];
          if(inProviders) { const providers = [...(inProviders.flatrate || []), ...(inProviders.free || []), ...(inProviders.ads || []), ...(inProviders.buy || [])]; foundProviders = [...new Set(providers.map(p => cleanPlatform(p.provider_name)))].filter(Boolean); }
          if (foundProviders.length === 0 && d.networks) { foundProviders = [...new Set(d.networks.map(n => cleanPlatform(n.name)))].filter(Boolean); }
          if(foundProviders.length > 0) setOttPlatform(foundProviders.join(', '));
      }).catch(()=>{});
  });

  const runtimeVal = () => details().runtime || details().episode_run_time?.[0] || 0;

  return (
      <div class="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[999999] animate-fade-in" onClick={props.onClose}>
          <div class="w-full max-w-xl bg-[#0c0e14] rounded-3xl overflow-hidden border border-white/10 relative max-h-[90vh] shadow-2xl animate-pop-in flex flex-col" onClick={e=>e.stopPropagation()}>
              <button onClick={props.onClose} class="absolute top-4 right-4 z-[100] bg-black/50 backdrop-blur-md border border-white/10 p-2.5 rounded-full hover:bg-black/80 active:scale-95 transition-all"><Icon name="close" class="text-sm text-white"/></button>
              <div class="overflow-y-auto hide-scrollbar w-full">
                  <div class="relative h-48 md:h-64 bg-black">
                      <Show when={!playTrailer()} fallback={<iframe class="w-full h-full absolute inset-0 z-10" src={`https://www.youtube.com/embed/${trailerKey()}?autoplay=1&rel=0`} frameborder="0" allowfullscreen></iframe>}>
                          <Show when={details().backdrop_path} fallback={<div class="w-full h-full flex items-center justify-center text-gray-700 bg-[#171921]"><Icon name="movie" class="text-6xl"/></div>}><img src={`https://image.tmdb.org/t/p/original${details().backdrop_path}`} class="w-full h-full object-cover opacity-40" /></Show>
                          <div class="absolute inset-0 bg-gradient-to-t from-[#0c0e14] to-transparent pointer-events-none" />
                          <Show when={trailerKey()} fallback={<div class="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-gray-400 border border-white/5">No Video Available</div>}>
                              <button onClick={() => setPlayTrailer(true)} class="absolute inset-0 flex items-center justify-center z-10 group"><div class="w-14 h-14 bg-[var(--primary)]/30 backdrop-blur-md rounded-full flex items-center justify-center border border-[var(--primary)]/50 group-hover:scale-110 transition-transform shadow-lg"><Icon name="play_arrow" fill class="text-white text-3xl"/></div></button>
                          </Show>
                      </Show>
                  </div>
                  <div class="p-6 md:px-8 pb-28 -mt-16 relative z-10">
                      <h2 class="text-3xl font-black drop-shadow-md mb-2">{details().title || details().name}</h2>
                      <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6">{details().release_date || details().first_air_date} • {props.movie.media_type === 'tv' ? 'SERIES' : 'MOVIE'}<Show when={runtimeVal() > 0}> • {formatRuntime(runtimeVal())}</Show></p>
                      <p class="text-gray-400 text-sm mb-6 leading-relaxed">{details().overview || 'No overview available.'}</p>
                      <div class="glass-surface p-5 rounded-2xl border border-white/5 space-y-3 mb-6">
                          <SafeInfoRow icon="format_list_bulleted" label="Genre" value={<span class="text-xs text-gray-300">{(details().genres||[]).map(g=>g.name).join(', ')||'N/A'}</span>} />
                          <SafeInfoRow icon="language" label="Language" value={<span class="text-xs text-gray-300">{(details().spoken_languages?.[0]?.english_name) || (details().original_language ? details().original_language.toUpperCase() : 'N/A')}</span>} />
                          <Show when={ottPlatform()}><SafeInfoRow icon="connected_tv" label="Platform" value={<span class="text-xs font-bold text-[var(--secondary)]">{ottPlatform()}</span>} /></Show>
                      </div>
                      <Show when={details().credits || details().created_by}>
                        <div class="mb-8"><h3 class="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-3 px-1">Cast & Crew</h3><div class="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
                                <Show when={details().credits?.crew?.find(c => c.job === 'Director') || details().created_by?.[0]}>{(dir) => { const d = dir(); return (
                                        <div class="flex flex-col items-center min-w-[70px] shrink-0"><img src={d.profile_path ? `https://image.tmdb.org/t/p/w200${d.profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${d.name}&backgroundColor=171921`} class="w-12 h-12 rounded-full object-cover border border-[var(--primary)] mb-2 bg-[#171921]" /><p class="text-[9px] font-bold text-center text-white truncate w-full">{d.name}</p><p class="text-[8px] text-[var(--primary)] font-bold text-center uppercase tracking-widest mt-0.5">{details().created_by ? 'Creator' : 'Director'}</p></div>
                                )}}</Show>
                                <For each={details().credits?.cast?.slice(0, 5)}>{(c) => (<div class="flex flex-col items-center min-w-[70px] shrink-0"><img src={c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${c.name}&backgroundColor=171921`} class="w-12 h-12 rounded-full object-cover border border-white/10 mb-2 bg-[#171921]" /><p class="text-[9px] font-bold text-center text-white truncate w-full">{c.name}</p><p class="text-[8px] text-gray-500 text-center uppercase truncate w-full mt-0.5">{c.character}</p></div>)}</For>
                            </div></div>
                      </Show>
                      <button onClick={props.onAdd} class="w-full bg-[var(--primary)] text-[#0c0e14] font-bold py-4 rounded-xl text-sm uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-[var(--primary)]/20"><Icon name="add_circle" fill /> Add to Vault</button>
                  </div>
              </div>
          </div>
      </div>
  );
}

// 9. DETAILS MODAL (Ultimate Restore + Rating Fix)
function DetailsModal(props) {
  const movie = createMemo(() => props.watchlist.find(m => String(m.id) === String(props.id)));
  const [details, setDetails] = createSignal({});
  const [isEdit, setIsEdit] = createSignal(false); const [trailerKey, setTrailerKey] = createSignal(null); const [playTrailer, setPlayTrailer] = createSignal(false);
  const [showPlayer, setShowPlayer] = createSignal(false); const [activeServer, setActiveServer] = createSignal('VidLink');
  const [omdbData, setOmdbData] = createSignal({ imdb: '-', rt: '-' });
  const [form, setForm] = createSignal({ status: '', rating: '', watchDate: '', notes: '', region: '', season: 1, episode: 1, tag: '', platforms: '', genres: '' });
  
  onMount(() => { document.body.style.overflow = 'hidden'; }); onCleanup(() => { document.body.style.overflow = ''; });
  const allAvailablePlatforms = createMemo(() => [...new Set(props.watchlist.flatMap(m => getSafePlatforms(m)))].filter(Boolean).sort());

  createEffect(() => { 
      if(movie()) { 
          setForm({ status: movie().status||'Planned', rating: movie().rating||'', watchDate: typeof movie().watchDate==='string'?movie().watchDate:'', notes: typeof movie().notes==='string'?movie().notes:'', region: movie().region||'International', season: movie().season||1, episode: movie().episode||1, tag: movie().tag||'', platforms: getSafePlatforms(movie()).join(', '), genres: getSafeGenres(movie()).join(', ') }); 
          
          fetch(`https://api.themoviedb.org/3/${movie().media_type||'movie'}/${movie().id}?api_key=${TMDB_KEY}&append_to_response=videos,credits`).then(r=>r.json()).then(d=>{ 
              setDetails(d);
              const v = d?.videos?.results; if(v){ let t = v.find(x=>x.site==='YouTube'&&x.type==='Trailer')||v.find(x=>x.site==='YouTube'&&x.type==='Teaser')||v.find(x=>x.site==='YouTube'); if(t) setTrailerKey(t.key); } 
          });

          // Fetch OMDb Rating
          const title = movie().title || movie().name;
          fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`).then(r=>r.json()).then(d=>{
              if(d.Response === 'True') {
                  const rt = d.Ratings?.find(r=>r.Source === 'Rotten Tomatoes')?.Value || '-';
                  setOmdbData({ imdb: d.imdbRating || '-', rt: rt });
                  updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), { imdbRating: d.imdbRating || '-', rtRating: rt.replace('%','') });
              }
          });
      } 
  });

  const togglePlatform = (p) => { let curr = form().platforms.split(',').map(s=>s.trim()).filter(Boolean); if(curr.includes(p)) curr = curr.filter(x=>x!==p); else curr.push(p); setForm({...form(), platforms: curr.join(', ')}); };
  const saveChanges = async () => { await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), { status: form().status, rating: parseFloat(form().rating)||0, watchDate: form().watchDate, notes: form().notes, region: form().region, season: parseInt(form().season)||1, episode: parseInt(form().episode)||1, tag: form().tag, genresList: form().genres.split(',').map(s=>s.trim()).filter(Boolean), platformsList: form().platforms.split(',').map(s=>cleanPlatform(s.trim())).filter(Boolean) }); props.showToast("Saved"); setIsEdit(false); };
  
  const isCompleted = createMemo(() => movie()?.status === 'Completed');
  const progressPct = createMemo(() => isCompleted() ? 100 : Math.min(((movie()?.episode||0) / (movie()?.totalEps||1)) * 100, 100));
  const movieFranchises = createMemo(() => props.franchises?.filter(f => movie()?.franchises?.[f.id] !== undefined).map(f => f.name).join(', '));
  const getStreamUrl = (server) => { const id = movie().id; const s = movie().season || 1; const e = movie().episode || 1; const pColor = 'b1a1ff'; if (server === 'VidLink') { return movie().media_type === 'tv' ? `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=${pColor}&autoplay=false` : `https://vidlink.pro/movie/${id}?primaryColor=${pColor}&autoplay=false`; } return movie().media_type === 'tv' ? `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` : `https://vidsrc.me/embed/movie?tmdb=${id}`; };

  return (
    <div class="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={props.onClose}>
      <div class="absolute inset-0 bg-[#08090b] overflow-hidden pointer-events-none"><Show when={movie()?.backdrop_path}><img src={`https://image.tmdb.org/t/p/w500${movie().backdrop_path}`} class="w-full h-full object-cover opacity-40 blur-3xl scale-125" /></Show><div class="absolute inset-0 bg-black/60"></div></div>
      <Show when={movie()}>
        <div class="w-full max-w-xl bg-[#08090b]/80 backdrop-blur-3xl rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 relative max-h-[95vh] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-pop-in flex flex-col" onClick={e=>e.stopPropagation()}>
          
          <button onClick={props.onClose} class="absolute top-4 right-4 z-[100] bg-black/50 backdrop-blur-md border border-white/10 p-2.5 rounded-full hover:bg-black/80 active:scale-95 transition-all"><Icon name="close" class="text-sm text-white"/></button>
          
          <div class="overflow-y-auto hide-scrollbar w-full">
              <div class="h-56 md:h-72 relative bg-black shrink-0">
                <Show when={!playTrailer()} fallback={<iframe class="w-full h-full absolute inset-0 z-10" src={`https://www.youtube.com/embed/${trailerKey()}?autoplay=1&rel=0`} frameborder="0" allowfullscreen></iframe>}>
                  <Show when={movie().backdrop_path} fallback={<div class="w-full h-full flex items-center justify-center text-gray-700 bg-[#171921]"><Icon name="movie" class="text-6xl"/></div>}><img src={`https://image.tmdb.org/t/p/original${movie().backdrop_path}`} class="w-full h-full object-cover opacity-60" /></Show>
                  <div class="absolute inset-0 bg-gradient-to-t from-[#08090b]/90 via-[#08090b]/40 to-transparent pointer-events-none" />
                  <Show when={trailerKey()}><button onClick={() => setPlayTrailer(true)} class="absolute inset-0 flex items-center justify-center z-10 group"><div class="w-16 h-16 bg-[var(--primary)]/30 backdrop-blur-md rounded-full flex items-center justify-center border border-[var(--primary)]/50 group-hover:scale-110 active:scale-95 transition-transform shadow-2xl"><Icon name="play_arrow" fill class="text-white text-4xl"/></div></button></Show>
                </Show>
              </div>

              <div class="px-6 md:px-8 pb-28 -mt-16 relative z-10">
                <div class="flex justify-between items-start mb-2">
                    <div class="pr-2">
                        <h2 class="text-3xl font-black drop-shadow-md leading-tight">{movie().title || movie().name}</h2>
                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                            {movie().release_date || details().release_date || 'N/A'} • {movie().media_type === 'tv' ? 'SERIES' : 'MOVIE'} 
                            <Show when={details().runtime || details().episode_run_time?.[0]}> • {formatRuntime(details().runtime || details().episode_run_time?.[0])}</Show>
                        </p>
                    </div>
                    <button onClick={()=>setIsEdit(!isEdit())} class={`p-2.5 rounded-full border transition-colors shrink-0 ${isEdit() ? 'bg-[var(--primary)] text-[#0c0e14] border-[var(--primary)]' : 'glass-surface text-gray-400 hover:text-white'}`}><Icon name={isEdit()?'check':'edit'} class="text-sm"/></button>
                </div>
                
                {/* Fixed Big Ratings Row - Equal widths, vertically stacked */}
                <div class="grid grid-cols-3 gap-2 my-5 w-full">
                    <div class="bg-black/40 backdrop-blur-md border border-white/10 py-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md">
                        <div class="flex items-center gap-1 mb-0.5"><Icon name="star" fill class="text-[10px] text-[#f5c518]"/><span class="text-xs font-black text-white">{omdbData().imdb}</span></div>
                        <span class="text-[7px] font-black text-gray-500 uppercase tracking-widest">IMDb</span>
                    </div>
                    <div class="bg-black/40 backdrop-blur-md border border-white/10 py-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md">
                        <div class="flex items-center gap-1 mb-0.5"><span class="text-[10px]">🍅</span><span class="text-xs font-black text-white">{omdbData().rt}</span></div>
                        <span class="text-[7px] font-black text-gray-500 uppercase tracking-widest">RT</span>
                    </div>
                    <div class="bg-[var(--primary)]/10 backdrop-blur-md border border-[var(--primary)]/20 py-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md">
                        <div class="flex items-center gap-1 mb-0.5"><Icon name="person" fill class="text-[10px] text-[var(--primary)]"/><span class="text-xs font-black text-[var(--primary)]">{movie().rating ? `${movie().rating}/10` : '-'}</span></div>
                        <span class="text-[7px] font-black text-[var(--primary)] uppercase tracking-widest opacity-70">Sage</span>
                    </div>
                </div>

                <Show when={isEdit()} fallback={
                  <div class="animate-fade-in">
                    {/* Streaming Servers */}
                    <div class="flex gap-2 mb-6">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveServer('VidLink'); setShowPlayer(true); }} class="flex-1 bg-[var(--primary)] text-[#0c0e14] font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--primary)]/20"><Icon name="play_circle" fill class="text-[16px]"/> VidLink</button>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveServer('Vidsrc'); setShowPlayer(true); }} class="flex-1 bg-[#10b981] text-[#0c0e14] font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#10b981]/20"><Icon name="backup" fill class="text-[16px]"/> Vidsrc</button>
                    </div>

                    <p class="text-gray-400 text-sm mb-6 leading-relaxed italic border-l-2 border-[var(--primary)]/30 pl-3">"{details().overview || (typeof movie().overview === 'string' ? movie().overview : 'No overview available.')}"</p>
                    
                    {/* TV Show Progress Section */}
                    <Show when={movie().media_type === 'tv'}>
                        <div class="glass-surface p-5 rounded-2xl border border-white/5 mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"><Icon name="video_library" class="text-[14px] text-[var(--primary)]"/> Tracker</span>
                                <span class="font-black text-sm text-white">{isCompleted() ? 'Completed' : `S${movie().season||1} E${movie().episode||1}`}</span>
                            </div>
                            <div class="w-full h-2 bg-black rounded-full overflow-hidden mb-4"><div class="h-full bg-[var(--primary)] transition-all shadow-[0_0_10px_var(--primary)]" style={{width:`${progressPct()}%`}}></div></div>
                            <Show when={!isCompleted()}>
                                <button onClick={async () => { let n = (parseInt(movie().episode)||1)+1; let s = movie().status==='Planned'?'Watching':movie().status; if(movie().totalEps>0 && n>=movie().totalEps) { s='Completed'; props.showToast("Completed! 🎉"); } await updateDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id)), {episode: n, status: s}); }} class="w-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--primary)] hover:text-[#0c0e14] active:scale-95 transition-all">+1 Episode</button>
                            </Show>
                        </div>
                    </Show>

                    {/* Cast & Crew Carousel */}
                    <Show when={details().credits}>
                        <div class="mb-8">
                            <h3 class="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-4">Cast & Crew</h3>
                            <div class="flex gap-5 overflow-x-auto hide-scrollbar pb-2">
                                <For each={details().credits.cast.slice(0, 8)}>{(c) => (
                                    <div class="flex flex-col items-center min-w-[75px] shrink-0">
                                        <img src={c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${c.name}&backgroundColor=171921`} class="w-16 h-16 rounded-full object-cover border border-white/10 mb-2 shadow-lg bg-[#171921]" />
                                        <p class="text-[9px] font-black text-center text-white truncate w-full">{c.name}</p>
                                        <p class="text-[7px] text-gray-500 text-center uppercase truncate w-full font-bold mt-0.5">{c.character}</p>
                                    </div>
                                )}</For>
                                <For each={details().credits.crew.filter(x=>x.job==='Director' || x.job==='Producer').slice(0,3)}>{(c) => (
                                    <div class="flex flex-col items-center min-w-[75px] shrink-0">
                                        <img src={c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : `https://api.dicebear.com/7.x/initials/svg?seed=${c.name}&backgroundColor=171921`} class="w-16 h-16 rounded-full object-cover border border-[var(--secondary)] mb-2 shadow-lg bg-[#171921]" />
                                        <p class="text-[9px] font-black text-center text-white truncate w-full">{c.name}</p>
                                        <p class="text-[7px] text-[var(--secondary)] text-center uppercase font-black tracking-widest mt-0.5">{c.job}</p>
                                    </div>
                                )}</For>
                            </div>
                        </div>
                    </Show>

                    {/* Metadata Box */}
                    <div class="glass-surface p-5 rounded-2xl space-y-4 border border-white/5">
                        <SafeInfoRow icon="adjust" label="Status" value={<span class="text-[var(--primary)] font-black uppercase text-[10px] tracking-widest">{movie().status||'Planned'}</span>} />
                        <SafeInfoRow icon="public" label="Region" value={movie().region || 'International'} />
                        <SafeInfoRow icon="format_list_bulleted" label="Genre" value={<span class="text-xs text-gray-300">{getSafeGenres(movie()).join(', ') || 'N/A'}</span>} />
                        <SafeInfoRow icon="connected_tv" label="Available On" value={<span class="text-xs font-bold text-[var(--secondary)]">{getSafePlatforms(movie()).join(', ') || 'N/A'}</span>} />
                        <Show when={movie().tag}><SafeInfoRow icon="label" label="Tag" value={<span class="text-[9px] font-black uppercase tracking-widest bg-white/10 text-white px-2 py-0.5 rounded border border-white/20">{movie().tag}</span>} /></Show>
                        <Show when={movieFranchises()}><SafeInfoRow icon="folder_special" label="Lists" value={<span class="text-xs font-bold text-white">{movieFranchises()}</span>} /></Show>
                        <Show when={movie().notes && typeof movie().notes === 'string'}><div class="border-t border-white/5 pt-3 mt-3"><p class="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1 flex items-center gap-1"><Icon name="edit_note" class="text-[14px]"/> Notes</p><p class="text-sm text-gray-300 italic">"{movie().notes}"</p></div></Show>
                    </div>

                    <div class="mt-8 flex justify-end"><button onClick={async () => { if(confirm("Permanently delete?")) { await deleteDoc(doc(db, 'users', props.uid, 'watchlist', String(movie().id))); props.showToast("Deleted"); props.onClose(); } }} class="text-red-500/50 hover:text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors mx-auto active:scale-95"><Icon name="delete" class="text-sm"/> Remove from Universe</button></div>
                  </div>
                }>
                  {/* EDIT MODE */}
                  <div class="glass-surface p-6 rounded-2xl space-y-4 animate-fade-in border border-[var(--primary)]/30 mt-4 shadow-lg shadow-[var(--primary)]/10">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Status</label><select value={form().status} onChange={e=>setForm({...form(), status: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"><option value="Planned">Planned</option><option value="Watching">Watching</option><option value="Completed">Completed</option></select></div>
                        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Personal Rating</label><input type="number" step="0.1" min="0" max="10" value={form().rating} onChange={e=>setForm({...form(), rating: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div>
                    </div>
                    <Show when={movie().media_type === 'tv'}><div class="grid grid-cols-2 gap-4"><div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Season</label><input type="number" value={form().season} onInput={e=>setForm({...form(), season: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div><div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Episode</label><input type="number" value={form().episode} onInput={e=>setForm({...form(), episode: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div></div></Show>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Custom Tag</label><input placeholder="e.g. Theatre" value={form().tag} onInput={e=>setForm({...form(), tag: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)] placeholder-gray-700"/></div>
                        <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Region</label><select value={form().region} onChange={e=>setForm({...form(), region: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"><option>International</option><option>Indian</option></select></div>
                    </div>
                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Available Platforms</label><div class="flex flex-wrap gap-2 p-3 bg-[#0c0e14] border border-white/5 rounded-xl"><For each={allAvailablePlatforms()}>{p => <button type="button" onClick={()=>togglePlatform(p)} class={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors shadow-sm active:scale-95 ${form().platforms.split(',').map(s=>s.trim()).includes(p) ? 'bg-gradient-to-tr from-[var(--secondary)] to-[var(--primary)] text-[#0c0e14]' : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'}`}>{p}</button>}</For></div></div>
                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">Genres (Comma separated)</label><input value={form().genres} onInput={e=>setForm({...form(), genres: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)]"/></div>
                    <div><label class="text-[9px] uppercase font-black text-gray-500 mb-1 block tracking-widest">My Notes</label><textarea value={form().notes} onInput={e=>setForm({...form(), notes: e.target.value})} class="w-full bg-[#0c0e14] border border-white/10 p-2.5 rounded-xl text-sm text-white outline-none focus:border-[var(--primary)] placeholder-gray-700" rows="3" placeholder="Write your thoughts..."></textarea></div>
                    <button onClick={saveChanges} class="w-full bg-[var(--primary)] text-[#0c0e14] font-black py-4 rounded-xl text-[10px] uppercase tracking-widest mt-2 active:scale-95 transition-transform shadow-lg shadow-[var(--primary)]/20">Save Universe Changes</button>
                  </div>
                </Show>
              </div>
          </div>
        </div>
      </Show>

      <Show when={showPlayer()}>
        <div class="fixed inset-0 bg-black z-[10000000] flex flex-col animate-fade-in" onClick={(e)=>e.stopPropagation()}>
          <div class="p-4 flex justify-between items-center bg-[#0c0e14] border-b border-white/5 shadow-xl">
            <div class="flex items-center gap-3 overflow-hidden pr-2">
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowPlayer(false); }} class="p-2 bg-white/5 hover:bg-white/10 rounded-full active:scale-95 transition-all"><Icon name="arrow_back" class="text-sm" /></button>
                <h3 class="font-bold text-sm text-white truncate">{movie().title || movie().name}</h3>
            </div>
            <div class="flex gap-2 shrink-0">
                <button type="button" onClick={(e)=>{e.stopPropagation(); setActiveServer('VidLink');}} class={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all ${activeServer()==='VidLink'?'bg-[var(--primary)] text-[#0c0e14] shadow-[0_0_10px_var(--primary)]':'bg-white/5 text-gray-400 hover:text-white'}`}>VidLink</button>
                <button type="button" onClick={(e)=>{e.stopPropagation(); setActiveServer('Vidsrc');}} class={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all ${activeServer()==='Vidsrc'?'bg-[#10b981] text-[#0c0e14] shadow-[0_0_10px_#10b981]':'bg-white/5 text-gray-400 hover:text-white'}`}>Vidsrc</button>
            </div>
          </div>
          <div class="flex-1 bg-black w-full h-full relative">
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none"><Icon name="hourglass_empty" class="text-white/20 text-4xl animate-spin"/></div>
            <iframe src={getStreamUrl(activeServer())} class="w-full h-full border-none relative z-10" allowfullscreen ></iframe>
          </div>
        </div>
      </Show>
    </div>
  );
}

// 10. INSIGHTS MODAL
function InsightsModal(props) {
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

// 11. DATA SYNC
function DataSync(props) {
  const [importLogs, setImportLogs] = createSignal([]);
  const exportData = (format) => {
    if(props.watchlist().length === 0) return alert("Vault is empty.");
    let dataStr, type, ext;
    if(format === 'json') { dataStr = JSON.stringify(props.watchlist(), null, 2); type = 'application/json'; ext = 'json'; }
    else { const headers = ['Title', 'Type', 'Status', 'Rating', 'Watch Date', 'Genres', 'Platforms', 'Region', 'Notes', 'Tags']; const rows = props.watchlist().map(m => [`"${(m.title||m.name||'').replace(/"/g, '""')}"`, m.media_type||'', m.status||'', m.rating||0, typeof m.watchDate === 'string' ? m.watchDate : '', `"${getSafeGenres(m).join(', ')}"`, `"${getSafePlatforms(m).join(', ')}"`, m.region||'', `"${(typeof m.notes==='string'?m.notes:'').replace(/"/g, '""')}"`, `"${m.tag||''}"`].join(',')); dataStr = [headers.join(','), ...rows].join('\n'); type = 'text/csv'; ext = 'csv'; }
    const blob = new Blob([dataStr], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cinelog_export.${ext}`; a.click(); props.showToast(`Exported as ${ext.toUpperCase()}`);
  };

  const handleJSONUpload = async (e) => {
      const file = e.target.files[0]; if(!file) return; setImportLogs([{id: Date.now(), title: 'System', msg: 'Reading JSON file...', type: 'success'}]);
      try { const text = await file.text(); const data = JSON.parse(text); if(!Array.isArray(data)) throw new Error("Invalid format");
          for(let i=0; i<data.length; i++) { const m = data[i]; const title = m.title || m.name; if(!title) continue;
              if(props.watchlist().some(w => String(w.id) === String(m.id) || (w.title||w.name||'').toLowerCase() === title.toLowerCase())) { setImportLogs(prev => [{id: Date.now()+i, title: title, msg: 'Already exists', type: 'success'}, ...prev]); continue; }
              if(m.id && m.media_type) { await setDoc(doc(db, 'users', props.uid, 'watchlist', String(m.id)), { ...m, addedAt: m.addedAt ? m.addedAt : serverTimestamp() }); setImportLogs(prev => [{id: Date.now()+i, title: title, msg: 'Imported', type: 'success'}, ...prev]); } else setImportLogs(prev => [{id: Date.now()+i, title: title, msg: 'Missing TMDB ID', type: 'error'}, ...prev]);
              await new Promise(r => setTimeout(r, 100)); 
          } props.showToast("JSON Import Finished");
      } catch(err) { setImportLogs(prev => [{id: Date.now(), title: 'System', msg: 'Failed to parse JSON', type: 'error'}, ...prev]); }
  };

  return (
    <div class="max-w-4xl mx-auto animate-fade-in pb-10">
      <h2 class="text-3xl font-headline font-black mb-2 drop-shadow-md">Data Sync</h2><p class="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-8">Import or Export your universe securely</p>
      <div class="grid md:grid-cols-2 gap-6 mb-8">
        <div class="glass-surface rounded-[2rem] p-10 text-center shadow-xl border border-white/5">
          <Icon name="upload_file" class="text-5xl text-[var(--primary)] mb-4 opacity-80" />
          <h3 class="text-xl font-black mb-2">Import Vault</h3><p class="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-8">Restore from backup</p>
          <div class="flex gap-4"><input type="file" id="jsonInput" accept=".json" class="hidden" onChange={handleJSONUpload} /><button onClick={() => document.getElementById('jsonInput').click()} class="w-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30 font-black py-4 rounded-xl text-[10px] uppercase tracking-widest hover:bg-[var(--primary)] hover:text-[#0c0e14] transition-colors active:scale-95 shadow-lg">Upload JSON Backup</button></div>
        </div>
        <div class="glass-surface rounded-[2rem] p-10 text-center shadow-xl border border-white/5">
          <Icon name="download" class="text-5xl text-[var(--secondary)] mb-4 opacity-80" />
          <h3 class="text-xl font-black mb-2">Export Vault</h3><p class="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-8">Download {props.watchlist().length} titles</p>
          <div class="flex gap-4">
              <button onClick={() => exportData('csv')} class="flex-1 bg-white/5 border border-white/10 font-black py-4 rounded-xl text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors active:scale-95 shadow-sm">CSV</button>
              <button onClick={() => exportData('json')} class="flex-1 bg-[var(--secondary)] text-[#0c0e14] font-black py-4 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-transform shadow-lg shadow-[var(--secondary)]/20">JSON</button>
          </div>
        </div>
      </div>
      <Show when={importLogs().length > 0}>
        <div class="glass-surface rounded-2xl p-6 border border-white/5 animate-pop-in">
          <div class="flex justify-between items-center mb-4"><h3 class="font-black text-sm">Import Logs</h3><button onClick={()=>setImportLogs([])} class="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors active:scale-95"><Icon name="delete" class="text-[16px]"/></button></div>
          <div class="space-y-2 max-h-64 overflow-y-auto pr-2 hide-scrollbar"><For each={importLogs()}>{(l) => (<div class={`p-3 rounded-xl bg-[#0c0e14] border border-white/5 flex justify-between items-center ${l.type==='success'?'border-l-green-500':'border-l-red-500'} border-l-4 shadow-md`}><span class="text-xs font-bold truncate pr-4">{l.title}</span><span class={`text-[9px] uppercase font-black tracking-widest ${l.type==='success'?'text-green-500':'text-red-500'}`}>{l.msg}</span></div>)}</For></div>
        </div>
      </Show>
    </div>
  );
}

// 12. SEARCH MODAL 
function SearchModal(props) {
  const [q, setQ] = createSignal(''); const [results, setResults] = createSignal([]); const [searching, setSearching] = createSignal(false);
  onMount(() => { document.body.style.overflow = 'hidden'; }); onCleanup(() => { document.body.style.overflow = ''; });
  
  createEffect(() => {
    const query = q(); if (query.length < 2) return setResults([]); setSearching(true);
    const t = setTimeout(async () => { try { const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${query}`); const data = await res.json(); setResults(data.results ? data.results.filter(r => r.media_type !== 'person') : []); } catch(e){} setSearching(false); }, 500);
    return () => clearTimeout(t);
  });

  const addMedia = async (m) => {
    if(props.watchlist.some(item => String(item.id) === String(m.id))) return props.showToast("Already in vault!");
    const res = await fetch(`https://api.themoviedb.org/3/${m.media_type}/${m.id}?api_key=${TMDB_KEY}&append_to_response=watch/providers`); const data = await res.json();
    await setDoc(doc(db, 'users',
