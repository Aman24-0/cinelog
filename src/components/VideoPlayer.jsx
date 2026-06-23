import { onMount, onCleanup } from 'solid-js';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export default function VideoPlayer(props) {
  let videoRef;
  let player;

  onMount(() => {
    // Check both videoUrl and magnetLink to be safe
    const videoSource = props.videoUrl || props.magnetLink;
    
    if (!videoSource) {
      console.error('❌ No video link provided to VideoPlayer');
      return;
    }

    let streamUrl = '';
    let videoType = 'video/mp4';

    // 🚀 Logic to separate Torrent from Direct URL
    if (videoSource.startsWith('magnet:')) {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://cinelog-ultimate-backend.onrender.com'; 
      streamUrl = `${BACKEND_URL}/api/stream?magnet=${encodeURIComponent(videoSource)}`;
      console.log('🎬 Using Torrent Backend Stream:', streamUrl);
    } else {
      streamUrl = videoSource; // Direct URL
      console.log('🎬 Using Direct Play URL:', streamUrl);
      
      // Auto-detect HLS (.m3u8) for direct play
      if (streamUrl.includes('.m3u8')) {
        videoType = 'application/x-mpegURL';
      }
    }

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
        type: videoType, 
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
      {!(props.videoUrl || props.magnetLink) && (
        <div class="p-8 text-center text-gray-400">
          Select a video source to start streaming...
        </div>
      )}
    </div>
  );
}
