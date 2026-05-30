import { Show } from 'solid-js';
import { Icon, formatRuntime } from '../utils';

export const MovieCard = (props) => (
  <div onClick={props.onClick} class="movie-card animate-fade-up">
    <div class="movie-card-inner">
      <Show
        when={props.movie.poster_path}
        fallback={
          <div class="w-full h-full flex items-center justify-center skeleton-bg">
            <Icon name="movie" class="text-4xl" style="color: var(--dim)" />
          </div>
        }
      >
        <img
          src={`https://image.tmdb.org/t/p/w500${props.movie.poster_path}`}
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
      </Show>

      {/* Gradient overlay */}
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-90 pointer-events-none" />

      {/* Status badge */}
      <div class="absolute top-2 left-2 tag-chip" style="color: var(--p)">
        {props.movie.status === 'Plan to Watch' ? 'Planned' : (props.movie.status || 'NEW')}
      </div>

      {/* Tag / New season badge */}
      <Show when={props.movie.newSeasonAvailable} fallback={
        <Show when={props.movie.tag}>
          <div class="absolute top-2 right-2 tag-chip text-white max-w-[60px] truncate">
            {props.movie.tag}
          </div>
        </Show>
      }>
        <div class="absolute top-2 right-2 tag-chip max-w-[88px] truncate" style="color: var(--p); background: rgba(0,0,0,0.72); border-color: var(--p); box-shadow: 0 0 14px var(--p-glow)">
          New Season
        </div>
      </Show>

      {/* Bottom info */}
      <div class="absolute bottom-0 left-0 w-full p-3">
        <h4 class="text-xs font-bold truncate text-white drop-shadow mb-1 leading-tight">
          {props.movie.title || props.movie.name}
        </h4>
        <p class="label-mono mb-1.5" style="font-size: 8px; color: var(--muted)">
          {(props.movie.release_date || '').split('-')[0] || 'N/A'}
          {' · '}
          {props.movie.media_type === 'tv' ? 'Series' : 'Movie'}
          <Show when={props.movie.runtime > 0}>
            {' · '}{formatRuntime(props.movie.runtime)}
          </Show>
        </p>

        {/* Ratings row */}
        <div class="grid grid-cols-3 gap-1 w-full">
          <span class="rating-pill" style="color: #f5c518">
            <Icon name="star" fill class="text-[10px]" />
            {props.movie.imdbRating || '-'}
          </span>
          <span class="rating-pill text-red-400">
            🍅 {props.movie.rtRating || '-'}
          </span>
          <span class="rating-pill" style="color: var(--p)">
            <Icon name="person" fill class="text-[10px]" />
            {props.movie.rating || '-'}
          </span>
        </div>
      </div>
    </div>
  </div>
);
