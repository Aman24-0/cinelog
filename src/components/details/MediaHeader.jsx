import { Show } from 'solid-js';
import { Icon, formatRuntime } from '../../utils';

export function MediaHeader(props) {
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

      {/* FIXED: Added horizontal padding and negative top margin to properly align the title */}
      <div class="px-6 md:px-8 -mt-16 relative z-10 flex justify-between items-start mb-2">
        <div class="pr-2">
            <h2 class="text-3xl font-black drop-shadow-md leading-tight">{props.movie?.title || props.movie?.name}</h2>
            <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                {props.movie?.release_date || props.details?.release_date || 'N/A'} • {props.movie?.media_type === 'tv' ? 'SERIES' : 'MOVIE'} 
                <Show when={props.details?.runtime || props.details?.episode_run_time?.[0]}> • {formatRuntime(props.details?.runtime || props.details?.episode_run_time?.[0])}</Show>
            </p>
        </div>
        <Show when={!props.isPreview}>
            <button onClick={()=>{
                if (props.isGuest) {
                  if(props.showToast) props.showToast("Sign in to edit! 🔒");
                  if (props.onLogin) props.onLogin();
                  return;
                }
                props.setIsEdit(!props.isEdit)
            }} 
            class="w-10 h-10 rounded-full border transition-all shrink-0 flex items-center justify-center"
            style={props.isEdit ? 'background: var(--p); color: #000; border-color: var(--p); box-shadow: 0 0 12px var(--p-glow)' : 'background: rgba(255,255,255,0.05); color: #9ca3af; border-color: rgba(255,255,255,0.1); backdrop-filter: blur(8px)'}>
              <Icon name={props.isEdit?'check':'edit'} class="text-sm"/>
            </button>
        </Show>
      </div>
    </>
  );
}
