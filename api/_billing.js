/* When the current points window opened.
 *
 * points_reset_at is the answer whenever it is set: the webhook moves it at
 * each renewal and change-plan.js stamps it on an upgrade, so it already knows
 * about a mid-month change of plan. The fallback is only for rows written
 * before that column existed, and is deliberately the old derivation so those
 * accounts see no sudden jump.
 *
 * account.js and admin.js carry the same rule for display. Change all three.
 */
function pointsWindowStart(profile) {
  const stamped = profile && profile.points_reset_at ? new Date(profile.points_reset_at) : null;
  if (stamped && !isNaN(stamped)) return stamped;

  const end = profile && profile.current_period_end ? new Date(profile.current_period_end) : null;
  if (end && !isNaN(end)) {
    const start = new Date(end);
    start.setMonth(start.getMonth() - 1);
    return start;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

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
    .select('business_name, stripe_customer_id, active_plan, current_period_end, points_reset_at')
    .eq('id', userId).maybeSingle();
  if (pErr) throw new Error(pErr.message);

  const allowance = PLAN_POINTS[profile && profile.active_plan] || 0;
  const start = pointsWindowStart(profile);

  const { data: periodReqs, error: prErr } = await db
    .from('requests')
    .select('id, points, created_at')
    .eq('user_id', userId)
    .neq('status', 'declined')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: true });
  if (prErr) throw new Error(prErr.message);

  let used = 0, shortfall = 0, found = false;
  for (const r of (periodReqs || [])) {
    const covered = Math.max(0, Math.min(r.points, allowance - used));
    if (r.id === requestId) { shortfall = r.points - covered; found = true; break; }
    used += r.points;
  }

  /* A request created before the current window opened is not in periodReqs,
   * and without this it would fall through with a shortfall of zero - billed
   * as free. Points from a past window are spent; the whole request is owed. */
  if (!found) {
    const { data: outside, error: oErr } = await db
      .from('requests').select('points').eq('id', requestId).maybeSingle();
    if (oErr) throw new Error(oErr.message);
    shortfall = (outside && Number(outside.points)) || 0;
  }
  return { profile, shortfall };
}

module.exports = { PLAN_POINTS, shortfallFor, pointsWindowStart };
