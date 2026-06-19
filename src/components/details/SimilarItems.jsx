import { For, Show } from 'solid-js';
import { Icon } from '../../utils';

export function SimilarItems(props) {
  return (
    <Show when={props.items().length > 0}>
      <div class="mb-8 mt-6">
        <h3 class="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-3 px-1 flex items-center gap-2">
          <Icon name="auto_awesome" class="text-[12px]" style="color: var(--p)"/> More Like This
        </h3>
        <div class="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
          <For each={props.items()}>{(item) => (
            <div onClick={() => props.onSelect(item)} class="min-w-[110px] w-[110px] shrink-0 cursor-pointer active:scale-95 transition-transform">
              <img src={`https://image.tmdb.org/t/p/w200${item.poster_path}`} class="w-full h-[160px] rounded-xl object-cover bg-[#171921] mb-2 border border-white/5" />
              <p class="text-[10px] font-bold text-gray-200 line-clamp-2 leading-tight">{item.title || item.name}</p>
            </div>
          )}</For>
        </div>
      </div>
    </Show>
  );
}
