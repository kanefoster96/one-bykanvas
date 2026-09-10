/* MCP endpoint, bearer token in the header: the way Claude Code and scripts
 * connect. Everything lives in _mcp.js; this only picks the token off. */
const { serve } = require('./_mcp.js');

module.exports = async function handler(req, res) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return serve(req, res, token);
};
