// ══════════════════════════════════════════
// Resonance Moment Detection
// Checks conditions and queues moments so none are lost
// ══════════════════════════════════════════

import { getRecentTraces, createResonanceEvent } from './supabase.js';

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

// Check for Twin Connection: both users sent within 30 minutes
export async function checkTwinConnection(pairId, justSentUserId, tone) {
  var traces = await getRecentTraces(pairId, 0.5); // last 30 min
  if (traces.length < 2) return null;

  // Check if there are traces from BOTH users
  var senders = new Set(traces.map(function(t) { return t.sender_id; }));
  if (senders.size < 2) return null;

  // Twin connection! Create event
  var traceIds = traces.slice(0, 2).map(function(t) { return t.id; });
  return {
    type: 'twin_connection',
    tone: tone,
    triggerTraces: traceIds,
  };
}

// Check for Amplified Reveal: incoming trace has high gesture intensity
export function checkAmplifiedReveal(trace) {
  if (!trace || !trace.gesture_data || !trace.gesture_data.path) return null;
  var analysis = analyzeGesture(trace.gesture_data.path);

  // Threshold: duration > 2s AND direction changes > 5 AND above-average intensity
  if (analysis.duration > 2000 && analysis.dirs > 5 && analysis.intensity > 0.5) {
    return {
      type: 'amplified_reveal',
      tone: trace.emotional_tone,
      triggerTraces: [trace.id],
    };
  }
  return null;
}

// Check for Trace Convergence: paths of two most recent traces overlap significantly
export async function checkTraceConvergence(pairId, justDiscoveredTrace) {
  var traces = await getRecentTraces(pairId, 24); // last 24h
  if (traces.length < 2) return null;

  // Get the two most recent traces from different users
  var other = traces.find(function(t) {
    return t.sender_id !== justDiscoveredTrace.sender_id && t.gesture_data && t.gesture_data.path;
  });
  if (!other) return null;

  var pathA = justDiscoveredTrace.gesture_data.path;
  var pathB = other.gesture_data.path;
  if (!pathA || !pathB || pathA.length < 3 || pathB.length < 3) return null;

  // Calculate overlap: for each point in A, check if any point in B is within radius
  var overlapRadius = 0.08;
  var overlapCount = 0;
  pathA.forEach(function(ptA) {
    for (var i = 0; i < pathB.length; i++) {
      var d = Math.sqrt((ptA.x - pathB[i].x) ** 2 + (ptA.y - pathB[i].y) ** 2);
      if (d < overlapRadius) { overlapCount++; break; }
    }
  });

  var overlapRatio = overlapCount / pathA.length;
  // Need at least 40% overlap
  if (overlapRatio < 0.4) return null;

  return {
    type: 'trace_convergence',
    tone: justDiscoveredTrace.emotional_tone,
    triggerTraces: [justDiscoveredTrace.id, other.id],
  };
}

// Main detection: returns array of moments to queue (can be 0, 1, or multiple)
export async function detectMoments(pairId, userId, justDiscoveredTrace, tone) {
  var moments = [];

  // 1. Twin Connection
  var twin = await checkTwinConnection(pairId, userId, tone);
  if (twin) moments.push(twin);

  // 2. Amplified Reveal
  var amp = checkAmplifiedReveal(justDiscoveredTrace);
  if (amp) moments.push(amp);

  // 3. Trace Convergence
  var conv = await checkTraceConvergence(pairId, justDiscoveredTrace);
  if (conv) moments.push(conv);

  return moments; // all of them, caller queues and plays sequentially
}
