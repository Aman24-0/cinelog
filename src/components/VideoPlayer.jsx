import { createEffect, onMount, onCleanup, createSignal } from 'solid-js';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

/**
 * Video.js player component with auto-play and elegant controls
 */
export const VideoPlayer = (props) => {
  let videoRef;
  let playerInstance = null;
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  // Helper function to detect and return correct MIME type
  const getVideoType = (url) => {
    if (!url) return 'video/mp4';
    if (url.includes('.m3u8') || url.includes('m3u8')) {
      return 'application/x-mpegURL';
    }
    return 'video/mp4';
  };

  const initializePlayer = () => {
    if (!videoRef) return;

    // Clear any existing instance safely before initializing
    if (playerInstance) {
      playerInstance.dispose();
      playerInstance = null;
    }

    // Initialize Video.js player
    playerInstance = videojs(videoRef, {
      controls: true,
      autoplay: true,
      preload: 'auto',
      width: '100%',
      height: '100%',
      fluid: true,
      responsive: true,
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'remainingTimeDisplay',
          'playbackRateMenuButton',
          'fullscreenToggle',
        ],
      },
      sources: [
        {
          src: props.videoUrl,
          type: getVideoType(props.videoUrl),
        },
      ],
      poster: props.poster,
    });

    // Handle fullscreen changes
    playerInstance.on('fullscreenchange', () => {
      setIsFullscreen(playerInstance.isFullscreen());
    });
  };

  onMount(() => {
    initializePlayer();

    // Cleanup on component unmount
    onCleanup(() => {
      if (playerInstance) {
        playerInstance.dispose();
      }
    });
  });

  // Watch for dynamic video URL changes and safely update the source
  createEffect(() => {
    const url = props.videoUrl;
    if (url && playerInstance) {
      playerInstance.src({
        src: url,
        type: getVideoType(url),
      });
      playerInstance.load();
      playerInstance.play().catch((err) => {
        console.warn("Autoplay was prevented or source failed: ", err);
      });
    }
  });

  return (
    <div
      class="w-full bg-black rounded-2xl overflow-hidden relative"
      style={{
        "aspect-ratio": '16 / 9',
        "box-shadow": '0 20px 60px rgba(0,0,0,0.5)',
      }}
    >
      <div data-vjs-player class="w-full h-full">
        <video
          ref={videoRef}
          class="video-js vjs-default-skin vjs-big-play-centered w-full h-full"
          playsinline
        />
      </div>

      {/* Custom overlay with movie info */}
      {!isFullscreen() && (
        <div
          class="absolute inset-x-0 bottom-0 pointer-events-none flex flex-col justify-end p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10"
          style={{
            opacity: '0.9',
          }}
        >
          <h2 class="font-headline text-2xl text-white mb-1 shadow-sm">
            {props.movieTitle}
          </h2>
          <p class="text-xs font-semibold tracking-wider uppercase text-gray-400">
            {props.source === 'demo' || props.source?.includes('fallback') ? '🎬 Demo Video Fallback' : '🎥 Now Streaming'}
          </p>
        </div>
      )}

      <style>{`
        .video-js .vjs-control-bar {
          background-color: rgba(5, 6, 10, 0.8) !important;
          backdrop-filter: blur(16px);
        }

        .video-js .vjs-button > .vjs-icon-placeholder {
          font-size: 1.2em;
        }

        .video-js .vjs-progress-control {
          height: 8px;
        }

        .video-js .vjs-progress-holder {
          height: 8px;
        }

        .video-js .vjs-play-progress {
          background-color: var(--p) !important;
          box-shadow: 0 0 12px var(--p-glow);
        }

        .video-js .vjs-load-progress {
          background-color: rgba(255, 255, 255, 0.15) !important;
        }

        .video-js .vjs-mouse-display {
          background-color: rgba(0, 0, 0, 0.8);
        }

        .video-js .vjs-big-play-button {
          background-color: rgba(0, 0, 0, 0.5) !important;
          border-color: var(--p) !important;
          border-radius: 50% !important;
          width: 2.5em !important;
          height: 2.5em !important;
          line-height: 2.5em !important;
          margin-top: -1.25em !important;
          margin-left: -1.25em !important;
          box-shadow: 0 0 20px var(--p-glow);
        }

        .video-js:hover .vjs-big-play-button {
          background-color: var(--p) !important;
          color: black !important;
        }
      `}</style>
    </div>
  );
};
