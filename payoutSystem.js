/**
 * User Payout Management System Implementation
 * Handles advance payouts, final payouts, reconciliation, and withdrawal management
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
    SaleStatus, PayoutStatus, TransactionType,
    Sale, AdvancePayout, FinalPayout, Withdrawal,
    UserBalance, ReconciliationBatch, PayoutTransaction,
    PayoutCalculationResult, UserPayoutSummary
} = require('./models');

class PayoutSystem {
    constructor(dbPath = 'payout_system.db') {
        this.dbPath = dbPath;
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            }
        });
        this.initialized = this.initializeDatabase();
    }

    async initializeDatabase() {
        const fs = require('fs');
        const schemaPath = path.join(__dirname, 'database_schema.sql');
        
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await this.execSql(schema);
        }
    }

    async ensureInitialized() {
        await this.initialized;
    }

    execSql(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    runSql(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    getSql(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    allSql(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // ==================== SALE MANAGEMENT ====================

    async createSale(userId, brandId, earning) {
        await this.ensureInitialized();
        const saleId = `sale_${uuidv4().substring(0, 8)}`;
        const now = new Date().toISOString();

        await this.runSql(
            `INSERT INTO sales (sale_id, user_id, brand_id, status, earning, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [saleId, userId, brandId, SaleStatus.PENDING, earning, now, now]
        );

        await this.updateUserBalanceOnSale(userId, earning);

        return new Sale(saleId, userId, brandId, SaleStatus.PENDING, earning, now, now);
    }

    async updateUserBalanceOnSale(userId, earning) {
        const existingBalance = await this.getSql(
            'SELECT user_id FROM user_balances WHERE user_id = ?',
            [userId]
        );

        const now = new Date().toISOString();

        if (existingBalance) {
            await this.runSql(
                `UPDATE user_balances 
                 SET pending_balance = pending_balance + ?,
                     total_earnings = total_earnings + ?,
                     updated_at = ?
                 WHERE user_id = ?`,
                [earning, earning, now, userId]
            );
        } else {
            await this.runSql(
                `INSERT INTO user_balances (user_id, withdrawable_balance, pending_balance, total_earnings, updated_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, 0, earning, earning, now]
            );
        }
    }

    async getSalesByUser(userId, status = null) {
        await this.ensureInitialized();
        let sql = `SELECT sale_id, user_id, brand_id, status, earning, created_at, updated_at
                   FROM sales WHERE user_id = ?`;
        const params = [userId];

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY created_at DESC';

        const rows = await this.allSql(sql, params);
        return rows.map(row => new Sale(
            row.sale_id,
            row.user_id,
            row.brand_id,
            row.status,
            row.earning,
            row.created_at,
            row.updated_at
        ));
    }

    // ==================== ADVANCE PAYOUT MANAGEMENT ====================

    async processAdvancePayouts() {
        await this.ensureInitialized();
        const sql = `SELECT s.sale_id, s.user_id, s.earning
                     FROM sales s
                     LEFT JOIN advance_payouts ap ON s.sale_id = ap.sale_id
                     WHERE s.status = 'pending' AND ap.sale_id IS NULL`;

        const eligibleSales = await this.allSql(sql);
        let successful = 0;
        let failed = 0;
        const failedSales = [];
        let totalAmount = 0;

        for (const sale of eligibleSales) {
            try {
                const advanceAmount = sale.earning * 0.10;
                const advancePayoutId = `advance_${uuidv4().substring(0, 8)}`;
                const now = new Date().toISOString();

                await this.runSql(
                    `INSERT INTO advance_payouts 
                     (advance_payout_id, sale_id, user_id, amount, status, created_at, completed_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [advancePayoutId, sale.sale_id, sale.user_id, advanceAmount, 
                     PayoutStatus.COMPLETED, now, now]
                );

                await this.updateUserBalanceOnAdvance(sale.user_id, advanceAmount);

                await this.createPayoutTransaction(
                    sale.user_id, TransactionType.ADVANCE, advanceAmount,
                    advancePayoutId, PayoutStatus.COMPLETED
                );

                successful++;
                totalAmount += advanceAmount;

            } catch (error) {
                failed++;
                failedSales.push(sale.sale_id);
                console.error(`Failed to process advance payout for sale ${sale.sale_id}:`, error);
            }
        }

        return {
            batchId: `advance_batch_${uuidv4().substring(0, 8)}`,
            totalProcessed: eligibleSales.length,
            totalAmount: totalAmount,
            successful: successful,
            failed: failed,
            failedSales: failedSales
        };
    }

    async updateUserBalanceOnAdvance(userId, advanceAmount) {
        const now = new Date().toISOString();
        await this.runSql(
            `UPDATE user_balances 
             SET withdrawable_balance = withdrawable_balance + ?,
                 total_advance_paid = total_advance_paid + ?,
                 pending_balance = pending_balance - ?,
                 updated_at = ?
             WHERE user_id = ?`,
            [advanceAmount, advanceAmount, advanceAmount, now, userId]
        );
    }

    async getAdvancePayoutsByUser(userId) {
        await this.ensureInitialized();
        const sql = `SELECT advance_payout_id, sale_id, user_id, amount, status, created_at, completed_at
                     FROM advance_payouts WHERE user_id = ?
                     ORDER BY created_at DESC`;

        const rows = await this.allSql(sql, [userId]);
        return rows.map(row => new AdvancePayout(
            row.advance_payout_id,
            row.sale_id,
            row.user_id,
            row.amount,
            row.status,
            row.created_at,
            row.completed_at
        ));
    }

    // ==================== RECONCILIATION ====================

    async reconcileSales(salesUpdates, processedBy) {
        await this.ensureInitialized();
        const batchId = `recon_batch_${uuidv4().substring(0, 8)}`;
        const now = new Date().toISOString();

        const userFinalPayouts = {};
        let totalSalesProcessed = 0;
        let totalAmount = 0;

        for (const update of salesUpdates) {
            const saleId = update.sale_id;
            const newStatus = update.status;

            const sale = await this.getSql(
                `SELECT sale_id, user_id, brand_id, status, earning
                 FROM sales WHERE sale_id = ?`,
                [saleId]
            );

            if (!sale) {
                console.log(`Sale ${saleId} not found`);
                continue;
            }

            if (sale.status !== SaleStatus.PENDING) {
                console.log(`Sale ${saleId} is not pending, current status: ${sale.status}`);
                continue;
            }

            const advanceRow = await this.getSql(
                `SELECT amount FROM advance_payouts WHERE sale_id = ? AND status = 'completed'`,
                [saleId]
            );
            const advancePaid = advanceRow ? advanceRow.amount : 0;

            const earning = sale.earning;
            let finalAdjustment;

            if (newStatus === SaleStatus.APPROVED) {
                finalAdjustment = earning - advancePaid;
            } else {
                finalAdjustment = -advancePaid;
            }

            await this.runSql(
                `UPDATE sales SET status = ?, updated_at = ? WHERE sale_id = ?`,
                [newStatus, now, saleId]
            );

            const userId = sale.user_id;
            if (!userFinalPayouts[userId]) {
                userFinalPayouts[userId] = [];
            }

            userFinalPayouts[userId].push(new PayoutCalculationResult(
                saleId, earning, advancePaid, finalAdjustment, newStatus
            ));

            totalSalesProcessed++;
            totalAmount += earning;
        }

        const finalPayouts = [];
        for (const [userId, calculations] of Object.entries(userFinalPayouts)) {
            const totalEarnings = calculations.reduce((sum, c) => sum + c.earning, 0);
            const totalAdvanceAdjustment = calculations.reduce((sum, c) => sum + c.finalAdjustment, 0);
            const netAmount = totalAdvanceAdjustment;

            const finalPayoutId = `final_${uuidv4().substring(0, 8)}`;

            await this.runSql(
                `INSERT INTO final_payouts 
                 (final_payout_id, user_id, total_amount, advance_adjustment, net_amount, 
                  status, reconciliation_batch_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [finalPayoutId, userId, totalEarnings, totalAdvanceAdjustment, netAmount,
                 PayoutStatus.PENDING, batchId, now]
            );

            await this.updateUserBalanceOnFinalPayout(userId, netAmount);

            finalPayouts.push({
                userId: userId,
                totalAmount: totalEarnings,
                advanceAdjustment: totalAdvanceAdjustment,
                netAmount: netAmount,
                status: PayoutStatus.PENDING
            });
        }

        await this.runSql(
            `INSERT INTO reconciliation_batches (batch_id, processed_by, total_sales_processed, total_amount, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [batchId, processedBy, totalSalesProcessed, totalAmount, now]
        );

        return {
            batchId: batchId,
            totalSalesProcessed: totalSalesProcessed,
            finalPayouts: finalPayouts,
            createdAt: now
        };
    }

    async updateUserBalanceOnFinalPayout(userId, netAmount) {
        const now = new Date().toISOString();
        const pendingDeduction = netAmount > 0 ? netAmount : 0;
        
        await this.runSql(
            `UPDATE user_balances 
             SET withdrawable_balance = withdrawable_balance + ?,
                 pending_balance = pending_balance - ?,
                 updated_at = ?
             WHERE user_id = ?`,
            [netAmount, pendingDeduction, now, userId]
        );
    }

    // ==================== WITHDRAWAL MANAGEMENT ====================

    async requestWithdrawal(userId, amount) {
        await this.ensureInitialized();
        const balance = await this.getSql(
            `SELECT withdrawable_balance, last_withdrawal_at FROM user_balances WHERE user_id = ?`,
            [userId]
        );

        if (!balance) {
            return { success: false, error: 'User balance not found' };
        }

        const withdrawableBalance = balance.withdrawable_balance;

        if (amount > withdrawableBalance) {
            return { 
                success: false, 
                error: `Insufficient balance. Available: ${withdrawableBalance}, Requested: ${amount}` 
            };
        }

        const lastWithdrawalAt = balance.last_withdrawal_at;
        if (lastWithdrawalAt) {
            const lastWithdrawalTime = new Date(lastWithdrawalAt);
            const hoursSinceLastWithdrawal = (Date.now() - lastWithdrawalTime.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceLastWithdrawal < 24) {
                const nextAllowed = new Date(lastWithdrawalTime.getTime() + 24 * 60 * 60 * 1000);
                return { 
                    success: false, 
                    error: `Withdrawal limit exceeded. Next withdrawal allowed at: ${nextAllowed.toISOString()}` 
                };
            }
        }

        const withdrawalId = `withdrawal_${uuidv4().substring(0, 8)}`;
        const now = new Date().toISOString();

        await this.runSql(
            `INSERT INTO withdrawals (withdrawal_id, user_id, amount, status, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [withdrawalId, userId, amount, PayoutStatus.PENDING, now]
        );

        await this.runSql(
            `UPDATE user_balances 
             SET withdrawable_balance = withdrawable_balance - ?,
                 last_withdrawal_at = ?,
                 updated_at = ?
             WHERE user_id = ?`,
            [amount, now, now, userId]
        );

        await this.createPayoutTransaction(
            userId, TransactionType.WITHDRAWAL, amount, withdrawalId, PayoutStatus.PENDING
        );

        return {
            success: true,
            withdrawal: new Withdrawal(withdrawalId, userId, amount, PayoutStatus.PENDING, now)
        };
    }

    async processWithdrawal(withdrawalId, success = true) {
        await this.ensureInitialized();
        const withdrawal = await this.getSql(
            `SELECT withdrawal_id, user_id, amount, status, created_at
             FROM withdrawals WHERE withdrawal_id = ?`,
            [withdrawalId]
        );

        if (!withdrawal) {
            throw new Error(`Withdrawal ${withdrawalId} not found`);
        }

        const now = new Date().toISOString();
        const newStatus = success ? PayoutStatus.COMPLETED : PayoutStatus.FAILED;

        await this.runSql(
            `UPDATE withdrawals SET status = ?, completed_at = ? WHERE withdrawal_id = ?`,
            [newStatus, now, withdrawalId]
        );

        await this.runSql(
            `UPDATE payout_transactions 
             SET status = ?, completed_at = ?
             WHERE reference_id = ? AND transaction_type = 'withdrawal'`,
            [newStatus, now, withdrawalId]
        );

        return new Withdrawal(
            withdrawal.withdrawal_id,
            withdrawal.user_id,
            withdrawal.amount,
            newStatus,
            withdrawal.created_at,
            now
        );
    }

    async getWithdrawalsByUser(userId) {
        await this.ensureInitialized();
        const sql = `SELECT withdrawal_id, user_id, amount, status, created_at, completed_at
                     FROM withdrawals WHERE user_id = ?
                     ORDER BY created_at DESC`;

        const rows = await this.allSql(sql, [userId]);
        return rows.map(row => new Withdrawal(
            row.withdrawal_id,
            row.user_id,
            row.amount,
            row.status,
            row.created_at,
            row.completed_at
        ));
    }

    // ==================== FAILED PAYOUT RECOVERY ====================

    async recoverFailedPayout(payoutType, payoutId, failureReason) {
        await this.ensureInitialized();
        let payout;
        let userId;
        let amount;

        if (payoutType === 'withdrawal') {
            payout = await this.getSql(
                `SELECT withdrawal_id, user_id, amount, status
                 FROM withdrawals WHERE withdrawal_id = ?`,
                [payoutId]
            );

            if (!payout) {
                throw new Error(`Withdrawal ${payoutId} not found`);
            }

            if (payout.status !== PayoutStatus.FAILED) {
                await this.runSql(
                    `UPDATE withdrawals SET status = ? WHERE withdrawal_id = ?`,
                    [PayoutStatus.FAILED, payoutId]
                );
            }

            userId = payout.user_id;
            amount = payout.amount;

        } else if (payoutType === 'final_payout') {
            payout = await this.getSql(
                `SELECT final_payout_id, user_id, net_amount, status
                 FROM final_payouts WHERE final_payout_id = ?`,
                [payoutId]
            );

            if (!payout) {
                throw new Error(`Final payout ${payoutId} not found`);
            }

            if (payout.status !== PayoutStatus.FAILED) {
                await this.runSql(
                    `UPDATE final_payouts SET status = ? WHERE final_payout_id = ?`,
                    [PayoutStatus.FAILED, payoutId]
                );
            }

            userId = payout.user_id;
            amount = payout.net_amount;

        } else {
            throw new Error(`Invalid payout type: ${payoutType}`);
        }

        const now = new Date().toISOString();
        
        await this.runSql(
            `UPDATE user_balances 
             SET withdrawable_balance = withdrawable_balance + ?,
                 updated_at = ?
             WHERE user_id = ?`,
            [amount, now, userId]
        );

        const recoveryId = `recovery_${uuidv4().substring(0, 8)}`;
        await this.runSql(
            `INSERT INTO payout_transactions 
             (transaction_id, user_id, transaction_type, amount, reference_id, status, created_at, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [recoveryId, userId, TransactionType.RECOVERY, amount, payoutId, 
             PayoutStatus.COMPLETED, now, now]
        );

        const newBalance = await this.getSql(
            `SELECT withdrawable_balance FROM user_balances WHERE user_id = ?`,
            [userId]
        );

        return {
            recoveryTransactionId: recoveryId,
            userId: userId,
            amountRecovered: amount,
            creditedToBalance: true,
            newWithdrawableBalance: newBalance.withdrawable_balance,
            createdAt: now
        };
    }

    // ==================== USER BALANCE ====================

    async getUserBalance(userId) {
        await this.ensureInitialized();
        const balance = await this.getSql(
            `SELECT user_id, withdrawable_balance, pending_balance, total_earnings, 
                    total_advance_paid, last_withdrawal_at, updated_at
             FROM user_balances WHERE user_id = ?`,
            [userId]
        );

        if (!balance) {
            throw new Error(`User balance not found for user: ${userId}`);
        }

        return new UserBalance(
            balance.user_id,
            balance.withdrawable_balance,
            balance.pending_balance,
            balance.total_earnings,
            balance.total_advance_paid,
            balance.last_withdrawal_at,
            balance.updated_at
        );
    }

    async getUserPayoutSummary(userId) {
        await this.ensureInitialized();
        const totalPendingResult = await this.getSql(
            `SELECT COALESCE(SUM(earning), 0) as total_pending
             FROM sales WHERE user_id = ? AND status = 'pending'`,
            [userId]
        );
        const totalPending = totalPendingResult.total_pending;

        const totalEligibleResult = await this.getSql(
            `SELECT COALESCE(SUM(s.earning), 0) as total_eligible
             FROM sales s
             LEFT JOIN advance_payouts ap ON s.sale_id = ap.sale_id
             WHERE s.user_id = ? AND s.status = 'pending' AND ap.sale_id IS NULL`,
            [userId]
        );
        const totalAdvanceEligible = totalEligibleResult.total_eligible * 0.10;

        const totalPaidResult = await this.getSql(
            `SELECT COALESCE(SUM(amount), 0) as total_paid
             FROM advance_payouts WHERE user_id = ? AND status = 'completed'`,
            [userId]
        );
        const totalAdvancePaid = totalPaidResult.total_paid;

        const balance = await this.getUserBalance(userId);

        return new UserPayoutSummary(
            userId,
            totalPending,
            totalAdvanceEligible,
            totalAdvancePaid,
            balance.withdrawableBalance,
            balance.pendingBalance
        );
    }

    // ==================== TRANSACTION MANAGEMENT ====================

    async createPayoutTransaction(userId, transactionType, amount, referenceId, status) {
        const transactionId = `txn_${uuidv4().substring(0, 8)}`;
        const now = new Date().toISOString();

        await this.runSql(
            `INSERT INTO payout_transactions 
             (transaction_id, user_id, transaction_type, amount, reference_id, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transactionId, userId, transactionType, amount, referenceId, status, now]
        );
    }

    async getPayoutTransactions(userId) {
        await this.ensureInitialized();
        const sql = `SELECT transaction_id, user_id, transaction_type, amount, reference_id, 
                            status, created_at, completed_at
                     FROM payout_transactions WHERE user_id = ?
                     ORDER BY created_at DESC`;

        const rows = await this.allSql(sql, [userId]);
        return rows.map(row => new PayoutTransaction(
            row.transaction_id,
            row.user_id,
            row.transaction_type,
            row.amount,
            row.reference_id,
            row.status,
            row.created_at,
            row.completed_at
        ));
    }

    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
        });
    }
}

module.exports = PayoutSystem;
