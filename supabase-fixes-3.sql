-- ══════════════════════════════════════════
-- RESONA — Fixes Part 3
-- Run AFTER supabase-fixes-2.sql.
-- ══════════════════════════════════════════

-- ═══ 1. Fix emotional_tone constraint: add the 5 unlockable tones ═══
-- The original schema only listed the 5 base tones. The 5 unlockable tones
-- (ruhe, hingabe, trauer, staunen, begehren) were added to the frontend in
-- the 10-tones feature but the DB constraint was never updated, so any send
-- using those tones fails with a CHECK violation.
ALTER TABLE public.traces
  DROP CONSTRAINT IF EXISTS traces_emotional_tone_check;
ALTER TABLE public.traces
  ADD CONSTRAINT traces_emotional_tone_check
  CHECK (emotional_tone IN (
    'nearness', 'longing', 'tension', 'warmth', 'playfulness',
    'ruhe', 'hingabe', 'trauer', 'staunen', 'begehren'
  ));

-- ═══ 2. Fix resonance_events type constraint: add tone_resonance ═══
-- supabase-fixes-2.sql added the type constraint but omitted 'tone_resonance'.
-- When a Tone Resonance moment fires, persistMoment() fails silently because
-- the INSERT violates the constraint.
ALTER TABLE public.resonance_events
  DROP CONSTRAINT IF EXISTS resonance_events_type_check;
ALTER TABLE public.resonance_events
  ADD CONSTRAINT resonance_events_type_check
  CHECK (type IN (
    'twin_connection', 'trace_convergence', 'amplified_reveal',
    'tone_resonance', 'still_here', 'nudge', 'turn_nudge'
  ));
