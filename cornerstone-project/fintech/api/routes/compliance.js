const { logEvent } = require('../security/audit_logger');

async function submitCompliance(req, res) {
  const { reportId, regulator, submittedBy } = req.body || {};
  const src = req.ip || '127.0.0.1';

  if (!reportId) {
    logEvent('UNAUTHORISED_ACCESS', {
      suser: 'anonymous',
      src,
      outcome: 'failure',
      msg: 'Compliance submit called without reportId'
    });
    return res.status(400).json({ error: 'reportId required' });
  }

  logEvent('ADMIN_ACTION', {
    suser: submittedBy || 'anonymous',
    src,
    outcome: 'success',
    msg: `Compliance report ${reportId} submitted to ${regulator || 'CBK'}`
  });

  res.json({
    reportId,
    regulator: regulator || 'CBK',
    status: 'submitted',
    submittedAt: new Date().toISOString()
  });
}

module.exports = { submitCompliance };
