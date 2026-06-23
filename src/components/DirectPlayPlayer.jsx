import { onMount, onCleanup, Show } from "solid-js";

import "vidstack/player/styles/default/theme.css";
import "vidstack/player/styles/default/layouts/video.css";

import "vidstack/player";
import "vidstack/player/layouts/default";

export function DirectPlayPlayer(props) {
  let playerRef;

  onMount(() => {
    if (!playerRef) return;

    const handleTimeUpdate = () => {
      if (!props.onProgress) return;

      props.onProgress({
        currentTime: playerRef.currentTime || 0,
        duration: playerRef.duration || 0,
      });
    };

    const handleLoadedMetadata = () => {
      if (props.startTime > 0) {
        playerRef.currentTime = props.startTime;
      }
    };

    playerRef.addEventListener(
      "time-update",
      handleTimeUpdate
    );

    playerRef.addEventListener(
      "loaded-metadata",
      handleLoadedMetadata
    );

    onCleanup(() => {
      playerRef.removeEventListener(
        "time-update",
        handleTimeUpdate
      );

      playerRef.removeEventListener(
        "loaded-metadata",
        handleLoadedMetadata
      );
    });
  });

  return (
    <div class="w-full h-full bg-black">
      <media-player
        ref={playerRef}
        title={props.title || "Video"}
        playsinline
        autoplay
        class="w-full h-full"
      >
        <media-provider>
          {/* MP4 Source */}
          <source
            src={props.src}
            type="video/mp4"
          />

          <Show when={props.poster}>
            <media-poster
              src={props.poster}
              class="vds-poster"
            />
          </Show>
        </media-provider>

        {/* Full Vidstack UI */}
        <media-video-layout />
      </media-player>
    </div>
  );
}
