/* Emails about requests, sent a little late on purpose.
 *
 * A note is written with emailed_at null. This runs every five minutes and
 * sends anything older than ten, one email per request per author, so a
 * customer who writes three notes in a row gets us one email, not three -
 * and nobody is ever emailed about their own note. Private notes are born
 * already "sent" and never show up here.
 *
 * Who gets what:
 *   customer wrote, first note   -> us:   New request from [Business]: [title]
 *   customer wrote, later note   -> us:   [Business] replied: [title]
 *   we wrote, request is done    -> them: Done: [title]
 *   we wrote, waiting on them    -> them: A quick question about your [title]
 *   we wrote, anything else      -> them: Update on your request: [title]
 *
 * A send that fails stays unmailed and is tried again next run; after two
 * days it is written off rather than retried forever.
 *
 * Guarded by CRON_SECRET, same as followups.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { sendEmail, adminAddresses } = require('./_email.js');
const { html: emailHtml, esc, standardFooter } = require('./_email_template.js');

const QUIET_MINUTES = 10;
const GIVE_UP_DAYS = 2;
const LINK_SECONDS = 7 * 24 * 3600;

function firstName(profile, email) {
  const name = String((profile && profile.contact_name) || '').trim().split(/\s+/)[0];
  return name || String(email || '').split('@')[0] || 'there';
}

function paragraphs(text) {
  return String(text).split(/\n{2,}/).map((p) => esc(p).replace(/\n/g, '<br>'));
}

/* One email's worth of notes, in the order they were written. */
function noteBlocks(notes) {
  const lines = [];
  notes.forEach((n, i) => {
    if (i) lines.push('&nbsp;');
    paragraphs(n.body).forEach((p) => lines.push(p));
    if (n.links && n.links.length) {
      lines.push(n.links.map((l, k) => `<a href="${esc(l)}">Attachment ${k + 1}</a>`).join(' &nbsp;&middot;&nbsp; '));
    }
  });
  return lines;
}

function plainText(notes, tail) {
  return notes.map((n) => n.body + (n.links && n.links.length ? '\n' + n.links.join('\n') : ''))
    .join('\n\n') + '\n\n' + tail + '\n';
}

module.exports = async function handler(req, res) {
  const { CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!CRON_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('request-mail: missing environment variables:',
      missingEnv(['CRON_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Not configured.' });
  }
  if ((req.headers.authorization || '') !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Who is this?' });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const site = ourSiteUrl();
    const cutoff = new Date(Date.now() - QUIET_MINUTES * 60000).toISOString();
    const giveUp = new Date(Date.now() - GIVE_UP_DAYS * 86400000).toISOString();

    const { data: notes, error } = await db.from('request_notes')
      .select('id, request_id, author, body, attachment_paths, created_at')
      .is('emailed_at', null).eq('private', false)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    if (!notes || !notes.length) return res.status(200).json({ sent: 0 });

    // Group: one email per request per author.
    const groups = {};
    notes.forEach((n) => {
      const key = n.request_id + ':' + n.author;
      (groups[key] = groups[key] || []).push(n);
    });

    let sent = 0, failed = 0, dropped = 0;
    for (const key of Object.keys(groups)) {
      const group = groups[key];
      const ids = group.map((n) => n.id);
      const stamp = async () => {
        await db.from('request_notes').update({ emailed_at: new Date().toISOString() }).in('id', ids);
      };

      const { data: r } = await db.from('requests')
        .select('id, user_id, kind, title, detail, status, created_at')
        .eq('id', group[0].request_id).maybeSingle();
      if (!r) { await stamp(); dropped += ids.length; continue; }

      const { data: prof } = await db.from('profiles')
        .select('business_name, contact_name, site_url').eq('id', r.user_id).maybeSingle();
      let email = null;
      try {
        const { data: u } = await db.auth.admin.getUserById(r.user_id);
        email = u && u.user && u.user.email;
      } catch (e) { /* handled below */ }

      const title = r.title || String(r.detail || '').split('\n')[0].slice(0, 120);
      const business = (prof && prof.business_name) || email || 'A customer';
      const link = `${site}/requests.html#r/${r.id}`;

      // Signed links for anything attached - a week, long enough to open
      // the email late but not forever.
      const paths = group.flatMap((n) => n.attachment_paths || []);
      const signed = {};
      if (paths.length) {
        const { data: list } = await db.storage.from('request-attachments').createSignedUrls(paths, LINK_SECONDS);
        (list || []).forEach((x) => { if (x.signedUrl) signed[x.path] = x.signedUrl; });
      }
      group.forEach((n) => { n.links = (n.attachment_paths || []).map((p) => signed[p]).filter(Boolean); });

      let result = 'skipped';
      if (group[0].author === 'customer') {
        // Is this the very first note on the request? Then it is new to us.
        const { count } = await db.from('request_notes')
          .select('id', { count: 'exact', head: true })
          .eq('request_id', r.id).lt('created_at', group[0].created_at);
        const isNew = !count;
        const subject = isNew
          ? `New request from ${business}: ${title}`
          : `${business} replied: ${title}`;
        const admin = `${site}/admin.html#r/${r.id}`;
        result = await sendEmail({
          to: adminAddresses(),
          subject: subject.replace(/[\r\n]+/g, ' '),
          text: plainText(group, `Open request: ${admin}`),
          html: emailHtml({
            preheader: group[0].body.slice(0, 120),
            heading: isNew ? 'New request' : `${business} replied`,
            lines: [`<strong>${esc(business)}</strong> &middot; ${esc(title)}`].concat(noteBlocks(group)),
            ctaText: 'Open request',
            ctaHref: admin,
            footer: 'Sent to you because a customer wrote in their dashboard.'
          }),
          replyTo: email || undefined
        });
      } else if (email) {
        const done = r.status === 'done';
        const waiting = r.status === 'waiting';
        const subject = done ? `Done: ${title}`
          : waiting ? `A quick question about your ${title}`
          : `Update on your request: ${title}`;
        const hi = `Hi ${esc(firstName(prof, email))},`;
        const tail = done
          ? 'Not quite right? Reply in your dashboard and we’ll sort it.'
          : 'Just reply in the dashboard and we’ll see it straight away.';
        result = await sendEmail({
          to: email,
          subject: subject.replace(/[\r\n]+/g, ' '),
          text: `${hi.replace(/&#?\w+;/g, '')}\n\n` + plainText(group, `${done ? 'See your site' : 'Reply in your dashboard'}: ${link}\n\n${tail}`),
          html: emailHtml({
            preheader: group[0].body.slice(0, 120),
            heading: done ? 'Done' : waiting ? 'A quick question' : 'An update from Kane',
            lines: [hi].concat(noteBlocks(group)),
            ctaText: done ? 'See your site' : 'Reply in your dashboard',
            ctaHref: done && prof && prof.site_url ? prof.site_url : link,
            ctaNote: done ? `${esc(tail.split('?')[0])}? <a href="${esc(link)}" style="color:inherit;">Reply in your dashboard</a> and we’ll sort it.` : esc(tail),
            footer: 'You’re getting this because you have a request open with Kanvas One.',
            footerLinks: standardFooter(site)
          })
        });
      }

      if (result === 'failed' && group[0].created_at > giveUp) {
        failed += ids.length; // left unmailed; tried again next run
        continue;
      }
      await stamp();
      if (result === 'sent') sent += ids.length; else dropped += ids.length;
    }

    return res.status(200).json({ sent, failed, dropped });
  } catch (err) {
    console.error('request-mail:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
