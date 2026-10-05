// cornerstone-project/fintech/server.js
// Minimal Express entry point for the Sita Fintech API
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const { generateReport, listReports } = require('./api/routes/reports');
const { submitCompliance } = require('./api/routes/compliance');

const app = express();
app.use(express.json());

// Report routes
app.post('/reports/generate', generateReport);
app.get('/reports', listReports);

// Compliance routes
app.post('/compliance/submit', submitCompliance);

const PORT = process.env.APP_PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sita Fintech API listening on port ${PORT}`);
});

module.exports = app;
