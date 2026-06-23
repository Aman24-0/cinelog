import { Router, Routes, Route, Navigate } from '@solidjs/router';
import { createSignal, createEffect, Show, ErrorBoundary, onCleanup } from 'solid-js';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// ============================================
// Import Views & Components
// ============================================
// Note: Adjust these import paths if your folder structure differs slightly
import Vault from './views/Vault.jsx';
import Dashboard from './views/Dashboard.jsx';
import Analytics from './views/Analytics.jsx';
import FranchisesView from './views/FranchisesView.jsx';
import UpcomingView from './views/UpcomingView.jsx';
import AIRecommend from './views/AIRecommend.jsx'; // Or modals/AIRecommend.jsx
import SearchModal from './modals/SearchModal.jsx';
import DetailsModal from './modals/DetailsModal.jsx';
import MovieStreamModal from './modals/MovieStreamModal.jsx';
import Navbar from './components/Navbar.jsx'; // Assuming you have a Navbar

// ============================================
// Custom Error Boundary (Fixes Issue #8)
// ============================================
function AppErrorBoundary(props) {
  const [error, setError] = createSignal(null);

  // Fallback UI when an error occurs
  const fallback = (err, reset) => {
    console.error('🚨 Critical App Error:', err);
    return (
      <div class="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
        <h1 class="text-3xl font-bold text-red-500 mb-4">Oops! Something went wrong.</h1>
        <p class="text-gray-400 mb-6 text-center max-w-lg">
          The application encountered a critical error. Please check the console for details or try reloading.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          class="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Reload Application
        </button>
      </div>
    );
  };

  return <ErrorBoundary fallback={fallback}>{props.children}</ErrorBoundary>;
}

export default function App() {
  // ============================================
  // State Management
  // ============================================
  const [user, setUser] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [theme, setTheme] = createSignal('dark'); // Default theme
  const [isSearchOpen, setIsSearchOpen] = createSignal(false);
  const [selectedMedia, setSelectedMedia] = createSignal(null);

  // ============================================
  // Theme Handling (Fixes Issue #10)
  // ============================================
  createEffect(() => {
    const currentTheme = theme();
    const root = document.documentElement;
    
    // Clean theme application
    root.setAttribute('data-theme', currentTheme);
    
    // Handle dark mode class for Tailwind
    if (currentTheme === 'dark' || currentTheme === 'cyber' || currentTheme === 'punk') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  });

  // ============================================
  // Firebase Auth Listener
  // ============================================
  createEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Cleanup listener on unmount
    onCleanup(() => unsubscribe());
  });

  // ============================================
  // Render
  // ============================================
  return (
    <AppErrorBoundary>
      <Router>
        <Show 
          when={!loading()} 
          fallback={
            <div class="flex items-center justify-center min-h-screen bg-gray-900 text-white">
              <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          }
        >
          <div class={`min-h-screen bg-base-100 text-base-content transition-colors duration-300`}>
            <Show when={user()}>
              <Navbar 
                onSearch={() => setIsSearchOpen(true)} 
                theme={theme()} 
                setTheme={setTheme} 
              />
            </Show>

            <main class="container mx-auto p-4">
              <Routes>
                <Route path="/" component={Vault} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/analytics" component={Analytics} />
                <Route path="/franchises" component={FranchisesView} />
                <Route path="/upcoming" component={UpcomingView} />
                <Route path="/ai" component={AIRecommend} />
                <Route path="*all" component={() => <Navigate href="/" />} />
              </Routes>
            </main>

            {/* Global Modals */}
            <Show when={isSearchOpen()}>
              <SearchModal 
                isOpen={isSearchOpen()} 
                onClose={() => setIsSearchOpen(false)} 
                onSelect={(media) => {
                  setSelectedMedia(media);
                  setIsSearchOpen(false);
                }} 
              />
            </Show>

            <Show when={selectedMedia()}>
              <DetailsModal 
                media={selectedMedia()} 
                onClose={() => setSelectedMedia(null)} 
              />
            </Show>
            
            {/* Add other global modals like MovieStreamModal here if needed */}
          </div>
        </Show>
      </Router>
    </AppErrorBoundary>
  );
}
