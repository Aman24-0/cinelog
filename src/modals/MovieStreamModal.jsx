import { createSignal, For, Show } from 'solid-js';
import { Icon } from '../utils';
import { MovieResultCard } from '../components/MovieResultCard';
import { trpc } from '../lib/trpc';

export const MovieStreamModal = (props) => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [loadingMovieId, setLoadingMovieId] = createSignal(null);
  const [searchError, setSearchError] = createSignal(null);
  
  // New States for Stream List
  const [streamList, setStreamList] = createSignal([]);
  const [selectedMovie, setSelectedMovie] = createSignal(null);
  
  let searchTimeout;

  const handleSearch = (query) => {
    setSearchQuery(query);
    setSearchError(null);
    clearTimeout(searchTimeout);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    searchTimeout = setTimeout(async () => {
      try {
        const result = await trpc.movies.search.query({ query });
        if (result.success) setSearchResults(result.movies);
        else setSearchError(result.error || 'Search failed');
      } catch (error) {
        setSearchError(error.message || 'Failed to search movies');
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleWatchMovie = async (movie) => {
    setLoadingMovieId(movie.id);
    setSearchError(null);
    
    try {
      // ✅ UPDATED: Send TMDB ID directly. Backend will fetch IMDB ID.
      const result = await trpc.movies.scrapeVideoSource.mutate({
        tmdbId: movie.id,         type: 'movie'
      });

      if (result.success && result.sources && result.sources.length > 0) {
        setStreamList(result.sources);
        setSelectedMovie(movie);
      } else {
        setSearchError(result.message || 'No streams found on Torrentio');
      }
    } catch (error) {
      setSearchError(error.message || 'Connection error with backend');
    } finally {
      setLoadingMovieId(null);
    }
  };

  const handlePlayStream = (stream) => {
    props.onVideoFound({
      movieTitle: selectedMovie().title,
      videoUrl: stream.magnet, // ✅ Uses 'magnet' key from Torrentio
      poster: selectedMovie().poster,
      source: 'torrentio',
    });
    setStreamList([]);
    setSelectedMovie(null);
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <div class="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md animate-fade-in" onClick={props.onClose} />
      
      {/* Modal Container */}
      <div class="fixed inset-0 z-[100000] flex items-center justify-center p-4 pointer-events-none" onClick={props.onClose}>
        <div 
          class="w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden pointer-events-auto animate-pop-in flex flex-col" 
          onClick={(e) => e.stopPropagation()} 
          style={{ 
            background: 'linear-gradient(135deg, rgba(14,16,24,0.95) 0%, rgba(8,9,11,0.95) 100%)', 
            border: '1px solid var(--border-active)', 
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px var(--p-glow)' 
          }}
        >
          
          {/* Header & Search Section */}
          <div class="sticky top-0 z-10 p-6 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-headline text-3xl text-white flex items-center gap-3">
                <Icon name="movie" class="text-2xl" style="color: var(--p)" /> Stream Movies              </h2>
              <button onClick={props.onClose} class="p-2 rounded-full hover:bg-white/10 active:scale-95">
                <Icon name="close" class="text-xl text-gray-400" />
              </button>
            </div>

            <Show when={streamList().length === 0}>
              <div class="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ borderColor: searchQuery() ? 'var(--p)' : 'var(--border)', background: 'rgba(255,255,255,0.05)' }}>
                <Icon name="search" class="text-lg text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search movies by title..." 
                  value={searchQuery()} 
                  onInput={(e) => handleSearch(e.target.value)} 
                  class="flex-1 bg-transparent outline-none text-white text-sm font-medium" 
                />
                <Show when={isSearching()}>
                  <Icon name="hourglass_empty" class="text-lg text-gray-400 animate-spin" />
                </Show>
              </div>
            </Show>

            <Show when={searchError()}>
              <div class="mt-3 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-xs text-red-300 font-bold">
                {searchError()}
              </div>
            </Show>
          </div>

          {/* Content Area */}
          <div class="overflow-y-auto hide-scrollbar p-6 flex-1">
            <Show when={streamList().length === 0} fallback={
              <div class="animate-fade-in">
                <div class="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
                  <button onClick={() => setStreamList([])} class="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                    <Icon name="arrow_back" class="text-white" />
                  </button>
                  <div>
                    <h3 class="text-lg font-bold text-white leading-tight">Select a Stream</h3>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">{selectedMovie()?.title}</p>
                  </div>
                </div>
                
                <div class="flex flex-col gap-3">
                  <For each={streamList()}>
                    {(stream) => (
                      <div class="bg-black/40 border border-white/10 hover:border-[var(--primary)]/50 rounded-xl p-4 flex items-center justify-between transition-all group">
                        <div class="min-w-0 pr-4 flex-1">
                          <h4 class="text-sm font-bold text-white truncate mb-1.5 group-hover:text-[var(--primary)] transition-colors">
                            {stream.title}                          </h4>
                          <div class="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                            <span class="text-green-400 bg-green-400/10 px-2 py-0.5 rounded border border-green-400/20">
                              {stream.seeders} Seeders
                            </span>
                            <span class="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
                              {stream.size}
                            </span>
                            <span class="text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10 truncate max-w-[100px]">
                              {stream.indexer}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handlePlayStream(stream)} 
                          class="shrink-0 w-12 h-12 bg-[var(--primary)] text-[#0c0e14] rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-[0_0_15px_var(--p-glow)]"
                        >
                          <Icon name="play_arrow" class="text-xl" />
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            }>
              <Show when={searchResults().length > 0} fallback={
                <div class="text-center py-12">
                  <Icon name="movie" class="text-5xl text-gray-600 mb-3 mx-auto opacity-50" />
                  <p class="text-gray-400 font-bold">
                    {searchQuery() ? 'No movies found' : 'Search for a movie to get started'}
                  </p>
                </div>
              }>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <For each={searchResults()}>
                    {(movie) => (
                      <MovieResultCard 
                        movie={movie} 
                        isLoading={loadingMovieId() === movie.id} 
                        onWatch={handleWatchMovie} 
                      />
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-pop-in { animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </Show>
  );
};
