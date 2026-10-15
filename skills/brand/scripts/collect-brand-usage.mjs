#!/usr/bin/env node
// Read only the explicitly supplied rollout. Never search sessions or export content.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const fields = {
  inputTokens: 'input_tokens', cachedInputTokens: 'cached_input_tokens',
  outputTokens: 'output_tokens', reasoningOutputTokens: 'reasoning_output_tokens',
  totalTokens: 'total_tokens',
};
const unavailable = () => Object.fromEntries(Object.keys(fields).map(k => [k, null]));
const numeric = v => Number.isSafeInteger(v) && v >= 0;
const normalize = value => Object.fromEntries(Object.entries(fields).map(([key, snake]) =>
  [key, numeric(value?.[key] ?? value?.[snake]) ? (value[key] ?? value[snake]) : null]));

export function collectBrandUsage(jsonl, options) {
  const { thread, turn, startLine, endLine, category, round } = options;
  if (!thread || !round || !['development', 'trial'].includes(category))
    throw new Error('Require thread, round and category (development or trial).');
  const ranged = startLine !== undefined || endLine !== undefined;
  if (Boolean(turn) === ranged || (ranged && (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 1 || endLine < startLine)))
    throw new Error('Select exactly one turn or an inclusive startLine/endLine range.');
  let sessionThread = null, currentTurn = null;
  let previous = null, selectedEvents = 0, duplicateEvents = 0, selectedLines = 0;
  const totals = unavailable(), invalid = new Set(), reasons = new Set();
  const lines = jsonl.split(/\r?\n/);
  if (ranged && endLine > lines.length - (lines.at(-1) === '' ? 1 : 0)) throw new Error('Range exceeds the supplied log.');
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].trim()) continue;
    let row;
    try { row = JSON.parse(lines[index]); } catch { throw new Error(`Invalid JSON at line ${index + 1}; no content exported.`); }
    const payload = row.payload || {};
    if (row.type === 'session_meta') {
      if (sessionThread && sessionThread !== payload.id) throw new Error('Mixed session identities.');
      sessionThread = payload.id;
      if (sessionThread !== thread) throw new Error('Supplied thread does not match session metadata.');
    }
    if (row.type === 'turn_context') {
      currentTurn = payload.turn_id ?? payload.turnId ?? null;
    }
    if (row.type === 'event_msg' && payload.type === 'task_started') currentTurn = payload.turn_id ?? null;
    const rpc = row.method === 'thread/tokenUsage/updated' ? row.params : null;
    const eventThread = rpc?.threadId ?? sessionThread;
    const eventTurn = rpc?.turnId ?? payload.turn_id ?? currentTurn;
    const selected = eventThread === thread && (turn ? eventTurn === turn : index + 1 >= startLine && index + 1 <= endLine);
    if (selected) selectedLines++;
    const raw = rpc?.tokenUsage?.total ?? (row.type === 'event_msg' && payload.type === 'token_count' ? payload.info?.total_token_usage : null);
    if (!raw || eventThread !== thread) continue;
    const cumulative = normalize(raw);
    const last = normalize(rpc?.tokenUsage?.last ?? payload.info?.last_token_usage);
    const fingerprint = JSON.stringify(cumulative);
    // A repeat is a notification, not another request. Do not sum last_token_usage.
    if (previous && JSON.stringify(previous) === fingerprint) { if (selected) duplicateEvents++; continue; }
    if (selected) {
      selectedEvents++;
      for (const key of Object.keys(fields)) {
        const delta = previous?.[key] !== null && previous?.[key] !== undefined && cumulative[key] !== null
          ? cumulative[key] - previous[key]
          : !previous && cumulative[key] !== null && cumulative[key] === last[key] ? last[key] : null;
        if (delta === null || delta < 0) {
          invalid.add(key);
          reasons.add(delta < 0 ? 'cumulative-counter-reset' : 'missing-field-or-prior-baseline');
        } else {
          totals[key] = (totals[key] ?? 0) + delta;
        }
      }
    }
    previous = cumulative;
  }
  for (const key of invalid) totals[key] = null;
  if (!selectedEvents) reasons.add('no-attributable-usage-events');
  // Per-model subtotals are intentionally omitted: a model switch and its usage
  // notification need not be adjacent, so context.model is not billing evidence.
  return {
    schema: 'brand-round-usage/v1', round, category,
    scope: { thread, ...(turn ? { turn } : { startLine, endLine }) },
    modelUsage: { status: Object.values(totals).every(v => v !== null) ? 'reported' : 'unavailable-or-partial', ...totals },
    imageGenerationUsage: { status: 'unavailable', tokens: null, reason: 'Image tool usage is not established by Codex model token counters; no estimates are made.' },
    evidence: { selectedLines, usageEvents: selectedEvents, duplicateNotifications: duplicateEvents, reasons: [...reasons] },
    accounting: 'Cached input is a subset of input; reasoning output is a subset of output. Do not add these subsets to total. Counts cover observed cumulative deltas only; unreported or in-flight work is unavailable. Keep development and trial reports separate.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2), opts = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--session', '--thread', '--turn', '--start-line', '--end-line', '--category', '--round'].includes(args[i]) || !args[i + 1])
        throw new Error('Usage: --session FILE --thread ID --round ID --category development|trial (--turn ID | --start-line N --end-line N)');
      const key = args[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (key in opts) throw new Error('Duplicate option.');
      opts[key] = key.endsWith('Line') ? Number(args[i + 1]) : args[i + 1];
    }
    if (!opts.session) throw new Error('An explicit --session JSONL file is required.');
    console.log(JSON.stringify(collectBrandUsage(fs.readFileSync(opts.session, 'utf8'), opts), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
