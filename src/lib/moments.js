// ══════════════════════════════════════════
// Resonance Moment Detection
// — Cooldown between moments (configurable, default 8h)
// — Priority: twin_connection > trace_convergence > amplified_reveal
// — Only ONE moment per reveal (the highest-priority match)
// — Events are written to DB so the partner receives them
// ══════════════════════════════════════════

import { getRecentTraces, getLastResonanceEvent, createResonanceEvent } from './supabase.js';
import { MOMENT_COOLDOWN_HOURS, MOMENT_PRIORITY } from './constants.js';

function analyzeGesture(path) {
  if (!path || path.length < 2) return { intensity: 0, dirs: 0, duration: 0 };
  var dur = path[path.length - 1].t - path[0].t, td = 0, dc = 0;
  for (var i = 1; i < path.length; i++) {
    var dx = path[i].x - path[i-1].x, dy = path[i].y - path[i-1].y;
    td += Math.sqrt(dx*dx + dy*dy);
    if (i > 1) {
      var a = path[i-1].x - path[i-2].x, b = path[i-1].y - path[i-2].y;
      if (Math.abs(a * dy - b * dx) > 0.0006) dc++;
    }
  }
  var spd = dur > 0 ? td / (dur / 1000) : 0;
  var intensity = Math.min(1, Math.max(0, (dur/3000)*0.3 + (dc/10)*0.4 + spd*0.3));
  return { intensity, dirs: dc, duration: dur };
}

// ── Twin Connection ──
// TIGHTENED: both users must have sent within the last 5 MINUTES (not 30)
async function checkTwinConnection(pairId, justSentUserId, tone) {
  var traces = await getRecentTraces(pairId, 5 / 60); // last 5 minutes
  if (traces.length < 2) return null;

  var senders = new Set(traces.map(function(t) { return t.sender_id; }));
  if (senders.size < 2) return null;

  var traceIds = traces.slice(0, 2).map(function(t) { return t.id; });
  return {
    type: 'twin_connection',
    tone: tone,
    triggerTraces: traceIds,
  };
}

// ── Amplified Reveal ──
// TIGHTENED: needs duration > 3s, dirChanges > 8, intensity > 0.65
function checkAmplifiedReveal(trace) {
  if (!trace || !trace.gesture_data || !trace.gesture_data.path) return null;
  var analysis = analyzeGesture(trace.gesture_data.path);

  if (analysis.duration > 3000 && analysis.dirs > 8 && analysis.intensity > 0.65) {
    return {
      type: 'amplified_reveal',
      tone: trace.emotional_tone,
      triggerTraces: [trace.id],
    };
  }
  return null;
}

// ── Trace Convergence ──
// TIGHTENED: needs 55% overlap (was 40%)
async function checkTraceConvergence(pairId, justDiscoveredTrace) {
  var traces = await getRecentTraces(pairId, 24);
  if (traces.length < 2) return null;

  var other = traces.find(function(t) {
    return t.sender_id !== justDiscoveredTrace.sender_id && t.gesture_data && t.gesture_data.path;
  });
  if (!other) return null;

  var pathA = justDiscoveredTrace.gesture_data.path;
  var pathB = other.gesture_data.path;
  if (!pathA || !pathB || pathA.length < 3 || pathB.length < 3) return null;

  var overlapRadius = 0.08;
  var overlapCount = 0;
  pathA.forEach(function(ptA) {
    for (var i = 0; i < pathB.length; i++) {
      var d = Math.sqrt((ptA.x - pathB[i].x) ** 2 + (ptA.y - pathB[i].y) ** 2);
      if (d < overlapRadius) { overlapCount++; break; }
    }
  });

  var overlapRatio = overlapCount / pathA.length;
  if (overlapRatio < 0.55) return null;

  return {
    type: 'trace_convergence',
    tone: justDiscoveredTrace.emotional_tone,
    triggerTraces: [justDiscoveredTrace.id, other.id],
  };
}

// ── Main detection ──
// Returns at most ONE moment (the highest-priority one), or null.
// Checks cooldown against the last resonance event in the DB.
export async function detectMoment(pairId, userId, justDiscoveredTrace, tone) {
  // 1. Cooldown check: was there a moment recently?
  try {
    var lastEvent = await getLastResonanceEvent(pairId);
    if (lastEvent) {
      var hoursSince = (Date.now() - new Date(lastEvent.triggered_at).getTime()) / 3600000;
      if (hoursSince < MOMENT_COOLDOWN_HOURS) {
        return null; // too recent, skip
      }
    }
  } catch (e) {
    // If DB query fails, skip moment detection rather than block the flow
    console.warn("Moment cooldown check failed:", e);
    return null;
  }

  // 2. Check all conditions
  var candidates = [];

  var twin = await checkTwinConnection(pairId, userId, tone);
  if (twin) candidates.push(twin);

  var amp = checkAmplifiedReveal(justDiscoveredTrace);
  if (amp) candidates.push(amp);

  var conv = await checkTraceConvergence(pairId, justDiscoveredTrace);
  if (conv) candidates.push(conv);

  if (candidates.length === 0) return null;

  // 3. Pick highest priority
  candidates.sort(function(a, b) {
    return (MOMENT_PRIORITY[b.type] || 0) - (MOMENT_PRIORITY[a.type] || 0);
  });

  return candidates[0]; // only the best one
}

// ── Persist a moment to the DB (called after user interaction) ──
export async function persistMoment(pairId, moment, extraData) {
  try {
    return await createResonanceEvent(
      pairId,
      moment.type,
      moment.tone,
      moment.triggerTraces,
      extraData
    );
  } catch (e) {
    console.error("Failed to persist resonance event:", e);
    return null;
  }
}
