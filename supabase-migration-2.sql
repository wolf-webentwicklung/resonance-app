-- ══════════════════════════════════════════
-- RESONA — Migration 2: Still-here + Nudge
-- Run ONCE after supabase-migration.sql.
-- Safe to re-run.
-- ══════════════════════════════════════════

-- Extend resonance_events to support new event types
ALTER TABLE public.resonance_events 
  DROP CONSTRAINT IF EXISTS resonance_events_type_check;
ALTER TABLE public.resonance_events 
  ADD CONSTRAINT resonance_events_type_check 
  CHECK (type IN (
    'twin_connection', 'trace_convergence', 'amplified_reveal',
    'still_here', 'nudge'
  ));

-- Ensure the RPC function exists and accepts the new types
CREATE OR REPLACE FUNCTION create_resonance_event(
  p_pair_id uuid, p_type text, p_tone text, 
  p_trigger_traces uuid[], p_extra_data jsonb
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pairs 
    WHERE id = p_pair_id AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  
  INSERT INTO public.resonance_events (pair_id, type, tone, trigger_traces, extra_data)
  VALUES (p_pair_id, p_type, p_tone, p_trigger_traces, p_extra_data)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
