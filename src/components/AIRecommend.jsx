/**
 * AIRecommend.jsx
 * Uses @google/generative-ai directly — no firebase/ai dependency needed.
 */

import { createSignal, createMemo, Show, For, onMount } from 'solid-js';
import { geminiModel } from '../firebase';
import { getSafeGenres } from '../utils';

const CACHE_KEY = 'cinelog_ai_recommendations_v2';
const CACHE_TTL = 24 * 60 * 60 * 1000;

const getTitle = (movie) => movie.title || movie.name || 'Unknown Title';

const parseRecommendations = (rawText) => {
  try {
    const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    if (Array.isArray(parsed)) return parsed.slice(0, 10).map(item => ({ title: item.title || String(item), reason: item.reason || 'Matches your taste profile.' }));
  } catch (e) {}

  return rawText
    .split('\n')
    .map(line => line.trim().replace(/^[\d]+[.)]\s*/, '').replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 10)
    .map(line => {
      const [title, ...reasonParts] = line.split(' - ');
      return { title: title.trim(), reason: reasonParts.join(' - ').trim() || 'Recommended from your watch history.' };
    });
};

const SparkleIcon = () => (
  <span class="material-symbols-outlined filled" style="font-size:20px;color:var(--p)">
    auto_awesome
  </span>
);

const RecommendationCard = (props) => (
  <div class="flex items-center gap-4 glass-surface rounded-2xl px-5 py-4 border border-white/5 hover:border-[var(--p)]/30 transition-all group animate-pop-in">
    <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border group-hover:scale-110 transition-transform"
      style="background: var(--p-dim); border-color: var(--p)">
      <span class="text-xs font-black font-headline" style="color:var(--p)">{props.index}</span>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-bold text-white leading-snug truncate">{props.item.title}</p>
      <p class="text-[10px] text-gray-500 font-semibold leading-snug mt-1 line-clamp-2">{props.item.reason}</p>
    </div>
    <button onClick={() => props.onSearch?.(props.item.title)} class="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95" style="background:var(--p);color:#05060a">
      Search
    </button>
  </div>
);

const SkeletonCard = () => (
  <div class="glass-surface rounded-2xl px-5 py-4 flex items-center gap-4">
    <div class="w-9 h-9 rounded-xl skeleton-bg shrink-0" />
    <div class="flex-1 h-4 rounded-lg skeleton-bg" />
  </div>
);

export function AIRecommend(props) {
  const [recommendations, setRecommendations] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [hasRun, setHasRun] = createSignal(false);

  const topRated = createMemo(() =>
    (props.watchlist?.() ?? [])
      .filter(m => Number(m.rating) >= 7 || m.status === 'Completed')
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))
      .slice(0, 25)
  );

  const favoriteGenres = createMemo(() => {
    const counts = {};
    topRated().forEach(m => getSafeGenres(m).forEach(g => counts[g] = (counts[g] || 0) + 1));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);
  });

  onMount(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.ts && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.items)) {
        setRecommendations(cached.items);
        setHasRun(true);
      }
    } catch (e) {}
  });

  const fetchRecommendations = async (force = false) => {
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached?.ts && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.items)) {
          setRecommendations(cached.items);
          setHasRun(true);
          return;
        }
      } catch (e) {}
    }

    const titles = topRated().map(getTitle);
    const seen = new Set((props.watchlist?.() ?? []).map(m => getTitle(m).toLowerCase()));

    if (titles.length === 0) {
      setError('Pehle kuch movies/shows rate ya complete karo — Gemini ko taste profile chahiye!');
      setHasRun(true);
      return;
    }

    setLoading(true);
    setError('');
    setRecommendations([]);
    setHasRun(true);

    try {
      const prompt =
        `User top rated/watched titles:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n` +
        `Favorite genres: ${favoriteGenres().join(', ') || 'unknown'}\n` +
        `Recommend 10 movies or shows the user has not seen. Return JSON array only: [{"title":"...","reason":"short reason"}].`;

      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseRecommendations(text).filter(item => !seen.has(item.title.toLowerCase())).slice(0, 10);

      if (parsed.length === 0) throw new Error('Unexpected format');
      setRecommendations(parsed);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: parsed }));
    } catch (err) {
      console.error('[AIRecommend]', err);
      if (err?.message?.includes('API_KEY')) setError('API key missing. Add VITE_GEMINI_API_KEY in Netlify environment variables.');
      else if (err?.message?.includes('quota') || err?.status === 429) setError('API quota reached. Try again in a minute.');
      else setError('Gemini se response nahi aaya. Dobara try karo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="glass-surface rounded-[2rem] p-6 border border-white/5 relative overflow-hidden">
      <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none" style="background: radial-gradient(circle, var(--p), transparent)" />

      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2.5">
          <SparkleIcon />
          <div>
            <h3 class="text-base font-black font-headline text-white leading-none">For You</h3>
            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">10 Gemini picks · cached 24h</p>
          </div>
        </div>
        <Show when={topRated().length > 0}>
          <span class="tag-chip" style="color:var(--p)">{topRated().length} taste signals</span>
        </Show>
      </div>

      <Show when={hasRun()}>
        <div class="flex flex-col gap-3 mb-5">
          <Show when={loading()}>
            <For each={[1, 2, 3, 4]}>{() => <SkeletonCard />}</For>
            <p class="text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest pt-1 animate-pulse">Gemini soch raha hai…</p>
          </Show>
          <Show when={!loading() && error()}>
            <div class="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
              <span class="material-symbols-outlined text-red-400 text-[20px] shrink-0 mt-0.5">error_outline</span>
              <p class="text-sm text-red-300 font-medium leading-snug">{error()}</p>
            </div>
          </Show>
          <Show when={!loading() && recommendations().length > 0}>
            <For each={recommendations()}>{(item, i) => <RecommendationCard item={item} index={i() + 1} onSearch={props.onSearch} />}</For>
          </Show>
        </div>
      </Show>

      <button
        onClick={() => fetchRecommendations(true)}
        disabled={loading()}
        class={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-95 ${loading() ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'text-[#0c0e14] hover:brightness-110 shadow-lg'}`}
        style={!loading() ? 'background: var(--p); box-shadow: 0 0 18px var(--p-glow)' : ''}
      >
        <Show when={!loading()} fallback={<><span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Gemini se pooch raha hai…</>}>
          <SparkleIcon />
          {recommendations().length > 0 ? 'Refresh Recommendations' : 'Get Recommendations'}
        </Show>
      </button>
    </div>
  );
}
