import { Show } from 'solid-js';
import { Icon, formatRuntime, getSafeGenres } from '../../utils';

export function MediaHeader(props) {

  // 🚀 FORMATTED SHARE WITH POSTER IMAGE LOGIC
  const handleShare = async () => {
    const title = props.movie?.title || props.movie?.name || 'Unknown Title';
    const isTv = props.movie?.media_type === 'tv';
    const typeIcon = isTv ? '📺' : '🎬';
    
    // Fallback logic for rating
    const rating = props.movie?.imdbRating && props.movie.imdbRating !== '-' 
        ? props.movie.imdbRating 
        : (props.details?.vote_average ? props.details.vote_average.toFixed(1) : 'N/A');

    // Safe genres extraction
    const genresList = props.details?.genres?.map(g => g.name) || getSafeGenres(props.movie) || [];
    const genres = genresList.length > 0 ? genresList.join(', ') : 'N/A';

    const overview = props.details?.overview || props.movie?.overview || 'No overview available.';

    // EXACT TEXT FORMATTING
    const shareText = `${typeIcon} *${title}*\n\n*⭐ Rating: ${rating}/10*\n*🏷️ ${genres}*\n\n*📖 Introduction*\n${overview}\n\n*🍿 Watch now:*\nhttps://anivortex.in/watch/${props.movie?.id}\n\n*📲 Download App:*\nhttps://anivortex.in`;

    if (navigator.share) {
      try {
        let shareData = {
          title: title,
          text: shareText
        };

        // 🖼️ TRY TO FETCH AND ATTACH POSTER IMAGE
        if (props.movie?.poster_path) {
          if (props.showToast) props.showToast("Preparing image for share... ⏳");
          try {
            const response = await fetch(`https://image.tmdb.org/t/p/w500${props.movie.poster_path}`);
            const blob = await response.blob();
            const file = new File([blob], `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_poster.jpg`, { type: blob.type });
            
            // Check if device supports sharing files
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              shareData.files = [file];
            }
          } catch (imgErr) {
            console.log("Could not fetch image for sharing", imgErr);
            // Ignore error and proceed to share text only
          }
        }

        await navigator.share(shareData);
      } catch (err) {
        console.log("Share cancelled or failed", err);
      }
    } else {
      // Fallback for PC/Unsupported browsers: Copy to clipboard
      navigator.clipboard.writeText(shareText);
      if (props.showToast) props.showToast("Details copied to clipboard! 📋");
    }
  };

  return (
    <>
      <div class="h-56 md:h-72 relative bg-black shrink-0">
        <Show when={!props.playTrailer} fallback={<iframe class="w-full h-full absolute inset-0 z-10" src={`https://www.youtube.com/embed/${props.trailerKey}?autoplay=1&rel=0`} frameborder="0" allowfullscreen></iframe>}>
          <Show when={props.movie?.backdrop_path} fallback={<div class="w-full h-full flex items-center justify-center text-gray-700 bg-[#171921]"><Icon name="movie" class="text-6xl"/></div>}><img src={`https://image.tmdb.org/t/p/original${props.movie?.backdrop_path}`} class="w-full h-full object-cover opacity-60" /></Show>
          <div class="absolute inset-0 bg-gradient-to-t from-[#08090b]/90 via-[#08090b]/40 to-transparent pointer-events-none" />
          <Show when={props.trailerKey}>
            <button onClick={() => props.setPlayTrailer(true)} class="absolute inset-0 flex items-center justify-center z-10 group">
              <div class="w-16 h-16 backdrop-blur-md rounded-full flex items-center justify-center border group-hover:scale-110 active:scale-95 transition-transform shadow-2xl" style="background: var(--p-dim); border-color: rgba(255,255,255,0.1)">
                <Icon name="play_arrow" fill class="text-white text-4xl"/>
              </div>
            </button>
          </Show>
        </Show>
      </div>

      <div class="px-6 md:px-8 -mt-16 relative z-10 flex justify-between items-start mb-2">
        <div class="pr-2">
            <h2 class="text-3xl font-black drop-shadow-md leading-tight">{props.movie?.title || props.movie?.name}</h2>
            <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                {props.movie?.release_date || props.details?.release_date || 'N/A'} • {props.movie?.media_type === 'tv' ? 'SERIES' : 'MOVIE'} 
                <Show when={props.details?.runtime || props.details?.episode_run_time?.[0]}> • {formatRuntime(props.details?.runtime || props.details?.episode_run_time?.[0])}</Show>
            </p>
        </div>
        
        <div class="flex items-center gap-2 shrink-0">
            {/* SHARE BUTTON */}
            <button 
              onClick={handleShare} 
              class="w-10 h-10 rounded-full border transition-all flex items-center justify-center bg-black/40 hover:bg-white/10 text-gray-400 hover:text-white border-white/10 backdrop-blur-md active:scale-95 shadow-lg"
              title="Share"
            >
              <Icon name="share" class="text-sm"/>
            </button>

            <Show when={!props.isPreview}>
                <button onClick={()=>{
                    if (props.isGuest) {
                      if(props.showToast) props.showToast("Sign in to edit! 🔒");
                      if (props.onLogin) props.onLogin();
                      return;
                    }
                    props.setIsEdit(!props.isEdit)
                }} 
                class="w-10 h-10 rounded-full border transition-all flex items-center justify-center active:scale-95 shadow-lg"
                style={props.isEdit ? 'background: var(--p); color: #000; border-color: var(--p); box-shadow: 0 0 12px var(--p-glow)' : 'background: rgba(255,255,255,0.05); color: #9ca3af; border-color: rgba(255,255,255,0.1); backdrop-filter: blur(8px)'}>
                  <Icon name={props.isEdit?'check':'edit'} class="text-sm"/>
                </button>
            </Show>
        </div>
      </div>
    </>
  );
}
