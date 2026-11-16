-- STEP 1: run this alone, then run step 2
-- Adds the new role value. Must be committed before it can be used.

alter type public.participant_role add value if not exists 'admin';
