// src/views/SettingsView.jsx
import { For, Show } from 'solid-js';
import { Icon } from '../utils';

export function SettingsView(props) {
  const themes = [
    { id: 'sage', name: 'Sage', hex: '#a8ff78' },
    { id: 'matrix', name: 'Matrix', hex: '#39ff14' },
    { id: 'netflix', name: 'Netflix', hex: '#ff2d55' },
    { id: 'cinematic', name: 'Cinematic', hex: '#FFD700' },
    { id: 'interstellar', name: 'Interstellar', hex: '#00c2ff' },
    { id: 'neonhorizon', name: 'Neon Horizon', hex: '#ff2af0' },
    { id: 'vibranium', name: 'Vibranium', hex: '#9d4edd' }
  ];

  return (
    <div class="pb-24 animate-fade-in px-5 max-w-2xl mx-auto">
      
      {/* ACCOUNT section */}
      <p class="section-title">Account</p>
      <div class="bg-[#141414] rounded-2xl border border-white/10 p-4 mb-6">
        <Show when={props.user} fallback={
          <div class="flex items-center justify-between">
            <span class="text-gray-400 text-sm">Not signed in</span>
            <button onClick={() => props.onLogin?.()} class="px-4 py-2 rounded-full font-bold text-black text-xs uppercase tracking-widest bg-white active:scale-95 transition-transform">
              Sign In
            </button>
          </div>
        }>
          <div class="flex items-center gap-4">
            <img src={props.user.photoURL} class="w-14 h-14 rounded-full object-cover" />
            <div class="flex-1">
              <p class="font-bold text-white text-lg">{props.user.displayName}</p>
              <p class="text-sm text-gray-400">{props.user.email}</p>
            </div>
            <Icon name="edit" class="text-gray-500" />
          </div>
        </Show>
      </div>

      {/* APPEARANCE section */}
      <p class="section-title">Appearance</p>
      <div class="flex gap-4 overflow-x-auto hide-scrollbar py-2 mb-6">
        <For each={themes}>
          {(t) => (
            <div 
              onClick={() => props.setTheme(t.id)}
              class="flex flex-col items-center gap-2 cursor-pointer group"
            >
              <div 
                class={`w-12 h-12 rounded-full transition-transform active:scale-95 ${props.theme === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : 'group-hover:scale-105'}`}
                style={{ background: t.hex }}
              />
              <span class="text-xs font-medium text-gray-400 group-hover:text-white transition-colors">{t.name}</span>
            </div>
          )}
        </For>
      </div>

      {/* GENERAL section */}
      <p class="section-title">General</p>
      <div class="flex flex-col gap-2 mb-6">
        <div onClick={props.onServerSettings} class="settings-row">
          <Icon name="dns" class="text-gray-400" />
          <span class="flex-1 text-white font-medium">Streaming Servers</span>
          <Icon name="chevron_right" class="text-gray-600" />
        </div>
        <div onClick={() => props.setView('sync')} class="settings-row">
          <Icon name="import_export" class="text-gray-400" />
          <span class="flex-1 text-white font-medium">Data Sync</span>
          <Icon name="chevron_right" class="text-gray-600" />
        </div>
        <div onClick={() => props.setView('analytics')} class="settings-row">
          <Icon name="bar_chart" class="text-gray-400" />
          <span class="flex-1 text-white font-medium">Insights</span>
          <Icon name="chevron_right" class="text-gray-600" />
        </div>
      </div>

      {/* ACCOUNT ACTIONS section */}
      <Show when={props.user}>
        <p class="section-title">Danger Zone</p>
        <div class="flex flex-col gap-2">
          <button 
            onClick={props.onLogout}
            class="w-full border border-white/20 text-white rounded-xl py-3 font-bold active:scale-95 transition-transform hover:bg-white/5"
          >
            Logout
          </button>
          <button 
            onClick={props.onNuke}
            class="w-full bg-red-600 text-white rounded-xl py-3 font-bold active:scale-95 transition-transform hover:bg-red-700 mt-2"
          >
            Nuke Vault
          </button>
        </div>
      </Show>

    </div>
  );
}
