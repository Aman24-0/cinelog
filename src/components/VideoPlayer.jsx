import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

// ============================================
// Unified Backend URL Configuration
// ============================================
// Fix: Replaced hardcoded URL with environment variable
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function VideoPlayer(props) {
  let videoRef;
  let player;
  const [error, setError] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(true);

  onMount(() => {
    // Fix: Better validation for missing sources
    if (!props.src) {
      setError('No video source provided. Please select a valid stream.');
      setIsLoading(false);
      return;
    }

    try {
      // Determine source URL (handle magnet links via backend proxy)
      let sourceUrl = props.src;
      let sourceType = 'video/mp4';

      if (props.src.startsWith('magnet:')) {
        sourceUrl = `${BACKEND_URL}/api/stream?url=${encodeURIComponent(props.src)}`;
      } else if (props.src.includes('.m3u8')) {
        sourceType = 'application/x-mpegURL';
      }

      // Initialize Video.js
      player = videojs(videoRef, {
        controls: true,
        autoplay: false,
        preload: 'auto',
        poster: props.poster || '',
        fluid: true,
        responsive: true,
        sources: [{
          src: sourceUrl,
          type: sourceType,
        }],
      });

      // Event Listeners
      player.on('error', () => {
        setError('Failed to load video. The source might be unavailable or blocked.');
        setIsLoading(false);
      });

      player.on('canplay', () => {
        setIsLoading(false);
      });

      player.on('waiting', () => {
        setIsLoading(true);
      });

      player.on('playing', () => {
        setIsLoading(false);
      });

    } catch (err) {
      console.error('VideoPlayer initialization error:', err);
      setError('An unexpected error occurred while initializing the player.');
      setIsLoading(false);
    }
  });

  // Fix: Proper cleanup to prevent memory leaks
  onCleanup(() => {
    if (player) {
      player.dispose();
      player = null;
    }
  });

  return (
    <div class="relative w-full h-full bg-black rounded-lg overflow-hidden shadow-2xl">
      {/* Loading Overlay */}
      <Show when={isLoading() && !error()}>
        <div class="absolute inset-0 flex items-center justify-center z-10 bg-black/60 pointer-events-none">
          <div class="text-white text-lg font-medium animate-pulse">Buffering...</div>
        </div>
      </Show>

      {/* Error Overlay with Retry */}
      <Show when={error()}>
        <div class="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/90 text-white p-6">
          <p class="text-red-400 mb-6 text-center max-w-md">{error()}</p>
          <button
            onClick={() => window.location.reload()}
            class="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Retry / Reload
          </button>
        </div>
      </Show>

      {/* Video Element */}
      <video
        ref={videoRef}
        class="video-js vjs-big-play-centered vjs-theme-city w-full h-full"
      />
    </div>
  );
}
