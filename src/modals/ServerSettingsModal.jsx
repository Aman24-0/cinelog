// src/modals/ServerSettingsModal.jsx
import { createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon } from '../utils';

const DEFAULT_SERVERS = [
  { 
    id: 'vidzee', 
    name: 'VidZee (Fast)', 
    domain: 'player.vidzee.wtf',
    type: 'embed-api',
    movieUrl: 'https://player.vidzee.wtf/embed/movie/{id}',
    tvUrl: 'https://player.vidzee.wtf/embed/tv/{id}/{season}/{episode}',
    icon: 'smart_display',
    provider: 'Embed Provider'
  },
  { 
    id: 'vidlink', 
    name: 'VidLink', 
    domain: 'vidlink.pro',
    type: 'embed-api',
    movieUrl: 'https://vidlink.pro/movie/{id}?primaryColor=b1a1ff&autoplay=false',
    tvUrl: 'https://vidlink.pro/tv/{id}/{season}/{episode}?primaryColor=b1a1ff&autoplay=false',
    icon: 'play_circle',
    provider: 'VidLink API'
  },
  { 
    id: 'vidsrcru', 
    name: 'Vidsrc.ru', 
    domain: 'vidsrc.ru',
    type: 'embed-api',
    movieUrl: 'https://vidsrc.ru/movie/{id}?autoplay=true&colour=b1a1ff',
    tvUrl: 'https://vidsrc.ru/tv/{id}/{season}/{episode}?autoplay=true&colour=b1a1ff&autonextepisode=true',
    icon: 'dns',
    provider: 'Vidsrc Mirror'
  },
  { 
    id: 'peachify', 
    name: 'Peachify', 
    domain: 'peachify.top',
    type: 'embed-api',
    movieUrl: 'https://peachify.top/embed/movie/{id}?accent=b1a1ff',
    tvUrl: 'https://peachify.top/embed/tv/{id}/{season}/{episode}?accent=b1a1ff',
    icon: 'stream',
    provider: 'Peachify Official'
  },
  { 
    id: 'vidsrccc', 
    name: 'Vidsrc.cc', 
    domain: 'vidsrc.cc',
    type: 'embed-api',
    movieUrl: 'https://vidsrc.cc/v2/embed/movie/{id}',
    tvUrl: 'https://vidsrc.cc/v2/embed/tv/{id}/{season}/{episode}',
    icon: 'dynamic_feed',
    provider: 'Vidsrc Latest'
  },
  { 
    id: 'autoembed', 
    name: 'AutoEmbed', 
    domain: 'autoembed.co',
    type: 'embed-api',
    movieUrl: 'https://autoembed.co/movie/tmdb/{id}',
    tvUrl: 'https://autoembed.co/tv/tmdb/{id}-{season}-{episode}',
    icon: 'bolt',
    provider: 'Auto Provider'
  },
  {
    id: 'vidnest',
    name: 'VidNest (Official)',
    domain: 'vidnest.fun',
    type: 'embed-api',
    movieUrl: 'https://vidnest.fun/movie/{id}',
    tvUrl: 'https://vidnest.fun/tv/{id}/{season}/{episode}',
    icon: 'streaming_icon',
    provider: 'VidNest Official'
  }
];

