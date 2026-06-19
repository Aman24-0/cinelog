import { onMount, onCleanup } from 'solid-js';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export default function VideoPlayer(props) {
  let videoRef;
  let player;

  onMount(() => {
    if (!props.magnetLink) {
      console.error('❌ No magnet link provided to VideoPlayer');
      return;
    }

    // ✅ CRITICAL FIX: Construct the backend stream URL
    // Replace with your actual Render backend URL if different
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://cinelog-ultimate-backend.onrender.com'; 
    const streamUrl = `${BACKEND_URL}/api/stream?magnet=${encodeURIComponent(props.magnetLink)}`;

    console.log('🎬 Using Backend Stream URL:', streamUrl);

    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-big-play-centered', 'vjs-theme-city');
    videoRef.appendChild(videoElement);

    player = videojs(videoElement, {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: true,
      preload: 'metadata',
      sources: [{
        src: streamUrl,
        type: 'video/mp4', // We force MP4 as the backend streams it as such
      }],
      html5: {
        hls: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    });

    // Debug Events
    player.on('error', () => {
      const error = player.error();
      console.error('❌ VIDEOJS ERROR:', error);
    });

    player.on('loadedmetadata', () => {
      console.log('✅ Metadata loaded. Duration:', player.duration());
    });

    player.on('waiting', () => {
      console.log('⏳ Buffering...');
    });

    player.on('playing', () => {
      console.log('▶️ Playing started.');
    });
  });

  onCleanup(() => {
    if (player) {
      player.dispose();
    }
  });

  return (
    <div class="w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden shadow-2xl">
      <div ref={videoRef} class="w-full h-full" />
      {!props.magnetLink && (
        <div class="p-8 text-center text-gray-400">
          Select a torrent to start streaming...
        </div>
      )}
    </div>
  );
}
