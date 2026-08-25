/* Which of these environment variables are missing.
 *
 * Names only, and only ever to the server log: a customer gets a plain "not
 * configured" message, because the list of what a server is missing is not
 * theirs to see. Without this, a misconfigured deployment says only that
 * something is wrong, and finding out which of five names it is means guessing.
 */
function missingEnv(names) {
  return names.filter(function (n) {
    var v = process.env[n];
    return !v || !String(v).trim();
  });
}

module.exports = { missingEnv };