export function ServerSettingsModal(props) {
  const [servers, setServers] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [expandedId, setExpandedId] = createSignal(null);
  const [editingId, setEditingId] = createSignal(null);
  const [editData, setEditData] = createSignal({ movieUrl: '', tvUrl: '' });
  const [replaceMode, setReplaceMode] = createSignal(null);
  
  // New Server Form State
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [newServer, setNewServer] = createSignal({ name: '', movieUrl: '', tvUrl: '' });

  onMount(async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', props.uid));
      const userData = userDoc.data();
      
      let loadedServers = DEFAULT_SERVERS.map(s => ({...s}));

      if (userData?.customServers) {
        // Map overrides to default servers
        loadedServers = loadedServers.map(s => ({
          ...s,
          ...(userData.customServers[s.id] || {}),
          enabled: userData.customServers[s.id]?.enabled !== false
        }));

        // Append entirely new custom servers
        Object.keys(userData.customServers).forEach(key => {
          if (!DEFAULT_SERVERS.find(ds => ds.id === key)) {
            loadedServers.push({
              id: key,
              name: userData.customServers[key].name || 'Custom Server',
              movieUrl: userData.customServers[key].movieUrl || '',
              tvUrl: userData.customServers[key].tvUrl || '',
              enabled: userData.customServers[key].enabled !== false,
              icon: 'dns',
              provider: 'Custom User Server',
              isCustom: true
            });
          }
        });
      }
      setServers(loadedServers);
    } catch (err) {
      console.error('Error loading server settings:', err);
    }
    setLoading(false);
  });

  onMount(() => document.body.style.overflow = 'hidden');
  onCleanup(() => document.body.style.overflow = '');

  const saveServerSettings = async () => {
    try {
      const customServers = {};
      servers().forEach(s => {
        customServers[s.id] = {
          name: s.name, // Crucial for custom servers
          domain: s.domain || '',
          movieUrl: s.movieUrl,
          tvUrl: s.tvUrl,
          enabled: s.enabled !== false
        };
      });
      
      try {
        await updateDoc(doc(db, 'users', props.uid), { customServers });
      } catch (e) {
        await setDoc(doc(db, 'users', props.uid), { customServers });
      }
      
      props.showToast('Server settings saved!');
      setTimeout(() => props.onClose(), 500);
    } catch (err) {
      console.error('Error saving:', err);
      props.showToast('Failed to save settings');
    }
  };

  const resetToDefault = async () => {
    if (!confirm('Reset all servers to default and delete custom ones?')) return;
    setServers(DEFAULT_SERVERS.map(s => ({...s})));
    try {
      await updateDoc(doc(db, 'users', props.uid), { customServers: {} });
      props.showToast('Reset to defaults');
      setExpandedId(null);
    } catch (err) {
      console.error('Error resetting:', err);
    }
  };

  const replaceServer = (fromId, toId) => {
    const fromServer = servers().find(s => s.id === fromId);
    const toServer = servers().find(s => s.id === toId);
    if (!fromServer || !toServer) return;

    setServers(prev => prev.map(s => {
      if (s.id === fromId) return { ...s, movieUrl: toServer.movieUrl, tvUrl: toServer.tvUrl, domain: toServer.domain };
      return s;
    }));
    props.showToast(`✓ ${fromServer.name} replaced with ${toServer.name}`);
    setReplaceMode(null);
  };

  const testServerUrl = async (serverId, type, e) => {
    if (e) e.stopPropagation();
    const server = servers().find(s => s.id === serverId);
    if (!server) return;

    let testUrl = type === 'movie' ? server.movieUrl : server.tvUrl;
    testUrl = testUrl.replace(/\{id\}|\[TMDB_ID\]/gi, '666243')
                     .replace(/\{season\}|\[SEASON\]/gi, '1')
                     .replace(/\{episode\}|\[EPISODE\]/gi, '1');

    try {
      await fetch(testUrl, { method: 'HEAD', mode: 'no-cors' });
      props.showToast(`✓ ${server.name} ${type} endpoint reachable`);
    } catch (err) {
      props.showToast(`✗ ${server.name} appears down`);
    }
  };

  const addCustomServer = () => {
    if (!newServer().name || !newServer().movieUrl) {
      return props.showToast("Name and Movie URL are required");
    }
    
    const newId = 'custom_' + Date.now();
    setServers(prev => [...prev, {
      id: newId,
      name: newServer().name,
      movieUrl: newServer().movieUrl,
      tvUrl: newServer().tvUrl,
      enabled: true,
      icon: 'add_link',
      provider: 'Custom User Server',
      isCustom: true
    }]);
    
    setNewServer({ name: '', movieUrl: '', tvUrl: '' });
    setShowAddForm(false);
    setExpandedId(newId);
    props.showToast("Custom server added! Don't forget to save.");
  };

  const deleteCustomServer = (id, e) => {
    if (e) e.stopPropagation();
    if(!confirm("Delete this custom server?")) return;
    setServers(prev => prev.filter(s => s.id !== id));
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
    setEditingId(null);
    setReplaceMode(null);
  };

  return (
    <div class="fixed inset-0 flex items-center justify-center p-4 z-[999999] animate-fade-in"
      style="background: rgba(0,0,0,0.88); backdrop-filter: blur(12px)"
      onClick={props.onClose}>
      <div class="w-full max-w-2xl rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-6 animate-pop-in overflow-hidden flex flex-col max-h-[92vh]"
        style="background: rgba(9,11,16,0.98); border: 1px solid var(--border-active)"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div class="flex justify-between items-center border-b pb-5 mb-6 shrink-0" style="border-color: var(--border)">
          <div>
            <h3 class="font-bold text-lg sm:text-xl flex items-center gap-2 text-white">
              <Icon name="dns" style="color: var(--p)" /> Streaming Nodes
            </h3>
            <p class="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold mt-1.5" style="color: var(--muted)">Configure active data sources for your vault</p>
          </div>
          <button onClick={props.onClose} class="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10 active:scale-95 border border-white/5 bg-[#141414]">
            <Icon name="close" class="text-white" />
          </button>
        </div>

        <Show when={loading()} fallback={
          <div class="overflow-y-auto hide-scrollbar flex-1 pr-1 pb-4 flex flex-col gap-3 relative">
            
            {/* Servers Accordion List */}
            <For each={servers()}>
              {(server) => {
                const isExpanded = () => expandedId() === server.id;
                const isEnabled = () => server.enabled !== false;

                return (
                  <div class="rounded-2xl transition-all duration-300 overflow-hidden border shrink-0"
                    style={{
                      background: isEnabled() ? "var(--surface)" : "rgba(20,20,20,0.4)",
                      "border-color": isExpanded() ? "var(--border-active)" : "var(--border)"
                    }}>
                    
                    {/* Collapsed/Header Row */}
                    <div 
                      class="flex items-center p-3 sm:p-4 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => toggleExpand(server.id)}
                    >
                      <div class="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center mr-4 shrink-0 transition-opacity border" 
                           style={{ background: "var(--raised)", opacity: isEnabled() ? 1 : 0.4, "border-color": "var(--border)" }}>
                        <Icon name={server.icon || 'public'} class="text-lg" style="color: var(--p)" />
                      </div>
                      
                      <div class="flex-1 min-w-0 pr-4 transition-opacity" style={{ opacity: isEnabled() ? 1 : 0.4 }}>
                        <h4 class="font-bold text-white text-sm truncate">{server.name}</h4>
                        <div class="flex items-center gap-2 mt-0.5">
                          <span class="text-[9px] font-bold uppercase tracking-widest text-gray-500 truncate">{server.domain || server.provider}</span>
                          <Show when={server.isCustom}>
                            <span class="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold uppercase tracking-wider border border-blue-500/20 shrink-0">Custom</span>
                          </Show>
                        </div>
                      </div>

                      <div class="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                        {/* Custom Toggle Switch */}
                        <button 
                          onClick={() => setServers(prev => prev.map(s => s.id === server.id ? { ...s, enabled: !isEnabled() } : s))} 
                          class={`w-11 h-6 rounded-full relative transition-colors shadow-inner flex items-center px-1 border ${isEnabled() ? 'border-[var(--p)]' : 'border-white/10'}`}
                          style={{ background: isEnabled() ? "var(--p-dim)" : "#1a1a1a" }}
                        >
                          <div class={`w-4 h-4 rounded-full transition-transform shadow-sm`} 
                               style={{ background: isEnabled() ? "var(--p)" : "#555", transform: isEnabled() ? 'translateX(18px)' : 'translateX(0)' }} />
                        </button>
                        
                        <Icon name={isExpanded() ? "expand_less" : "expand_more"} class="text-gray-500 transition-transform hidden sm:block" />
                      </div>
                    </div>

                    {/* Expanded Content View */}
                    <div class={`transition-all duration-300 overflow-hidden ${isExpanded() ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div class="p-3 sm:p-4 pt-0 border-t border-white/5 bg-black/20">
                        
                        {/* Quick Actions Toolbar - FIXED FOR MOBILE */}
                        <div class="flex flex-wrap items-center gap-2 py-3">
                          <button onClick={() => { setEditingId(server.id); setEditData({ movieUrl: server.movieUrl, tvUrl: server.tvUrl }); }} class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-black transition-all shrink-0" style="background: var(--p); box-shadow: 0 0 8px var(--p-glow)">
                            <Icon name="edit" class="text-[14px]"/> Edit
                          </button>

                          <button onClick={(e) => testServerUrl(server.id, 'movie', e)} class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-white border border-white/10 hover:border-white/20 bg-[#141414] transition-all shrink-0">
                            <Icon name="movie" class="text-[14px]" style="color: var(--p)"/> Movie
                          </button>

                          <button onClick={(e) => testServerUrl(server.id, 'tv', e)} class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-white border border-white/10 hover:border-white/20 bg-[#141414] transition-all shrink-0">
                            <Icon name="tv" class="text-[14px]" style="color: var(--p)"/> TV
                          </button>
                          
                          <div class="flex-1" /> {/* Spacer */}
                          
                          <Show when={!server.isCustom && editingId() !== server.id}>
                            <button onClick={() => setReplaceMode(server.id)} class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shrink-0" style="color: var(--p2); border: 1px solid rgba(var(--p2-rgb, 255,120,196), 0.3); background: rgba(var(--p2-rgb, 255,120,196), 0.1)">
                              <Icon name="swap_horiz" class="text-[14px]"/> Replace
                            </button>
                          </Show>
                          <Show when={server.isCustom}>
                            <button onClick={(e) => deleteCustomServer(server.id, e)} class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 border border-red-500/30 bg-red-500/10 transition-all shrink-0">
                              <Icon name="delete" class="text-[14px]"/> Delete
                            </button>
                          </Show>
                        </div>

                        {/* Replace Mode UI */}
                        <Show when={replaceMode() === server.id}>
                          <div class="mb-3 p-3 rounded-xl border border-white/10 bg-[#141414] animate-fade-in">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--p)] mb-2">Select Replacement Node:</p>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <For each={servers().filter(s => s.id !== server.id && s.enabled !== false)}>
                                {(replacement) => (
                                  <button onClick={() => replaceServer(server.id, replacement.id)} class="px-2 py-2 rounded-lg text-xs font-bold text-white transition-all active:scale-95 hover:bg-white/10" style="background: var(--raised); border: 1px solid var(--border)">
                                    {replacement.name}
                                  </button>
                                )}
                              </For>
                            </div>
                            <button onClick={() => setReplaceMode(null)} class="mt-2 w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Cancel Replacement</button>
                          </div>
                        </Show>

                        {/* URL Read Area */}
                        <Show when={editingId() !== server.id}>
                          <div class="space-y-2 mt-1">
                            <div class="w-full px-3 py-2.5 rounded-xl border font-mono text-[11px] overflow-x-auto hide-scrollbar whitespace-nowrap text-gray-300" style="background: var(--raised); border-color: var(--border)">
                              <span class="text-gray-500 mr-2 select-none">Movie:</span> {server.movieUrl || 'None'}
                            </div>
                            <div class="w-full px-3 py-2.5 rounded-xl border font-mono text-[11px] overflow-x-auto hide-scrollbar whitespace-nowrap text-gray-300" style="background: var(--raised); border-color: var(--border)">
                              <span class="text-gray-500 mr-2 select-none">Series:</span> {server.tvUrl || 'None'}
                            </div>
                          </div>
                        </Show>

                        {/* URL Edit Mode Area */}
                        <Show when={editingId() === server.id}>
                          <div class="space-y-3 mt-1 animate-fade-in p-3 rounded-xl border border-[var(--p)] bg-[#141414]">
                            <div>
                              <p class="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1 ml-1">Movie Endpoints</p>
                              <textarea value={editData().movieUrl || server.movieUrl} onInput={(e) => setEditData(prev => ({ ...prev, movieUrl: e.target.value }))} class="w-full px-3 py-2 rounded-lg text-[11px] font-mono border outline-none text-white focus:border-[var(--p)] transition-colors" rows="2" style="background: var(--deep); border-color: var(--border)" placeholder="https://example.com/movie/{id}" />
                            </div>
                            <div>
                              <p class="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1 ml-1">Series Endpoints</p>
                              <textarea value={editData().tvUrl || server.tvUrl} onInput={(e) => setEditData(prev => ({ ...prev, tvUrl: e.target.value }))} class="w-full px-3 py-2 rounded-lg text-[11px] font-mono border outline-none text-white focus:border-[var(--p)] transition-colors" rows="2" style="background: var(--deep); border-color: var(--border)" placeholder="https://example.com/tv/{id}/{season}/{episode}" />
                            </div>
                            <p class="text-[9px] font-mono text-gray-500 bg-black/50 p-2 rounded-lg border border-white/5 break-words">Vars: <span class="text-[var(--p)]">{'{id}'}</span>, <span class="text-[var(--p)]">{'{season}'}</span>, <span class="text-[var(--p)]">{'{episode}'}</span></p>
                            
                            <div class="flex gap-2 pt-1">
                              <button onClick={() => { setServers(prev => prev.map(s => s.id === server.id ? { ...s, movieUrl: editData().movieUrl, tvUrl: editData().tvUrl } : s)); setEditingId(null); }} class="flex-1 px-3 py-2.5 rounded-lg font-bold text-xs uppercase text-black active:scale-95 transition-transform" style="background: var(--p); box-shadow: 0 0 12px var(--p-glow)">Apply Changes</button>
                              <button onClick={() => setEditingId(null)} class="flex-1 px-3 py-2.5 rounded-lg border font-bold text-xs uppercase text-gray-300 hover:bg-white/5 active:scale-95 transition-all" style="background: var(--raised); border-color: var(--border)">Cancel</button>
                            </div>
                          </div>
                        </Show>

                      </div>
                    </div>
                  </div>
                );
              }}
            </For>

            {/* ADD CUSTOM SERVER SECTION */}
            <div class="mt-4 shrink-0">
              <Show when={!showAddForm()} fallback={
                <div class="rounded-2xl p-4 sm:p-5 border shadow-xl animate-fade-in" style="background: var(--surface); border-color: var(--p)">
                  <h4 class="font-bold text-base text-white mb-4 flex items-center gap-2">
                    <Icon name="add_circle" style="color: var(--p)" /> Initialize Custom Node
                  </h4>
                  <div class="space-y-4 mb-5">
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Display Name <span class="text-red-400">*</span></p>
                      <input value={newServer().name} onInput={e => setNewServer(p => ({...p, name: e.target.value}))} class="w-full px-4 py-3 rounded-xl text-sm font-bold border outline-none text-white focus:border-[var(--p)] transition-colors" style="background: var(--deep); border-color: var(--border)" placeholder="e.g. My Secret Node" />
                    </div>
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Movie URL Template <span class="text-red-400">*</span></p>
                      <textarea value={newServer().movieUrl} onInput={e => setNewServer(p => ({...p, movieUrl: e.target.value}))} class="w-full px-4 py-3 rounded-xl text-xs font-mono border outline-none text-white focus:border-[var(--p)] transition-colors" rows="2" style="background: var(--deep); border-color: var(--border)" placeholder="https://example.com/movie/{id}" />
                    </div>
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">TV URL Template</p>
                      <textarea value={newServer().tvUrl} onInput={e => setNewServer(p => ({...p, tvUrl: e.target.value}))} class="w-full px-4 py-3 rounded-xl text-xs font-mono border outline-none text-white focus:border-[var(--p)] transition-colors" rows="2" style="background: var(--deep); border-color: var(--border)" placeholder="https://example.com/tv/{id}/{season}/{episode}" />
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button onClick={addCustomServer} class="flex-[2] px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-black active:scale-95 transition-transform" style="background: var(--p); box-shadow: 0 0 16px var(--p-glow)">Deploy Node</button>
                    <button onClick={() => setShowAddForm(false)} class="flex-1 px-4 py-3 rounded-xl border font-bold text-xs uppercase tracking-widest text-gray-300 hover:bg-white/5 active:scale-95 transition-all" style="background: var(--raised); border-color: var(--border)">Abort</button>
                  </div>
                </div>
              }>
                <button onClick={() => setShowAddForm(true)} class="w-full py-4 rounded-2xl border border-dashed font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/5 active:scale-95 transition-all" style="border-color: var(--p); color: var(--p); background: var(--p-dim)">
                  <Icon name="add" class="text-lg" /> Connect New Provider
                </button>
              </Show>
            </div>

          </div>
        }>
          <div class="text-center py-12 flex flex-col items-center justify-center h-full" style="color: var(--muted)">
            <Icon name="settings_system_daydream" class="text-6xl mb-4 animate-pulse" style="color: var(--p); filter: drop-shadow(0 0 12px var(--p-glow))" />
            <p class="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Nodes...</p>
          </div>
        </Show>

        {/* Footer Actions */}
        <div class="border-t pt-4 sm:pt-5 mt-2 flex gap-3 shrink-0" style="border-color: var(--border)">
          <button onClick={resetToDefault} class="px-4 font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 shrink-0" style="background: #141414; color: var(--muted)" title="Reset Defaults">
            <Icon name="refresh" class="text-lg" />
          </button>
          <button onClick={saveServerSettings} class="flex-1 font-bold py-3.5 rounded-xl text-xs uppercase tracking-widest text-black active:scale-95 transition-transform flex items-center justify-center gap-2 shrink-0" style="background: var(--p); box-shadow: 0 0 20px var(--p-glow)">
            <Icon name="save" class="text-sm hidden sm:block" /> Save Config
          </button>
        </div>
      </div>
    </div>
  );
}
