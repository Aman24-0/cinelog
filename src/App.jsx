import { createSignal, createEffect, onMount, ErrorBoundary, Show } from 'solid-js';
import { collection, onSnapshot, query, orderBy, writeBatch, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { db, auth } from './firebase';
import { Icon } from './utils';
import { LoadingScreen } from './components/LoadingScreen';
import { Dashboard } from './views/Dashboard';
import { Vault } from './views/Vault';
import { FranchisesView } from './views/FranchisesView';
import { UpcomingView } from './views/UpcomingView';
import { DataSync } from './views/DataSync';
import { Analytics } from './views/Analytics';
import { DetailsModal } from './modals/DetailsModal';
import { SearchModal } from './modals/SearchModal';
import { ServerSettingsModal } from './modals/ServerSettingsModal';
import { SettingsModal } from './modals/Modals';
import { MovieStreamModal } from './modals/MovieStreamModal';
import { MovieStreamFAB } from './components/MovieStreamFAB';
import VideoPlayer from './components/VideoPlayer';
import { useModalState } from './hooks/useModalState';

const NavBtn = (props) => (
  <button
    onClick={props.onClick}
    class="flex flex-col lg:flex-row items-center gap-1 lg:gap-4 w-14 lg:w-full lg:px-4 lg:py-3 lg:rounded-xl lg:hover:bg-white/5 transition-all"
    style={props.active ? 'color: var(--p)' : 'color: var(--dim)'}
  >
    <Icon name={props.icon} fill={props.active} />
    <span class="label-mono lg:text-[10px] lg:font-bold lg:uppercase lg:tracking-[0.2em]">{props.label}</span>
  </button>
);

const GuestPrompt = (props) => (
  <div class="h-[60vh] flex flex-col items-center justify-center text-center p-6 animate-pop-in">
    <div class="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 mx-auto"
      style="background: var(--raised); border: 1px solid var(--border-active); box-shadow: 0 0 40px var(--p-glow)">
      <Icon name="lock" fill class="text-5xl" style="color: var(--p)" />
    </div>
    <h2 class="font-headline text-5xl text-white mb-2">Sign in Required</h2>
    <p class="text-sm text-gray-400 mb-8 max-w-sm mx-auto">Create an account or sign in to build custom lists, track progress, and back up your vault.</p>
    <button
      onClick={props.onLogin}
      class="font-bold py-4 px-10 rounded-full shadow-lg text-sm text-black uppercase tracking-widest active:scale-95 transition-all"
      style="background: var(--p); box-shadow: 0 0 30px var(--p-glow)"
    >
      Sign In with Google
    </button>
  </div>
);

export default function App() {  const [user, setUser] = createSignal(null);
  const [watchlist, setWatchlist] = createSignal([]);
  const [franchises, setFranchises] = createSignal([]);
  const [view, setView] = createSignal('dashboard');
  const storedTheme = localStorage.getItem('cinelog_theme');
  const legacyTheme = ['cyber', 'punk'].join('');
  const [theme, setTheme] = createSignal(storedTheme === legacyTheme ? 'cinematic' : (storedTheme || 'sage'));
  const [loading, setLoading] = createSignal(true);
  const [splashWait, setSplashWait] = createSignal(true);
  const [activeVaultStatus, setActiveVaultStatus] = createSignal('all');
  const {
    searchModal, setSearchModal, searchInitialQuery, setSearchInitialQuery,
    detailsId, setDetailsId, previewSource, setPreviewSource,
    settingsModal, setSettingsModal, serverSettingsModal, setServerSettingsModal,
    movieStreamModal, setMovieStreamModal, currentVideo, setCurrentVideo
  } = useModalState();
  const [userMenuOpen, setUserMenuOpen] = createSignal(false);
  const [toast, setToast] = createSignal({ show: false, msg: '' });

  const showToast = (msg) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 3000);
  };

  const handleLogin = () => signInWithPopup(auth, new GoogleAuthProvider());

  createEffect(() => { document.body.className = `theme-${theme()}`; localStorage.setItem('cinelog_theme', theme()); });
  createEffect(() => { view(); window.scrollTo(0, 0); });

  onMount(() => {
    setTimeout(() => setSplashWait(false), 3000);
    onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        let wReady = false; let fReady = false;
        onSnapshot(query(collection(db, 'users', u.uid, 'watchlist'), orderBy('addedAt', 'desc')), (snap) => {
          setWatchlist(snap.docs.map(d => ({ id: d.id, ...d.data() }))); wReady = true; if (fReady) setLoading(false);
        });
        onSnapshot(collection(db, 'users', u.uid, 'franchises'), (snap) => {
          setFranchises(snap.docs.map(d => ({ id: d.id, ...d.data() }))); fReady = true; if (wReady) setLoading(false);
        });
      } else {
        setWatchlist([]);
        setFranchises([]);
        setLoading(false);
      }
    });
  });
  const nukeCollection = async () => {
    if (!user()) return;
    if (!confirm("This will permanently delete your entire Vault. Are you sure?")) return;
    if (prompt("Type DELETE to confirm") !== "DELETE") {
      showToast("Cancelled. Vault is safe.");
      return;
    }
    showToast("Nuking Vault...");
    const snap = await getDocs(collection(db, 'users', user().uid, 'watchlist'));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = writeBatch(db);
      docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    showToast("Vault wiped!"); setUserMenuOpen(false);
  };

  return (
    <ErrorBoundary fallback={() => (
      <div class="h-screen flex items-center justify-center p-10 text-center">
        <div class="glass-surface rounded-[2rem] p-8 border max-w-md w-full"
          style="background: var(--raised); border-color: var(--border-active); box-shadow: 0 0 40px var(--p-glow)">
          <div class="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 mx-auto"
            style="background: var(--p-dim); border: 1px solid var(--border-active)">
            <Icon name="warning" class="text-5xl" style="color: var(--p)" />
          </div>
          <h2 class="font-headline text-4xl text-white mb-3">Something went wrong</h2>
          <p class="text-sm mb-8 leading-relaxed" style="color: var(--muted)">An unexpected error occurred. Please reload the app.</p>
          <button onClick={() => window.location.reload()} class="px-8 py-3.5 rounded-full font-bold text-black text-sm uppercase tracking-widest active:scale-95 transition-all" style="background: var(--p); box-shadow: 0 0 20px var(--p-glow)">Reload App</button>
        </div>
      </div>
    )}>
      <div class="cinelog-root min-h-screen pb-32 lg:pb-0 lg:pl-64" onClick={() => setUserMenuOpen(false)}>
        <div class="orb-primary" />
        <div class="orb-secondary" />
        <Show when={!loading() && !splashWait()} fallback={<LoadingScreen />}>
          
          {/* ─ HEADER ── */}
          <header class="sticky top-0 z-50 flex justify-between items-center px-6 py-4 border-b"
            style="background: rgba(5,6,10,0.8); backdrop-filter: blur(24px); border-color: var(--border)">
            
            {/* Logo & Mobile Stream Button Container */}
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center"
                  style="background: var(--p-dim); border: 1px solid var(--border-active)">
                  <Icon name="movie_filter" fill class="text-sm" style="color: var(--p)" />
                </div>                <h2 class="font-headline text-2xl text-white leading-none">
                  CINE<span style="color: var(--p)">LOG</span>
                </h2>
              </div>

              {/* ✅ NEW: Mobile Stream Button (Visible ONLY on mobile) */}
              <button 
                onClick={() => setMovieStreamModal(true)}
                class="flex sm:hidden ml-2 p-2 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all border border-white/10"
                aria-label="Stream Movies"
              >
                <Icon name="play_circle" class="text-xl text-[var(--p)]" />
              </button>
            </div>

            {/* Header Controls */}
            <div class="flex items-center gap-3">
              <button
                onClick={() => setSettingsModal(true)}
                class="glass-surface p-2.5 rounded-full"
                style="border-color: var(--border-active)"
              >
                <Icon name="palette" class="text-sm" style="color: var(--muted)" />
              </button>
              
              {/* Login / Profile Toggle */}
              <Show when={user()} fallback={
                <button
                  onClick={handleLogin}
                  class="px-5 py-2 rounded-full font-bold text-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                  style="background: var(--p); box-shadow: 0 0 16px var(--p-glow)"
                >
                  Sign In
                </button>
              }>
                <div class="relative">
                  <img
                    src={user().photoURL}
                    onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen()); }}
                    class="w-9 h-9 rounded-full cursor-pointer object-cover"
                    style="border: 2px solid var(--p); box-shadow: 0 0 12px var(--p-glow)"
                  />
                  <Show when={userMenuOpen()}>
                    <div class="fixed inset-0 z-[90]" onClick={() => setUserMenuOpen(false)} />
                    <div class="absolute right-0 mt-3 w-52 glass-surface rounded-2xl shadow-2xl py-2 z-[100] animate-pop-in overflow-hidden"
                      style="border-color: var(--border-active)">
                      <button onClick={() => { setView('analytics'); setUserMenuOpen(false); }}
                        class="w-full text-left px-5 py-3 text-sm font-semibold flex items-center gap-3 hover:bg-white/5 transition-colors"
                        style="color: var(--p)">
                        <Icon name="bar_chart" class="text-[18px]" /> Insights                      </button>
                      <div class="my-1" style="border-top: 1px solid var(--border)" />
                      <button onClick={() => { setServerSettingsModal(true); setUserMenuOpen(false); }}
                        class="w-full text-left px-5 py-3 text-sm font-semibold flex items-center gap-3 hover:bg-white/5 transition-colors text-gray-300">
                        <Icon name="dns" class="text-[18px]" /> Streaming Servers
                      </button>
                      <button onClick={() => { setView('sync'); setUserMenuOpen(false); }}
                        class="w-full text-left px-5 py-3 text-sm font-semibold flex items-center gap-3 hover:bg-white/5 transition-colors text-gray-300">
                        <Icon name="import_export" class="text-[18px]" /> Data Sync
                      </button>
                      <button onClick={() => signOut(auth)}
                        class="w-full text-left px-5 py-3 text-sm font-semibold flex items-center gap-3 hover:bg-white/5 transition-colors text-gray-300">
                        <Icon name="logout" class="text-[18px]" /> Logout
                      </button>
                      <div class="my-1" style="border-top: 1px solid var(--border)" />
                      <button onClick={nukeCollection}
                        class="w-full text-left px-5 py-3 text-sm font-semibold text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors">
                        <Icon name="delete_forever" class="text-[18px]" /> Nuke Vault
                      </button>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </header>

          {/* ── MAIN ── */}
          <main class="p-5 max-w-2xl lg:max-w-none lg:px-12 mx-auto relative z-10">
            <Show when={view() === 'dashboard'}>
              <Dashboard watchlist={watchlist} openMovie={setDetailsId} setView={setView} showToast={showToast} setActiveVaultStatus={setActiveVaultStatus} isGuest={!user()} onLogin={handleLogin} uid={user()?.uid} onSearch={(term) => { setSearchInitialQuery(term || ''); setSearchModal(true); }} />
            </Show>
            <Show when={view() === 'watchlist'}>
              <Vault watchlist={watchlist} openMovie={setDetailsId} activeStatus={activeVaultStatus()} onFilterChange={setActiveVaultStatus} isGuest={!user()} onLogin={handleLogin} />
            </Show>
            <Show when={view() === 'franchises'}>
              <Show when={user()} fallback={<GuestPrompt onLogin={handleLogin} />}>
                <FranchisesView watchlist={watchlist} franchises={franchises} uid={user().uid} openMovie={setDetailsId} showToast={showToast} />
              </Show>
            </Show>
            <Show when={view() === 'analytics'}>
              <Show when={user()} fallback={<GuestPrompt onLogin={handleLogin} />}>
                <Analytics watchlist={watchlist} />
              </Show>
            </Show>
            <Show when={view() === 'upcoming'}>
              <UpcomingView watchlist={watchlist} uid={user()?.uid} showToast={showToast} isGuest={!user()} onLogin={handleLogin} />
            </Show>
            <Show when={view() === 'sync'}>
              <Show when={user()} fallback={<GuestPrompt onLogin={handleLogin} />}>
                <DataSync watchlist={watchlist} uid={user().uid} showToast={showToast} />              </Show>
            </Show>
          </main>

          {/* ── BOTTOM NAV ── */}
          <div class="fixed bottom-6 lg:bottom-0 lg:left-0 w-full lg:w-64 px-4 lg:px-0 flex justify-center lg:h-screen z-50 pointer-events-none">
            <nav class="nav-pill w-full max-w-md lg:max-w-none lg:h-full lg:rounded-none lg:flex-col lg:justify-start lg:gap-8 lg:pt-32 flex justify-around items-center px-2 py-3 lg:px-6 pointer-events-auto lg:border-r" style="border-color: var(--border)">
              <NavBtn icon="dashboard" label="Home" active={view() === 'dashboard'} onClick={() => setView('dashboard')} />
              <NavBtn icon="visibility" label="Vault" active={view() === 'watchlist'} onClick={() => setView('watchlist')} />
              {/* Center Add button */}
              <div class="relative -mt-8 lg:mt-0 mx-1">
                <button
                  onClick={() => { setSearchInitialQuery(''); setSearchModal(true); }}
                  class="w-14 h-14 rounded-full flex items-center justify-center text-black font-black border-4 active:scale-95 lg:w-full lg:h-auto lg:py-4 lg:rounded-2xl lg:border-none lg:flex-row lg:gap-3 lg:px-6"
                  style="background: var(--p); border-color: var(--void); box-shadow: 0 0 24px var(--p-glow), 0 8px 20px rgba(0,0,0,0.5)"
                >
                  <Icon name="search" class="text-3xl lg:text-xl" />
                  <span class="hidden lg:block font-bold uppercase tracking-widest text-[10px]">Discover</span>
                </button>
              </div>
              <NavBtn icon="folder_special" label="Lists" active={view() === 'franchises'} onClick={() => setView('franchises')} />
              <NavBtn icon="calendar_month" label="Upcoming" active={view() === 'upcoming'} onClick={() => setView('upcoming')} />
            </nav>
          </div>

          {/* ── MODALS ── */}
          <Show when={movieStreamModal()}>
            <MovieStreamModal
              isOpen={movieStreamModal()}
              onClose={() => setMovieStreamModal(false)}
              onVideoFound={(video) => setCurrentVideo(video)}
            />
          </Show>
          <Show when={searchModal()}>
            <SearchModal
              onClose={() => { setSearchModal(false); setSearchInitialQuery(''); }}
              uid={user()?.uid}
              initialQuery={searchInitialQuery()}
              showToast={showToast}
              watchlist={watchlist()}
              isGuest={!user()}
              onLogin={() => { setSearchModal(false); handleLogin(); }}
              openPreview={(item, source) => {
                setPreviewSource(source || 'search');
                setDetailsId(`PREVIEW_${JSON.stringify(item)}`);
              }}
            />
          </Show>
          <Show when={detailsId()}>
            <DetailsModal              id={detailsId()}
              watchlist={watchlist()}
              franchises={franchises()}
              onClose={() => {
                setDetailsId(null);
                setPreviewSource(null);
              }}
              uid={user()?.uid}
              showToast={showToast}
              theme={theme}
              isGuest={!user()}
              onLogin={() => { setDetailsId(null); handleLogin(); }}
            />
          </Show>
          <Show when={settingsModal()}>
            <SettingsModal currentTheme={theme()} setTheme={setTheme} onClose={() => setSettingsModal(false)} />
          </Show>
          <Show when={serverSettingsModal()}>
            <ServerSettingsModal
              uid={user()?.uid}
              showToast={showToast}
              onClose={() => setServerSettingsModal(false)}
            />
          </Show>

          {/* ─ FLOATING ACTION BUTTONS ── */}
          <MovieStreamFAB onClick={() => setMovieStreamModal(true)} />

          {/* ── VIDEO PLAYER OVERLAY ── */}
          <Show when={currentVideo()}>
            <div class="fixed inset-0 z-[99998] bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center p-4 overflow-auto">
              <button
                onClick={() => setCurrentVideo(null)}
                class="absolute top-6 right-6 p-3 rounded-full hover:bg-white/10 transition-colors active:scale-95 z-[100001]"
              >
                <Icon name="close" class="text-2xl text-white" />
              </button>
              <div class="w-full max-w-5xl">
                <VideoPlayer
                  videoUrl={currentVideo().videoUrl}
                  movieTitle={currentVideo().movieTitle}
                  poster={currentVideo().poster}
                  source={currentVideo().source}
                />
              </div>
            </div>
          </Show>

          {/* ── TOAST ── */}
          <Show when={toast().show}>            <div class="fixed bottom-28 left-1/2 -translate-x-1/2 glass-surface px-6 py-3 rounded-full shadow-2xl z-[999999] flex gap-2 items-center text-sm font-bold whitespace-nowrap animate-pop-in"
              style="border-color: var(--p); color: var(--text)">
              <Icon name="check_circle" fill style="color: var(--p)" /> {toast().msg}
            </div>
          </Show>

        </Show>
      </div>
    </ErrorBoundary>
  );
}
