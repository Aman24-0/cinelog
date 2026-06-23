import { onMount, onCleanup } from "solid-js";

export function DirectPlayPlayer(props) {
  let videoRef;
  let progressTimer;

  onMount(() => {
    if (!videoRef) return;

    const handleLoadedMetadata = () => {
      if (props.startTime > 0) {
        videoRef.currentTime = props.startTime;
      }
    };

    videoRef.addEventListener(
      "loadedmetadata",
      handleLoadedMetadata
    );

    progressTimer = setInterval(() => {
      if (
        props.onProgress &&
        !videoRef.paused &&
        !videoRef.ended
      ) {
        props.onProgress({
          currentTime: videoRef.currentTime || 0,
          duration: videoRef.duration || 0,
        });
      }
    }, 3000);
  });

  onCleanup(() => {
    if (progressTimer) {
      clearInterval(progressTimer);
    }
  });

  return (
    <div class="w-full h-full bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={props.src}
        poster={props.poster}
        controls
        autoPlay
        playsInline
        preload="metadata"
        class="w-full max-h-screen bg-black"
      />
    </div>
  );
}
