/* Shared between api/admin.js and api/requests.js: how many of a request's
 * points its owner's plan did not cover, worked out fresh from the database
 * rather than trusted from anywhere else - the same reason checkout.js
 * prices a plan from PLANS rather than the request body.
 *
 * Mirrors periodStart() in admin.js and account.js exactly, so the period
 * boundary this measures against is never a few hours off from what the
 * customer and admin page both already show.
 */
const PLAN_POINTS = { business: 1, pro: 3, max: 5 }; // must match admin.js and account.js

async function shortfallFor(db, userId, requestId) {
  const { data: profile, error: pErr } = await db
    .from('profiles')
    .select('business_name, stripe_customer_id, active_plan, current_period_end')
    .eq('id', userId).maybeSingle();
  if (pErr) throw new Error(pErr.message);

  const allowance = PLAN_POINTS[profile && profile.active_plan] || 0;
  const end = profile && profile.current_period_end ? new Date(profile.current_period_end) : null;
  let start;
  if (end && !isNaN(end)) {
    start = new Date(end);
    start.setMonth(start.getMonth() - 1);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const { data: periodReqs, error: prErr } = await db
    .from('requests')
    .select('id, points, created_at')
    .eq('user_id', userId)
    .neq('status', 'declined')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: true });
  if (prErr) throw new Error(prErr.message);

  let used = 0, shortfall = 0;
  for (const r of (periodReqs || [])) {
    const covered = Math.max(0, Math.min(r.points, allowance - used));
    if (r.id === requestId) { shortfall = r.points - covered; break; }
    used += r.points;
  }
  return { profile, shortfall };
}

module.exports = { PLAN_POINTS, shortfallFor };
