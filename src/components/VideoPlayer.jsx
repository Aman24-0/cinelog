import { createEffect, onMount, onCleanup, createSignal, Show } from 'solid-js';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { Icon } from '../utils'; // Icon import kiya gaya hai

export const VideoPlayer = (props) => {
  let videoRef;
  let playerInstance = null;
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  // Check agar link Prowlarr se aya Magnet link hai
  const isMagnet = () => props.videoUrl && props.videoUrl.startsWith('magnet:');

  const getVideoType = (url) => {
    if (!url) return 'video/mp4';
    if (url.includes('.m3u8') || url.includes('m3u8')) return 'application/x-mpegURL';
    return 'video/mp4';
  };

  const initializePlayer = () => {
    // Agar magnet hai toh video.js ko init na karein
    if (!videoRef || isMagnet()) return;

    if (playerInstance) {
      playerInstance.dispose();
      playerInstance = null;
    }

    playerInstance = videojs(videoRef, {
      controls: true,
      autoplay: true,
      preload: 'auto',
      fluid: true,
      responsive: true,
      sources: [{ src: props.videoUrl, type: getVideoType(props.videoUrl) }],
      poster: props.poster,
    });

    playerInstance.on('fullscreenchange', () => {
      setIsFullscreen(playerInstance.isFullscreen());
    });
  };

  onMount(() => {
    initializePlayer();
    onCleanup(() => {
      if (playerInstance) playerInstance.dispose();
    });
  });

  createEffect(() => {
    const url = props.videoUrl;
    if (url && playerInstance && !isMagnet()) {
      playerInstance.src({ src: url, type: getVideoType(url) });
      playerInstance.load();
      playerInstance.play().catch(e => console.warn(e));
    }
  });

  return (
    <div class="w-full bg-black rounded-2xl overflow-hidden relative" style={{ "aspect-ratio": '16 / 9', "box-shadow": '0 20px 60px rgba(0,0,0,0.5)' }}>
      
      {/* Agar link Magnet hai toh Video.js ki jagah Action UI dikhayega */}
      <Show when={!isMagnet()} fallback={
        <div class="w-full h-full flex flex-col items-center justify-center bg-[#0c0e14] text-white p-6 text-center border border-white/10 rounded-2xl">
          <Icon name="cloud_download" class="text-6xl text-[var(--primary)] mb-4 animate-bounce" />
          <h2 class="text-2xl font-black mb-2 text-white">Best Source Found!</h2>
          <p class="text-gray-400 mb-6 max-w-md truncate">{props.movieTitle}</p>
          <a href={props.videoUrl} class="px-8 py-3.5 bg-[var(--primary)] text-[#0c0e14] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_var(--p-glow)] flex items-center gap-2">
            <Icon name="open_in_new" class="text-lg"/> Open in App / Download
          </a>
          <p class="text-[10px] text-gray-500 mt-6 font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-lg border border-white/5">
            Note: To play this directly in player, WebTorrent backend is required next.
          </p>
        </div>
      }>
        
        {/* Normal Video.js Player for .mp4 / .m3u8 */}
        <div data-vjs-player class="w-full h-full">
          <video ref={videoRef} class="video-js vjs-default-skin vjs-big-play-centered w-full h-full" playsinline />
        </div>

        {!isFullscreen() && (
          <div class="absolute inset-x-0 bottom-0 pointer-events-none flex flex-col justify-end p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" style={{ opacity: '0.9' }}>
            <h2 class="font-headline text-2xl text-white mb-1 shadow-sm">{props.movieTitle}</h2>
            <p class="text-xs font-semibold tracking-wider uppercase text-gray-400">
              {props.source === 'demo' ? '🎬 Demo Video Fallback' : '🎥 Now Streaming'}
            </p>
          </div>
        )}

      </Show>
      
      {/* Retain your existing videojs CSS styles here */}
      <style>{`
        .video-js .vjs-control-bar { background-color: rgba(5, 6, 10, 0.8) !important; backdrop-filter: blur(16px); }
        .video-js .vjs-play-progress { background-color: var(--p) !important; box-shadow: 0 0 12px var(--p-glow); }
        .video-js .vjs-big-play-button { background-color: rgba(0, 0, 0, 0.5) !important; border-color: var(--p) !important; border-radius: 50% !important; }
        .video-js:hover .vjs-big-play-button { background-color: var(--p) !important; color: black !important; }
      `}</style>
    </div>
  );
};
