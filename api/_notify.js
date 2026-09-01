/* In-app notifications, both directions.
 *
 * notify()      - a row for one customer: "your request was accepted".
 * notifyAdmin() - a row for the admin: "a new customer joined". Admin rows
 *                 carry for_admin=true and no user_id; row level security
 *                 shows them only to the admin email.
 *
 * Written only with the service role - the notifications table deliberately
 * has no insert policy, so nobody can hand themselves good news. Every call
 * is best effort: the action it reports has already happened, and a missed
 * notification must never fail it.
 */
async function insertRow(db, row) {
  const { error } = await db.from('notifications').insert(row);
  if (error) console.error('notify: notification not written:', error.message);
}

async function notify(db, userId, title, body, href) {
  await insertRow(db, {
    user_id: userId,
    title: String(title).slice(0, 120),
    body: body ? String(body).slice(0, 500) : null,
    href: href || null
  });
}

async function notifyAdmin(db, title, body, href) {
  await insertRow(db, {
    user_id: null,
    for_admin: true,
    title: String(title).slice(0, 120),
    body: body ? String(body).slice(0, 500) : null,
    href: href || '/admin.html'
  });
}

module.exports = { notify, notifyAdmin };
