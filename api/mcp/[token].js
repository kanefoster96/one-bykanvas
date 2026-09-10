/* MCP endpoint, token in the path: /api/mcp/<token>. For claude.ai and
 * Cowork custom connectors, which cannot send a header. The URL is the
 * password. Everything lives in _mcp.js; this only picks the token off. */
const { serve } = require('../_mcp.js');

module.exports = async function handler(req, res) {
  const token = String((req.query && req.query.token) || '').trim();
  return serve(req, res, token);
};
