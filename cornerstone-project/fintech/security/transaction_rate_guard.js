// fintech/security/transaction_rate_guard.js
// Sliding-window burst detector for repayment / report generation calls.
// Used by reports.js to emit TRANSACTION_BURST events before QRadar rule R1 fires.

/** @type {Map<string, number[]>} accountId → array of call timestamps (ms) */
const _store = new Map();

/**
 * Record a call for accountId and check whether it exceeds the burst threshold.
 *
 * @param {string} accountId   - The loan account or period identifier being tracked
 * @param {number} threshold   - Max allowed calls within the window before burst is flagged (default 5)
 * @param {number} windowMs    - Rolling window in milliseconds (default 60 000 = 1 minute)
 * @returns {boolean}          - true if the call count exceeds threshold (burst detected)
 */
function checkBurst(accountId, threshold = 5, windowMs = 60000) {
  const now = Date.now();
  const timestamps = (_store.get(accountId) || []).filter(t => now - t < windowMs);
  timestamps.push(now);
  _store.set(accountId, timestamps);
  return timestamps.length > threshold;
}

/**
 * Clear all tracked state. Used in tests to reset between runs.
 */
function resetGuard() {
  _store.clear();
}

module.exports = { checkBurst, resetGuard };
