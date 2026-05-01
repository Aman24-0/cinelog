/**
 * AIRecommend.jsx
 * Uses @google/generative-ai directly — no firebase/ai dependency needed.
 *
 * Usage in Dashboard.jsx:
 *   import { AIRecommend } from '../components/AIRecommend';
 *   <AIRecommend watchlist={props.watchlist} />
 *
 * Setup:
 *   1. npm install @google/generative-ai
 *   2. In Netlify env vars add: VITE_GEMINI_API_KEY=your_key
 *   3. Get key free from: https://aistudio.google.com/app/apikey
 */

import { createSignal, createMemo, Show, For } from 'solid-js';
import { geminiModel } from '../firebase';
import { Icon } from '../utils';


// ── Helpers ──────────────────────────────────────────────────────────────────

const getTitle = (movie) => movie.title || movie.name || 'Unknown Title';

const parseRecommendations = (rawText) =>
  rawText
    .split('\n')
    .map(line => line.trim().replace(/^[\d]+[.)]\s*/, '').replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);

// ── Sub-components ────────────────────────────────────────────────────────────

const SparkleIcon = () => (
  <span class="material-symbols-outlined filled text-[var(--primary)]" style="font-size:20px">
    auto_awesome
  </span>
);

const RecommendationCard = (props) => (
  <div class="flex items-center gap-4 glass-surface rounded-2xl px-5 py-4 border border-white/5 hover:border-[var(--primary)]/30 transition-all group animate-pop-in">
    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--secondary)]/20 to-[var(--primary)]/20 flex items-center justify-center shrink-0 border border-[var(--primary)]/20 group-hover:scale-110 transition-transform">
      <span class="text-xs font-black font-headline text-[var(--primary)]">{props.index}</span>
    </div>
    <p class="text-sm font-bold text-white leading-snug">{props.title}</p>
    <span class="material-symbols-outlined text-gray-700 group-hover:text-[var(--primary)] transition-colors ml-auto text-[18px]">
      chevron_right
    </span>
  </div>
);

const SkeletonCard = () => (
  <div class="glass-surface rounded-2xl px-5 py-4 flex items-center gap-4">
    <div class="w-9 h-9 rounded-xl skeleton-bg shrink-0" />
    <div class="flex-1 h-4 rounded-lg skeleton-bg" />
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

export function AIRecommend(props) {
  const [recommendations, setRecommendations] = createSignal([]);
  const [loading, setLoading]               = createSignal(false);
  const [error, setError]                   = createSignal('');
  const [hasRun, setHasRun]                 = createSignal(false);

  const completedTitles = createMemo(() =>
    (props.watchlist?.() ?? [])
      .filter(m => m.status === 'Completed')
      .map(getTitle)
  );

  const fetchRecommendations = async () => {
    const titles = completedTitles();

    if (titles.length === 0) {
      setError('Pehle kuch movies "Completed" mark karo — Gemini ko dekhna hoga kya pasand hai!');
      setHasRun(true);
      return;
    }

    setLoading(true);
    setError('');
    setRecommendations([]);
    setHasRun(true);

    try {
      const prompt =
        `Based on these movies/shows I have watched:\n` +
        titles.map((t, i) => `${i + 1}. ${t}`).join('\n') +
        `\n\nRecommend 3 new movies or shows I would love. ` +
        `Return ONLY the titles, one per line, with no extra explanation or numbering.`;

      const result = await geminiModel.generateContent(prompt);
      const text   = result.response.text();
      const parsed = parseRecommendations(text);

      if (parsed.length === 0) throw new Error('Unexpected format');
      setRecommendations(parsed);
    } catch (err) {
      console.error('[AIRecommend]', err);
      if (err?.message?.includes('API_KEY')) {
        setError('API key missing. Add VITE_GEMINI_API_KEY in Netlify environment variables.');
      } else if (err?.message?.includes('quota') || err?.status === 429) {
        setError('API quota reached. Try again in a minute.');
      } else {
        setError('Gemini se response nahi aaya. Dobara try karo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="glass-surface rounded-[2rem] p-6 border border-white/5 relative overflow-hidden">
      <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none"
        style="background: radial-gradient(circle, var(--primary), transparent)" />

      {/* Header */}
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2.5">
          <SparkleIcon />
          <div>
            <h3 class="text-base font-black font-headline text-white leading-none">AI Picks</h3>
            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Powered by Gemini</p>
          </div>
        </div>
        <Show when={completedTitles().length > 0}>
          <span class="tag-chip text-[var(--primary)]">{completedTitles().length} watched</span>
        </Show>
      </div>

      {/* Results */}
      <Show when={hasRun()}>
        <div class="flex flex-col gap-3 mb-5">
          <Show when={loading()}>
            <For each={[1, 2, 3]}>{() => <SkeletonCard />}</For>
            <p class="text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest pt-1 animate-pulse">
              Gemini soch raha hai…
            </p>
          </Show>
          <Show when={!loading() && error()}>
            <div class="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
              <span class="material-symbols-outlined text-red-400 text-[20px] shrink-0 mt-0.5">error_outline</span>
              <p class="text-sm text-red-300 font-medium leading-snug">{error()}</p>
            </div>
          </Show>
          <Show when={!loading() && recommendations().length > 0}>
            <For each={recommendations()}>
              {(title, i) => <RecommendationCard title={title} index={i() + 1} />}
            </For>
          </Show>
        </div>
      </Show>

      {/* Button */}
      <button
        onClick={fetchRecommendations}
        disabled={loading()}
        class={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-95
          ${loading()
            ? 'bg-white/5 text-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-[var(--secondary)]/80 to-[var(--primary)]/80 text-[#0c0e14] hover:brightness-110 shadow-lg shadow-[var(--primary)]/20'
          }`}
      >
        <Show when={!loading()} fallback={
          <><span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Gemini se pooch raha hai…</>
        }>
          <SparkleIcon />
          {hasRun() && recommendations().length > 0 ? 'Naye Picks Lao' : 'AI Recommendations Lo'}
        </Show>
      </button>

      <p class="text-center text-[9px] text-gray-700 mt-3 font-bold uppercase tracking-widest">
        {completedTitles().length} completed title{completedTitles().length !== 1 ? 's' : ''} ke basis pe
      </p>
    </div>
  );
}
