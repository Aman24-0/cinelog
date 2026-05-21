import { createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon } from '../utils';

const DEFAULT_SERVERS = [
  { id: 'vidzee', name: 'VidZee (Fast)', domain: 'player.vidzee.wtf', path: 'embed', icon: 'smart_display' },
  { id: 'vidlink', name: 'VidLink', domain: 'vidlink.pro', path: 'stream', icon: 'play_circle' },
  { id: 'vidsrcru', name: 'Vidsrc.ru', domain: 'vidsrc.ru', path: 'stream', icon: 'dns' },
  { id: 'embedsu', name: 'Embed.su', domain: 'embed.su', path: 'embed', icon: 'stream' },
  { id: 'vidsrccc', name: 'Vidsrc.cc', domain: 'vidsrc.cc', path: 'embed', icon: 'dynamic_feed' },
  { id: 'autoembed', name: 'AutoEmbed', domain: 'autoembed.co', path: 'stream', icon: 'bolt' }
];

export function ServerSettingsModal(props) {
  const [servers, setServers] = createSignal(DEFAULT_SERVERS);
  const [loading, setLoading] = createSignal(true);
  const [editingId, setEditingId] = createSignal(null);
  const [editDomain, setEditDomain] = createSignal('');

  onMount(async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', props.uid));
      const userData = userDoc.data();
      if (userData?.customServerDomains) {
        setServers(prev => prev.map(s => ({
          ...s,
          domain: userData.customServerDomains[s.id]?.domain || s.domain,
          enabled: userData.customServerDomains[s.id]?.enabled !== false
        })));
      }
    } catch (err) {
      console.error('Error loading server settings:', err);
    }
    setLoading(false);
  });

  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');

  const saveServerDomains = async () => {
    try {
      const customServerDomains = {};
      servers().forEach(s => {
        customServerDomains[s.id] = {
          domain: s.domain,
          enabled: s.enabled !== false
        };
      });
      await updateDoc(doc(db, 'users', props.uid), { customServerDomains });
      props.showToast('Server settings saved!');
      setTimeout(() => props.onClose(), 500);
    } catch (err) {
      console.error('Error saving:', err);
      props.showToast('Failed to save settings');
    }
  };

  const resetToDefault = async () => {
    if (!confirm('Reset all servers to default domains?')) return;
    setServers(DEFAULT_SERVERS);
    try {
      await updateDoc(doc(db, 'users', props.uid), { customServerDomains: {} });
      props.showToast('Reset to defaults');
    } catch (err) {
      console.error('Error resetting:', err);
    }
  };

  const testServer = async (serverId) => {
    const server = servers().find(s => s.id === serverId);
    if (!server) return;
    
    try {
      const testUrl = `https://${server.domain}`;
      await fetch(testUrl, { method: 'HEAD', mode: 'no-cors' });
      props.showToast(`✓ ${server.name} is reachable`);
    } catch (err) {
      props.showToast(`✗ ${server.name} appears down`);
    }
  };

  return (
    <div class="fixed inset-0 flex items-center justify-center p-4 z-[999999] animate-fade-in"
      style="background: rgba(0,0,0,0.88); backdrop-filter: blur(12px)"
      onClick={props.onClose}>
      <div class="w-full max-w-lg rounded-[2.5rem] p-6 animate-pop-in overflow-hidden flex flex-col max-h-[90vh]"
        style="background: rgba(9,11,16,0.98); border: 1px solid var(--border-active)"
        onClick={e => e.stopPropagation()}>

        <div class="flex justify-between items-center border-b pb-4 mb-5 shrink-0" style="border-color: var(--border)">
          <h3 class="font-bold text-lg flex items-center gap-2 text-white">
            <Icon name="dns" style="color: var(--p)" /> Streaming Servers
          </h3>
          <button onClick={props.onClose} class="p-2 rounded-full hover:bg-white/5" style="color: var(--muted)">
            <Icon name="close" />
          </button>
        </div>

        <Show when={loading()} fallback={
          <div class="overflow-y-auto hide-scrollbar space-y-3 flex-1 pr-1">
            <div class="rounded-xl p-4 border" style="background: var(--raised); border-color: var(--border)">
              <p class="label-mono mb-3" style="color: var(--muted); font-size: 9px">
                <Icon name="info" class="text-sm mr-1" style="vertical-align: middle; color: var(--p)" />
                Server domain fail ho to manually update karo. Naye domain pe click, edit karo aur save karo.
              </p>
            </div>

            <For each={servers()}>
              {(server) => (
                <div class="border rounded-2xl p-4" style="background: var(--surface); border-color: var(--border-active)">
                  <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2 flex-1">
                      <input type="checkbox" 
                        checked={server.enabled !== false}
                        onChange={(e) => setServers(prev => prev.map(s => 
                          s.id === server.id ? { ...s, enabled: e.target.checked } : s
                        ))}
                        class="w-4 h-4 rounded cursor-pointer"
                        style="accent-color: var(--p)"
                      />
                      <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-sm text-white">{server.name}</h4>
                        <p class="label-mono mt-0.5 truncate" style="font-size: 8px; color: var(--muted)">{server.path}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => testServer(server.id)}
                      class="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                      style="background: var(--raised); border: 1px solid var(--border); color: var(--muted)">
                      <Icon name="check_circle" class="text-base" />
                    </button>
                  </div>

                  <Show when={editingId() === server.id}
                    fallback={
                      <div onClick={() => { setEditingId(server.id); setEditDomain(server.domain); }}
                        class="px-3 py-2 rounded-lg text-xs font-mono border cursor-pointer transition-all hover:border-white/20"
                        style="background: var(--raised); border-color: var(--border); color: var(--muted)">
                        {server.domain}
                      </div>
                    }>
                    <div class="flex gap-2">
                      <input
                        autofocus
                        value={editDomain()}
                        onInput={(e) => setEditDomain(e.target.value)}
                        placeholder="e.g., vidlink.pro"
                        class="flex-1 px-3 py-2 rounded-lg text-xs font-mono border"
                        style="background: var(--raised); border-color: var(--p); color: var(--text)"
                      />
                      <button
                        onClick={() => {
                          setServers(prev => prev.map(s => 
                            s.id === server.id ? { ...s, domain: editDomain() } : s
                          ));
                          setEditingId(null);
                        }}
                        class="px-3 py-2 rounded-lg font-bold text-xs uppercase text-black"
                        style="background: var(--p)">
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        class="px-3 py-2 rounded-lg border"
                        style="background: var(--raised); border-color: var(--border); color: var(--muted)">
                        <Icon name="close" class="text-lg" />
                      </button>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        }>
          <div class="text-center py-12" style="color: var(--muted)">
            <Icon name="hourglass_empty" class="text-5xl mb-3" style="opacity: 0.5" />
            <p class="text-sm font-bold">Loading...</p>
          </div>
        </Show>

        <div class="border-t pt-4 mt-4 flex gap-2 shrink-0" style="border-color: var(--border)">
          <button
            onClick={resetToDefault}
            class="flex-1 font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest"
            style="background: rgba(255,45,85,0.12); color: #ff2d55; border: 1px solid rgba(255,45,85,0.3)">
            Reset
          </button>
          <button
            onClick={saveServerDomains}
            class="flex-1 font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest text-black"
            style="background: var(--p); box-shadow: 0 0 16px var(--p-glow)">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
