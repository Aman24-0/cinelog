import { Show, For } from 'solid-js';
import { Icon } from '../../utils';

export function StreamingPanel(props) {
  const fastList = () => props.availableServers.filter(s => ['vidzee', 'vidlink'].includes(s.id));
  const embedList = () => props.availableServers.filter(s => ['vidsrcru', 'peachify', 'vidsrccc', 'autoembed', 'vidnest'].includes(s.id));
  const customList = () => props.availableServers.filter(s => !['vidzee', 'vidlink', 'vidsrcru', 'peachify', 'vidsrccc', 'autoembed', 'vidnest'].includes(s.id));

  const Chip = (srv) => (
      <button
          type="button"
          onClick={(e) => { e.stopPropagation(); props.setActiveServer(srv.id); }}
          class="flex items-center justify-center gap-1.5 w-full h-9 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
          style={props.activeServer === srv.id
              ? 'border: 1px solid var(--p); background: var(--p-dim); color: var(--p); box-shadow: 0 0 10px var(--p-glow)'
              : 'border: 1px solid var(--border); background: var(--raised); color: var(--muted)'}>
          <Icon name={srv.icon} class="text-[13px] shrink-0" />
          <span class="truncate">{srv.name}</span>
      </button>
  );

  const GroupLabel = (label) => (
      <div class="flex items-center gap-2 mt-3 mb-1.5">
          <span class="text-[8px] font-black uppercase tracking-[0.18em] shrink-0" style="color: var(--muted)">{label}</span>
          <div class="flex-1 h-px" style="background: var(--border)" />
      </div>
  );

  const handlePlayClick = (e) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    if (!props.movie?.watchProgress || props.movie.watchProgress.currentTime === 0) {
        const inferred = props.inferDurationSeconds();
        if (inferred > 0) props.setContentDuration(inferred);
        props.setWatchProgress({ currentTime: 0, duration: inferred }); 
    } else {
        if (props.movie.watchProgress.duration) props.setContentDuration(props.movie.watchProgress.duration);
        props.setWatchProgress(props.movie.watchProgress);
    }
    props.setPlayerStartProgress(props.movie.watchProgress?.currentTime || 0);
    props.setReceivedRealProgress(false);
    props.setPlayerSessionStart(Date.now());
    props.setShowPlayer(true); 
  };

  return (
    <div class="mb-6 bg-black/40 backdrop-blur-md p-4 rounded-[1.5rem] border border-white/5 shadow-inner">
        <div class="flex justify-between items-center mb-3 px-1">
            <span class="text-[9px] uppercase font-black text-gray-400 tracking-widest flex items-center gap-1.5"><Icon name="router" class="text-[12px] text-[var(--primary)]"/> Streaming Node</span>
        </div>
        <div class="pb-1">
            <Show when={fastList().length > 0}>{GroupLabel('⚡ Fast')}<div class="grid grid-cols-2 gap-1.5"><For each={fastList()}>{(srv) => <div>{Chip(srv)}</div>}</For></div></Show>
            <Show when={embedList().length > 0}>{GroupLabel('📡 Embed')}<div class="grid grid-cols-2 gap-1.5"><For each={embedList()}>{(srv) => <div>{Chip(srv)}</div>}</For></div></Show>
            <Show when={customList().length > 0}>{GroupLabel('🔗 Custom')}<div class="grid grid-cols-2 gap-1.5"><For each={customList()}>{(srv) => <div>{Chip(srv)}</div>}</For></div></Show>
            
            <div class="flex items-center gap-2 mt-3">
                <button type="button" onClick={(e) => { e.stopPropagation(); props.setActiveServer('DIRECT_PLAY'); }}
                    class="flex-1 flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                    style={props.activeServer === 'DIRECT_PLAY'
                        ? 'border: 1px solid #3b82f6; background: rgba(59,130,246,0.15); color: #3b82f6; box-shadow: 0 0 10px rgba(59,130,246,0.3)'
                        : 'border: 1px solid var(--border); background: var(--raised); color: var(--muted)'}>
                    <Icon name="dns" class="text-[13px] shrink-0" /> Direct Play
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); props.setIsEditingDirectUrl(!props.isEditingDirectUrl); }}
                    class="w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white transition-colors shrink-0" title="Edit Custom URL">
                    <Icon name="edit" class="text-[13px]" />
                </button>
            </div>
        </div>

        <Show when={props.isEditingDirectUrl}>
            <div class="flex gap-2 mt-1 px-1 mb-2 animate-fade-in">
                <input type="text" value={props.directPlayUrl} onInput={e => props.setDirectPlayUrl(e.target.value)} placeholder="Paste custom video URL here..." class="flex-1 bg-[#0c0e14] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-[#3b82f6] transition-colors"/>
                <button type="button" onClick={(e) => { e.stopPropagation(); localStorage.setItem('cinelog_direct_play_url', props.directPlayUrl); props.setIsEditingDirectUrl(false); if(props.showToast) props.showToast("Custom URL Saved!"); }} class="bg-[#3b82f6] hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">Save</button>
            </div>
        </Show>
        <Show when={!props.isEditingDirectUrl && props.directPlayUrl && props.activeServer === 'DIRECT_PLAY'}>
            <div class="text-[9px] text-[#3b82f6] mt-1 px-2 truncate mb-2 animate-fade-in opacity-80">Link: {props.directPlayUrl}</div>
        </Show>
        
        <button type="button" onClick={handlePlayClick}
          class="w-full mt-3 font-black py-4 rounded-xl uppercase text-[11px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
          style="background: var(--p); color: #05060a; box-shadow: 0 0 24px var(--p-glow)">
            <Icon name="play_circle" fill class="text-[18px]"/> 
            {props.movie?.watchProgress && props.movie.watchProgress.currentTime > 0 ? 'Resume Movie' : 'Watch Now'}
        </button>
    </div>
  );
}
