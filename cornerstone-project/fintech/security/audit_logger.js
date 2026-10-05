// fintech/security/audit_logger.js
// Emits CEF-compatible JSON security events to stdout and (in live mode) to rsyslog.
// Consumed by IBM QRadar on Cloud via the sita-fintech rsyslog tag.

const { execSync } = require('child_process');

const MOCK = process.env.SITA_MOCK_MODE === '1';

/**
 * Log a security event.
 *
 * @param {string} category  - TRANSACTION_BURST | UNAUTHORISED_ACCESS | ADMIN_ACTION
 * @param {object} payload   - { src, suser, outcome, msg } — all optional, default to safe values
 */
function logEvent(category, payload = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    deviceVendor: 'SitaFintech',
    deviceProduct: 'LendingAPI',
    category,
    src: payload.src || '127.0.0.1',
    suser: payload.suser || 'system',
    outcome: payload.outcome || 'success',
    msg: payload.msg || ''
  };

  const line = JSON.stringify(event);

  // Always write to stdout
  console.log(line);

  // In live mode, also forward to rsyslog so QRadar picks it up via the sita-fintech tag.
  // Silently skipped on Windows dev machines where `logger` is unavailable.
  if (!MOCK) {
    try {
      execSync(`logger -t sita-fintech '${line.replace(/'/g, "'\\''")}'`);
    } catch (_) {
      // logger not available on this platform — stdout is the fallback
    }
  }
}

module.exports = { logEvent };
