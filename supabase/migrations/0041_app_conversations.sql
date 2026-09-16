-- A conversation between a business and Kane, from inside the One app.
--
-- The business is an app user, so Kane's replies reach them as a push
-- notification, not an email: the row remembers who they are. Their own
-- website visitors have no app, which is why those get email instead.
alter table public.conversations add column if not exists app_user_id uuid references auth.users (id) on delete set null;
create index if not exists conversations_app_user on public.conversations (app_user_id) where app_user_id is not null;
