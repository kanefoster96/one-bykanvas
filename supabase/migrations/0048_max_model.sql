-- Which Max they chose on the way in: the Max page's button carries it
-- (?max=trades) through the wizard onto the profile, so the setup form
-- can skip the question. Null when they arrived some other way (an
-- upgrade from the account page), and the form asks as before.
alter table public.profiles
  add column if not exists max_model text
  check (max_model is null or max_model in ('trades', 'clubs', 'salon', 'other'));
