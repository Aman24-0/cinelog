import { onMount, onCleanup, For, Show } from 'solid-js';
import { Icon } from '../utils';

/* ─── SETTINGS MODAL ─── */
const ThemeBtn = (props) => (
  <button
    onClick={() => { props.set(props.id); props.onClose(); }}
    class="w-full p-4 rounded-2xl flex gap-4 items-center transition-all"
    style={props.curr === props.id
      ? 'border: 1px solid var(--p); background: var(--p-dim); color: var(--text)'
      : 'border: 1px solid var(--border); background: var(--surface); color: var(--muted)'}
  >
    <div class="w-6 h-6 rounded-full shadow-lg shrink-0" style={{ background: props.hex, 'box-shadow': `0 0 12px ${props.hex}66` }} />
    <span class="font-semibold text-sm">{props.name}</span>
    <Show when={props.curr === props.id}>
      <Icon name="check_circle" fill class="ml-auto text-lg" style="color: var(--p)" />
    </Show>
  </button>
);

export function SettingsModal(props) {
  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');

  const themes = [
    { id: 'sage', n: 'Sage', h: '#a8ff78' },
    { id: 'matrix', n: 'Matrix', h: '#39ff14' },
    { id: 'netflix', n: 'Netflix', h: '#ff2d55' },
    { id: 'cinematic', n: 'Cinematic', h: '#FFD700' },
    { id: 'interstellar', n: 'Interstellar', h: '#00c2ff' },
    { id: 'neonhorizon', n: 'Neon Horizon', h: '#ff2af0' },
    { id: 'vibranium', n: 'Vibranium', h: '#9d4edd' },
  ];

  return (
    <div class="fixed inset-0 flex items-center justify-center p-4 z-[999999] animate-fade-in"
      style="background: rgba(0,0,0,0.85); backdrop-filter: blur(12px)"
      onClick={props.onClose}>
      <div class="glass-surface w-full max-w-sm rounded-3xl p-6 animate-pop-in"
        style="border-color: var(--border-active)"
        onClick={e => e.stopPropagation()}>
        <div class="flex justify-between items-center border-b pb-4 mb-5" style="border-color: var(--border)">
          <h3 class="font-bold text-lg flex items-center gap-2 text-white">
            <Icon name="palette" style="color: var(--p)" /> Themes
          </h3>
          <button onClick={props.onClose} class="p-2 rounded-full hover:bg-white/5" style="color: var(--muted)">
            <Icon name="close" />
          </button>
        </div>
        <div class="space-y-2 max-h-[65vh] overflow-y-auto hide-scrollbar">
          <For each={themes}>
            {t => <ThemeBtn id={t.id} name={t.n} hex={t.h} curr={props.currentTheme} set={props.setTheme} onClose={props.onClose} />}
          </For>
        </div>
      </div>
    </div>
  );
}
