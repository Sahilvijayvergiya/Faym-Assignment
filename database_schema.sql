-- Database Schema for User Payout Management System
-- Using SQLite for simplicity, but can be adapted for PostgreSQL/MySQL

-- Users Table
CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Brands Table
CREATE TABLE brands (
    brand_id VARCHAR(50) PRIMARY KEY,
    brand_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Table
CREATE TABLE sales (
    sale_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    brand_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    earning DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (brand_id) REFERENCES brands(brand_id)
);

-- Advance Payouts Table
CREATE TABLE advance_payouts (
    advance_payout_id VARCHAR(50) PRIMARY KEY,
    sale_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE (sale_id) -- Ensures one advance payout per sale
);

-- Final Payouts Table
CREATE TABLE final_payouts (
    final_payout_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    advance_adjustment DECIMAL(10, 2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    reconciliation_batch_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Withdrawals Table
CREATE TABLE withdrawals (
    withdrawal_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- User Balance Table
CREATE TABLE user_balances (
    user_id VARCHAR(50) PRIMARY KEY,
    withdrawable_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
    pending_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_earnings DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_advance_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
    last_withdrawal_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Reconciliation Batches Table
CREATE TABLE reconciliation_batches (
    batch_id VARCHAR(50) PRIMARY KEY,
    processed_by VARCHAR(50) NOT NULL,
    total_sales_processed INTEGER NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payout Transactions Table (for audit trail)
CREATE TABLE payout_transactions (
    transaction_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('advance', 'final', 'withdrawal', 'recovery')),
    amount DECIMAL(10, 2) NOT NULL,
    reference_id VARCHAR(50) NOT NULL, -- Can be sale_id, advance_payout_id, final_payout_id, or withdrawal_id
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Indexes for performance optimization
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_brand_id ON sales(brand_id);
CREATE INDEX idx_advance_payouts_user_id ON advance_payouts(user_id);
CREATE INDEX idx_advance_payouts_status ON advance_payouts(status);
CREATE INDEX idx_final_payouts_user_id ON final_payouts(user_id);
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_payout_transactions_user_id ON payout_transactions(user_id);
CREATE INDEX idx_payout_transactions_reference_id ON payout_transactions(reference_id);
