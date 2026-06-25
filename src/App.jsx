// src/App.jsx
import { createSignal, createEffect, onMount, onCleanup, ErrorBoundary, Show } from 'solid-js';
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
import { SettingsView } from './views/SettingsView';
import { DetailsModal } from './modals/DetailsModal';
import { SearchModal } from './modals/SearchModal';
import { ServerSettingsModal } from './modals/ServerSettingsModal';
import { SettingsModal } from './modals/Modals';
import { useModalState } from './hooks/useModalState';

const NavBtn = (props) => (
  <button
    onClick={props.onClick}
    class="flex flex-col lg:flex-row items-center lg:justify-start justify-center gap-1 lg:gap-4 flex-1 lg:flex-none h-full lg:h-auto relative lg:w-full lg:px-4 lg:py-3 lg:rounded-xl lg:hover:bg-white/5 transition-all"
    style={props.active ? 'color: var(--p)' : 'color: #555'}
  >
    {props.active && <div class="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full lg:hidden" style="background: var(--p)" />}
    <Icon name={props.icon} fill={props.active} />
    <span class="text-[10px] lg:text-[10px] font-medium lg:font-bold lg:uppercase lg:tracking-[0.2em]">{props.label}</span>
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

export default function App() {
  const [user, setUser] = createSignal(null);
  const [watchlist, setWatchlist] = createSignal([]);
  const [franchises, setFranchises] = createSignal([]);
  const [view, setView] = createSignal('dashboard');
  const storedTheme = localStorage.getItem('cinelog_theme');
  const legacyTheme = ['cyber', 'punk'].join('');
  const [theme, setTheme] = createSignal(storedTheme === legacyTheme ? 'cinematic' : (storedTheme || 'sage'));
  const [loading, setLoading] = createSignal(true);
  const [splashWait, setSplashWait] = createSignal(true);
  const [activeVaultStatus, setActiveVaultStatus] = createSignal('all');
  
  // Global Scroll-to-Top State
  const [showScrollTop, setShowScrollTop] = createSignal(false);
  
  const {
    searchModal, setSearchModal, searchInitialQuery, setSearchInitialQuery,
    detailsId, setDetailsId, previewSource, setPreviewSource,
    settingsModal, setSettingsModal, serverSettingsModal, setServerSettingsModal
  } = useModalState();
  
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
    
    // Scroll Event Listener
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    
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

    onCleanup(() => window.removeEventListener('scroll', handleScroll));
  });

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    showToast("Vault wiped!");
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
      <div class="cinelog-root min-h-screen pb-32 lg:pb-0 lg:pl-64">
        <Show when={!loading() && !splashWait()} fallback={<LoadingScreen />}>
          
          {/* ─ HEADER ── */}
          <header class="sticky top-0 z-50 flex justify-between items-center px-6 py-4"
            style="background: #000; border-bottom: 1px solid rgba(255,255,255,0.08);">
            
            {/* Logo Container */}
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center"
                  style="background: var(--p-dim); border: 1px solid var(--border-active)">
                  <Icon name="movie_filter" fill class="text-sm" style="color: var(--p)" />
                </div>
                <h2 class="font-headline text-2xl text-white leading-none">
                  CINE<span style="color: var(--p)">LOG</span>
                </h2>
              </div>
            </div>

            {/* Header Controls */}
            <div class="flex items-center gap-3">
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
                <img
                  src={user().photoURL}
                  onClick={() => setView('settings')}
                  class="w-9 h-9 rounded-full cursor-pointer object-cover active:scale-95 transition-all"
                  style="border: 2px solid var(--p);"
                />
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
                <DataSync watchlist={watchlist} uid={user().uid} showToast={showToast} />
              </Show>
            </Show>
            <Show when={view() === 'settings'}>
              <SettingsView user={user()} theme={theme()} setTheme={setTheme} onLogout={() => signOut(auth)} onNuke={nukeCollection} uid={user()?.uid} showToast={showToast} setView={setView} onServerSettings={() => setServerSettingsModal(true)} />
            </Show>
          </main>

          {/* ── DESKTOP SIDEBAR ── */}
          <div class="hidden lg:flex fixed top-0 left-0 h-screen w-64 bg-black border-r border-white/10 z-40 flex-col pt-24 px-6 gap-2">
            <NavBtn icon="dashboard" label="Home" active={view() === 'dashboard'} onClick={() => setView('dashboard')} />
            <NavBtn icon="visibility" label="Vault" active={view() === 'watchlist'} onClick={() => setView('watchlist')} />
            <NavBtn icon="search" label="Search" active={searchModal()} onClick={() => { setSearchInitialQuery(''); setSearchModal(true); }} />
            <NavBtn icon="folder_special" label="Lists" active={view() === 'franchises'} onClick={() => setView('franchises')} />
            <NavBtn icon="calendar_month" label="Upcoming" active={view() === 'upcoming'} onClick={() => setView('upcoming')} />
          </div>

          {/* ── MOBILE BOTTOM NAV ── */}
          <nav class="fixed bottom-0 left-0 w-full z-50 flex lg:hidden bottom-nav-bar h-16">
            <NavBtn icon="dashboard" label="Home" active={view() === 'dashboard'} onClick={() => setView('dashboard')} />
            <NavBtn icon="visibility" label="Vault" active={view() === 'watchlist'} onClick={() => setView('watchlist')} />
            <NavBtn icon="search" label="Search" active={searchModal()} onClick={() => { setSearchInitialQuery(''); setSearchModal(true); }} />
            <NavBtn icon="folder_special" label="Lists" active={view() === 'franchises'} onClick={() => setView('franchises')} />
            <NavBtn icon="calendar_month" label="Upcoming" active={view() === 'upcoming'} onClick={() => setView('upcoming')} />
          </nav>

          {/* ── MODALS ── */}
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
            <DetailsModal
              id={detailsId()}
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

          {/* ── GLOBAL SCROLL TO TOP FAB ── */}
          <Show when={showScrollTop()}>
            <button
              onClick={scrollToTop}
              class="fixed bottom-24 lg:bottom-8 right-5 lg:right-8 w-12 h-12 rounded-full flex items-center justify-center z-[80] transition-all animate-pop-in hover:scale-105 active:scale-95 no-print"
              style="background: var(--p); color: #000; box-shadow: 0 0 20px var(--p-glow)"
              title="Back to top"
            >
              <Icon name="keyboard_arrow_up" class="text-3xl font-black" />
            </button>
          </Show>

          {/* ── TOAST ── */}
          <Show when={toast().show}>
            <div class="fixed bottom-28 left-1/2 -translate-x-1/2 glass-surface px-6 py-3 rounded-full shadow-2xl z-[999999] flex gap-2 items-center text-sm font-bold whitespace-nowrap animate-pop-in"
              style="border-color: var(--p); color: var(--text)">
              <Icon name="check_circle" fill style="color: var(--p)" /> {toast().msg}
            </div>
          </Show>

        </Show>
      </div>
    </ErrorBoundary>
  );
}
