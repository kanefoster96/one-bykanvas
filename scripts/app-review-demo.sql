-- App Review demo account: "Little Movers Kids Club", a Business customer
-- with two months of sample data, so a reviewer signing in to the Kanvas One
-- app finds it as a real customer would. See mobile/store-submission.md.
--
-- Re-runnable: it deletes the demo login (everything hangs off it and
-- cascades) and builds it again with fresh dates. Run it in the Supabase SQL
-- editor (or via the MCP), after replacing __DEMO_PASSWORD__ with the password
-- given to App Review. If the MCP times out, run it in the SQL editor.
--
-- Nothing here emails or pushes anyone: there are no database triggers that
-- send, notifications only push when the API writes them, support replies
-- are stamped as already emailed, and every person in it is made up
-- (example.com addresses, Ofcom drama numbers 07700 900xxx).

do $$
declare
  demo_id  uuid := 'de30de30-0000-4000-8000-00000000a001';
  demo_pw  text := '__DEMO_PASSWORD__';
  demo_url text := 'https://kanvas.one/examples/kids-clubs';
  c1 uuid := 'de30de30-0000-4000-8000-00000000c001';
  c2 uuid := 'de30de30-0000-4000-8000-00000000c002';
  c3 uuid := 'de30de30-0000-4000-8000-00000000c003';
  c4 uuid := 'de30de30-0000-4000-8000-00000000c004';
  r1 uuid := 'de30de30-0000-4000-8000-00000000e001';
  r2 uuid := 'de30de30-0000-4000-8000-00000000e002';
