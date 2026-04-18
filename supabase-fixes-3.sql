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

-- ═══ 3. Re-apply traces_insert RLS policy (safety) ═══
-- If supabase-security-fixes.sql ran with errors and the DROP succeeded but
-- CREATE POLICY failed, there is NO traces_insert policy → all INSERTs denied
-- by default (RLS on, no policy = deny). Re-applying idempotently fixes this.
DROP POLICY IF EXISTS "traces_insert" ON public.traces;
CREATE POLICY "traces_insert" ON public.traces FOR INSERT WITH CHECK (
  traces.sender_id = auth.uid()
  AND traces.pair_id IN (
    SELECT p.id FROM public.pairs p
    WHERE p.user_a_id = auth.uid() OR p.user_b_id = auth.uid()
  )
);

-- ═══ 4. Re-apply traces_update RLS policy (safety) ═══
DROP POLICY IF EXISTS "traces_update" ON public.traces;
CREATE POLICY "traces_update" ON public.traces FOR UPDATE USING (
  traces.receiver_id = auth.uid()
  AND traces.pair_id IN (
    SELECT p.id FROM public.pairs p
    WHERE p.user_a_id = auth.uid() OR p.user_b_id = auth.uid()
  )
);

-- ═══ 5. Grant execute on create_resonance_event ═══
-- supabase-security-fixes.sql DROPped and recreated this function without
-- an explicit GRANT. Re-granting ensures authenticated users can call it
-- (needed for still_here, nudge, turn_nudge, and moment persistence).
GRANT EXECUTE ON FUNCTION create_resonance_event(uuid, text, text, uuid[], jsonb) TO authenticated;
