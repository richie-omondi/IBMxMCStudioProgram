const { runCBKPipeline } = require('../../pipelines/cbk_report_pipeline');
const { logEvent } = require('../../security/audit_logger');
const { checkBurst } = require('../../security/transaction_rate_guard');

async function listReports(req, res) {
  logEvent('ADMIN_ACTION', {
    suser: req.headers['x-user'] || 'anonymous',
    src: req.ip || '127.0.0.1',
    outcome: 'success',
    msg: 'Report list accessed'
  });
  res.json({ reports: [], message: 'Connect DATABASE_URL for live listing' });
}

async function generateReport(req, res) {
  const period = req.body?.period || '2026-05';
  const caller = req.headers['x-user'] || 'anonymous';
  const src = req.ip || '127.0.0.1';

  logEvent('ADMIN_ACTION', {
    suser: caller,
    src,
    outcome: 'initiated',
    msg: `CBK report generation started for period ${period}`
  });

  if (checkBurst(period)) {
    logEvent('TRANSACTION_BURST', {
      suser: 'system',
      src,
      outcome: 'alert',
      msg: `Burst detected on period ${period} — more than 5 generate calls in 60s`
    });
  }

  try {
    const reportId = await runCBKPipeline(period);
    logEvent('ADMIN_ACTION', {
      suser: caller,
      src,
      outcome: 'success',
      msg: `CBK report ${reportId} generated for period ${period}`
    });
    res.json({ reportId, regulator: 'CBK' });
  } catch (err) {
    logEvent('ADMIN_ACTION', {
      suser: caller,
      src,
      outcome: 'failure',
      msg: err.message
    });
    throw err;
  }
}

module.exports = { listReports, generateReport };