begin
  if demo_pw = '__DEMO_PASSWORD__' then raise exception 'Set the demo password first.'; end if;

  delete from auth.users where id = demo_id;   -- cascades to profile, site and all its data

  -- The login: confirmed, email and password, no email sent.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token,
    reauthentication_token, is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', demo_id, 'authenticated', 'authenticated',
    'appreview@kanvas.one', extensions.crypt(demo_pw, extensions.gen_salt('bf')), now() - interval '62 days',
    '{"provider":"email","providers":["email"]}', '{"business_name":"Little Movers Kids Club","contact_name":"Alex"}',
    now() - interval '62 days', now(), '', '', '', '', '', '', '', '', false, false);
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  values (gen_random_uuid(), demo_id::text, demo_id,
    jsonb_build_object('sub', demo_id::text, 'email', 'appreview@kanvas.one', 'email_verified', true, 'phone_verified', false),
    'email', now() - interval '62 days', now(), now() - interval '62 days');

  -- The profile (made by the signup trigger): a live Business customer.
  -- subscribed_at is set and the month-in note stamped, so no follow-up or
  -- plan email ever goes to it.
  update public.profiles set
    business_name = 'Little Movers Kids Club', contact_name = 'Alex', phone = '07700 900123',
    business_type = 'Kids'' activity club', selected_plan = 'business', active_plan = 'business',
    subscription_status = 'active', current_period_end = now() + interval '19 days',
    subscribed_at = now() - interval '62 days', plan_note_sent_at = now() - interval '30 days',
    onboarded_at = now() - interval '62 days', site_status = 'live', site_url = demo_url,
    site_uses = array['Take bookings', 'Take payments', 'Chat with visitors'],
    admin_notes = 'App Review demo account (scripts/app-review-demo.sql). Not a real customer: no Stripe, made-up data.',
    marketing_optin = false, notify_optout = true, notifications_seen_at = now() - interval '2 days'
  where id = demo_id;

  insert into public.sites (id, owner_id, name, url, status, modules, created_at)
  values (demo_id, demo_id, 'Little Movers Kids Club', demo_url, 'live', array['chat', 'payments'], now() - interval '60 days');

  -- Visits: 60 days, busier in the last 30 (the ads), mostly phones.
  -- Set-based: a row-by-row loop takes over a minute and times out the MCP.
  insert into public.page_views (site_id, session, path, referrer, device, country, city, source, from_ad, campaign, created_at)
  select demo_id, sess,
    case when k = 1 then '/' else (array['/', '/classes', '/timetable', '/prices', '/book', '/parties', '/about', '/contact'])[1 + floor(random() * 8)::int] end,
    case when k = 1 then ref end, dev, 'GB',
    (array['Newcastle upon Tyne', 'Newcastle upon Tyne', 'Gateshead', 'Whitley Bay', 'Tynemouth', 'North Shields', 'Wallsend', 'Jesmond'])[1 + floor(random() * 8)::int],
    source, from_ad, campaign, t + make_interval(secs => (k - 1) * (25 + floor(random() * 70)::int))
  from (
    select s.*, case when r <= 2 then 'google.com' when r <= 4 then 'l.instagram.com' when r <= 6 then 'm.facebook.com' end as ref,
      case when r <= 2 then 'Google' when r <= 4 then 'Instagram' when r <= 6 then 'Facebook' end as source,
      case when r between 5 and 6 and d < 30 then 'yes' end as from_ad,
      case when r between 5 and 6 and d < 30 then 'Free trial week' end as campaign
    from (
      select d, 'demo-' || d || '-' || v as sess,
        least(date_trunc('day', now() - make_interval(days => d)) + make_interval(hours => 7 + floor(random() * 14)::int, mins => floor(random() * 60)::int), now() - interval '5 minutes') as t,
        floor(random() * 10)::int as r,
        case when random() < 0.74 then 'phone' else 'desktop' end as dev,
        1 + floor(random() * 3.4)::int as pages
      from generate_series(0, 59) d
      cross join lateral generate_series(1, 9 + floor(random() * 8)::int + case when d < 30 then 7 else 0 end
        + case when extract(isodow from now() - make_interval(days => d)) in (6, 7) then 4 else 0 end) v
    ) s
  ) x cross join lateral generate_series(1, pages) k;

  insert into public.page_clicks (site_id, session, path, label, target, created_at)
  select demo_id, session, '/', case when random() < 0.7 then 'Book a free session' else 'Call us' end,
    case when random() < 0.7 then '/book' else 'tel:07700900123' end, min(created_at) + interval '40 seconds'
  from public.page_views where site_id = demo_id group by session having random() < 0.22;

  -- Chats with website visitors.
  insert into public.conversations (id, site_id, visitor_token_hash, visitor_name, visitor_email, visitor_phone, page, status, channel,
    last_message_at, last_message_by, last_message_preview, owner_seen_at, created_at, session)
  values
    (c1, demo_id, md5('demo-c1'), 'Sarah Mitchell', 'sarah.mitchell@example.com', null, '/timetable', 'open', 'web',
      now() - interval '25 minutes', 'visitor', 'Perfect, Saturday at 10 works for us. Does she need to bring anything?', null, now() - interval '3 hours', 'demo-chat-1'),
    (c2, demo_id, md5('demo-c2'), 'James Carter', 'james.carter@example.com', null, '/prices', 'open', 'web',
      now() - interval '1 day 2 hours', 'owner', 'Yes, siblings get 10% off the second membership.', now() - interval '1 day 2 hours', now() - interval '1 day 4 hours', 'demo-chat-2'),
    (c3, demo_id, md5('demo-c3'), 'Priya Shah', 'priya.shah@example.com', '07700 900456', '/parties', 'open', 'web',
      now() - interval '3 days', 'owner', 'Lovely! I''ve pencilled in Sunday the 9th. I''ll text you the deposit link.', now() - interval '3 days', now() - interval '3 days 1 hour', 'demo-chat-3'),
    (c4, demo_id, md5('demo-c4'), null, null, null, '/', 'closed', 'web',
      now() - interval '9 days', 'owner', 'You''re welcome, see you then!', now() - interval '9 days', now() - interval '9 days 20 minutes', 'demo-chat-4');

  insert into public.messages (conversation_id, site_id, author, body, created_at) values
    (c1, demo_id, 'visitor', 'Hi! Do you have space in the Saturday class for a 4 year old?', now() - interval '3 hours'),
    (c1, demo_id, 'owner',   'Hi Sarah! Yes, we have two spaces in Little Movers (ages 3 to 5) on Saturdays at 10am. Your first session is free. Shall I book her in?', now() - interval '2 hours 50 minutes'),
    (c1, demo_id, 'visitor', 'Perfect, Saturday at 10 works for us. Does she need to bring anything?', now() - interval '25 minutes'),
    (c2, demo_id, 'visitor', 'How much is it a month, and is there a discount for two kids?', now() - interval '1 day 4 hours'),
    (c2, demo_id, 'owner',   'It''s £32 a month for one class a week.', now() - interval '1 day 3 hours'),
    (c2, demo_id, 'owner',   'Yes, siblings get 10% off the second membership.', now() - interval '1 day 2 hours'),
    (c3, demo_id, 'visitor', 'Do you do birthday parties? It''d be for 12 kids, aged 6.', now() - interval '3 days 1 hour'),
    (c3, demo_id, 'owner',   'We do! Two hours in the hall with a coach, games and an obstacle course, £180 for up to 15 children. Which date were you thinking?', now() - interval '3 days 50 minutes'),
    (c3, demo_id, 'visitor', 'Sunday the 9th if you can?', now() - interval '3 days 20 minutes'),
    (c3, demo_id, 'owner',   'Lovely! I''ve pencilled in Sunday the 9th. I''ll text you the deposit link.', now() - interval '3 days'),
    (c4, demo_id, 'visitor', 'What time do you open on Saturday?', now() - interval '9 days 20 minutes'),
    (c4, demo_id, 'owner',   'From 9am, first class at 9:30.', now() - interval '9 days 10 minutes'),
    (c4, demo_id, 'visitor', 'Great, thanks', now() - interval '9 days 5 minutes'),
    (c4, demo_id, 'owner',   'You''re welcome, see you then!', now() - interval '9 days');

  -- Payments taken through the website.
  insert into public.payments (site_id, source, ref, amount_pence, currency, status, refunded_pence, customer_email, customer_name, description, paid_at, created_at)
  select demo_id, 'site', 'demo_' || g, amt, 'gbp', st, rf, em, nm, ds, ts, ts
  from (values
    (1, 3200, 'paid', 0, 'emma.robson@example.com', 'Emma Robson', 'Monthly membership, Little Movers', now() - interval '2 hours'),
    (2, 5000, 'paid', 0, 'priya.shah@example.com', 'Priya Shah', 'Party deposit, Sunday 9th', now() - interval '2 days 22 hours'),
    (3, 3200, 'paid', 0, 'tom.hall@example.com', 'Tom Hall', 'Monthly membership, Mini Gym', now() - interval '4 days'),
    (4, 5760, 'paid', 0, 'james.carter@example.com', 'James Carter', 'Two memberships (sibling discount)', now() - interval '5 days'),
    (5, 3200, 'paid', 0, 'leah.dixon@example.com', 'Leah Dixon', 'Monthly membership, Little Movers', now() - interval '8 days'),
    (6, 9600, 'paid', 0, 'nina.ahmed@example.com', 'Nina Ahmed', 'Term pass, 12 weeks', now() - interval '11 days'),
    (7, 3200, 'refunded', 3200, 'mark.ellis@example.com', 'Mark Ellis', 'Monthly membership (moved away)', now() - interval '13 days'),
    (8, 3200, 'paid', 0, 'emma.robson@example.com', 'Emma Robson', 'Monthly membership, Little Movers', now() - interval '32 days'),
    (9, 3200, 'paid', 0, 'tom.hall@example.com', 'Tom Hall', 'Monthly membership, Mini Gym', now() - interval '34 days'),
    (10, 1500, 'paid', 0, 'grace.lee@example.com', 'Grace Lee', 'Holiday camp day', now() - interval '41 days'),
    (11, 3200, 'paid', 0, 'leah.dixon@example.com', 'Leah Dixon', 'Monthly membership, Little Movers', now() - interval '38 days')
  ) as p(g, amt, st, rf, em, nm, ds, ts);

  -- Contact form enquiries.
  insert into public.enquiries (site_id, name, email, phone, message, page, created_at) values
    (demo_id, 'Hannah Wright', 'hannah.wright@example.com', '07700 900789', 'Hi, is there a class for 18 month olds? Thanks, Hannah', '/contact', now() - interval '6 hours'),
    (demo_id, 'Ben Turner', 'ben.turner@example.com', null, 'Do you run anything in the October half term?', '/contact', now() - interval '6 days');

  -- Contacts: everyone they have heard from, with a note.
  insert into public.contacts (site_id, name, email, phone, source, first_seen_at, last_seen_at, created_at) values
    (demo_id, 'Emma Robson', 'emma.robson@example.com', '07700 900111', 'payment', now() - interval '32 days', now() - interval '2 hours', now() - interval '32 days'),
    (demo_id, 'Priya Shah', 'priya.shah@example.com', '07700 900456', 'chat', now() - interval '3 days', now() - interval '2 days 22 hours', now() - interval '3 days'),
    (demo_id, 'Sarah Mitchell', 'sarah.mitchell@example.com', null, 'chat', now() - interval '3 hours', now() - interval '25 minutes', now() - interval '3 hours'),
    (demo_id, 'James Carter', 'james.carter@example.com', null, 'chat', now() - interval '5 days', now() - interval '1 day 2 hours', now() - interval '5 days'),
    (demo_id, 'Tom Hall', 'tom.hall@example.com', null, 'payment', now() - interval '34 days', now() - interval '4 days', now() - interval '34 days'),
    (demo_id, 'Leah Dixon', 'leah.dixon@example.com', null, 'payment', now() - interval '38 days', now() - interval '8 days', now() - interval '38 days'),
    (demo_id, 'Nina Ahmed', 'nina.ahmed@example.com', null, 'payment', now() - interval '11 days', now() - interval '11 days', now() - interval '11 days'),
    (demo_id, 'Hannah Wright', 'hannah.wright@example.com', '07700 900789', 'enquiry', now() - interval '6 hours', now() - interval '6 hours', now() - interval '6 hours'),
    (demo_id, 'Ben Turner', 'ben.turner@example.com', null, 'enquiry', now() - interval '6 days', now() - interval '6 days', now() - interval '6 days'),
    (demo_id, 'Grace Lee', 'grace.lee@example.com', null, 'payment', now() - interval '41 days', now() - interval '41 days', now() - interval '41 days');
  insert into public.contact_notes (contact_id, site_id, body, created_at)
  select id, demo_id, 'Two children: Mia (4) in Little Movers, Jack (7) in Mini Gym.', now() - interval '20 days'
  from public.contacts where site_id = demo_id and name = 'Emma Robson';

  -- Support: requests to the Kanvas team, one finished, one waiting on them.
  insert into public.requests (id, user_id, site_id, kind, points, title, detail, status, created_at, done_at, last_note_at, last_note_by, customer_seen_at) values
    (r1, demo_id, demo_id, 'edit', 1, 'Add the new Saturday class', 'Can you add a new Little Movers class on Saturdays at 10am to the timetable please? Same price as the others.',
      'done', now() - interval '12 days', now() - interval '11 days', now() - interval '11 days', 'admin', now() - interval '10 days'),
    (r2, demo_id, demo_id, 'feature', 3, 'Party booking form', 'We get lots of party enquiries. Could the parties page have a booking form with the date, number of children and a deposit?',
      'waiting', now() - interval '2 days', null, now() - interval '20 hours', 'admin', null);
  insert into public.request_notes (request_id, author, body, private, emailed_at, created_at) values
    (r1, 'admin', 'Done! Saturday 10am is on the timetable and bookable now.', false, now() - interval '11 days', now() - interval '11 days'),
    (r1, 'customer', 'Brilliant, thank you!', false, now() - interval '10 days', now() - interval '10 days'),
    (r2, 'admin', 'Love this. Before we build it: how much should the deposit be, and which days can parties be booked on?', false, now() - interval '20 hours', now() - interval '20 hours');

  -- The bell: recent activity, already pushed (so nothing is sent).
  insert into public.notifications (user_id, for_admin, site_id, kind, title, body, deep_link, pushed_at, created_at) values
    (demo_id, false, demo_id, 'chat', 'Sarah Mitchell', 'Perfect, Saturday at 10 works for us. Does she need to bring anything?', jsonb_build_object('kind', 'chat', 'id', c1::text), now() - interval '25 minutes', now() - interval '25 minutes'),
    (demo_id, false, demo_id, 'money_in', '£32.00 from Emma Robson', 'Monthly membership, Little Movers', jsonb_build_object('kind', 'payment', 'id', 'demo_1'), now() - interval '2 hours', now() - interval '2 hours'),
    (demo_id, false, demo_id, 'enquiry', 'New enquiry from Hannah Wright', 'Hi, is there a class for 18 month olds?', jsonb_build_object('kind', 'enquiry'), now() - interval '6 hours', now() - interval '6 hours'),
    (demo_id, false, demo_id, 'work', 'A question about your party booking form', 'How much should the deposit be?', jsonb_build_object('kind', 'support', 'id', r2::text), now() - interval '20 hours', now() - interval '20 hours'),
    (demo_id, false, demo_id, 'money_in', '£50.00 from Priya Shah', 'Party deposit, Sunday 9th', jsonb_build_object('kind', 'payment', 'id', 'demo_2'), now() - interval '2 days 22 hours', now() - interval '2 days 22 hours'),
    (demo_id, false, demo_id, 'money_refund', '£32.00 refunded to Mark Ellis', 'Monthly membership (moved away)', jsonb_build_object('kind', 'payment', 'id', 'demo_7'), now() - interval '12 days', now() - interval '12 days');
end $$;
