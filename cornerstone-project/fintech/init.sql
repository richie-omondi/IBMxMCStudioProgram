-- cornerstone-project/fintech/init.sql
-- Initialise Sita Fintech schema in dependency order
-- Run automatically by PostgreSQL on first container boot

-- 1. Customers (no FK dependencies)
CREATE TABLE IF NOT EXISTS customers (
  customer_id VARCHAR PRIMARY KEY,
  id_number VARCHAR,
  kyc_tier VARCHAR CHECK (kyc_tier IN ('basic', 'enhanced')),
  risk_score INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Loan accounts (FK → customers)
CREATE TABLE IF NOT EXISTS loan_accounts (
  account_id VARCHAR PRIMARY KEY,
  customer_id VARCHAR NOT NULL REFERENCES customers(customer_id),
  product_type VARCHAR CHECK (product_type IN ('personal', 'business', 'asset')),
  principal_amount DECIMAL(18,2) NOT NULL,
  interest_rate DECIMAL(8,4),
  disbursement_date DATE,
  maturity_date DATE,
  status VARCHAR CHECK (status IN ('active', 'defaulted', 'closed'))
);

-- 3. Repayment transactions (FK → loan_accounts)
CREATE TABLE IF NOT EXISTS repayment_transactions (
  transaction_id VARCHAR PRIMARY KEY,
  account_id VARCHAR NOT NULL REFERENCES loan_accounts(account_id),
  amount_paid DECIMAL(18,2),
  payment_date DATE,
  channel VARCHAR CHECK (channel IN ('mpesa', 'bank', 'ussd'))
);

-- 4. Regulatory reports (no FK dependencies)
CREATE TABLE IF NOT EXISTS regulatory_reports (
  report_id VARCHAR PRIMARY KEY,
  regulator VARCHAR CHECK (regulator IN ('CBK', 'CMA', 'SASRA')),
  period VARCHAR NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR CHECK (status IN ('draft', 'submitted', 'accepted')),
  file_path VARCHAR
);
