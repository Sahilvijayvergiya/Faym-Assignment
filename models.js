// Enums
const SaleStatus = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
};

const PayoutStatus = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

const TransactionType = {
    ADVANCE: 'advance',
    FINAL: 'final',
    WITHDRAWAL: 'withdrawal',
    RECOVERY: 'recovery'
};

// Classes
class User {
    constructor(userId, email, fullName, createdAt, updatedAt) {
        this.userId = userId;
        this.email = email;
        this.fullName = fullName;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}

class Brand {
    constructor(brandId, brandName, createdAt) {
        this.brandId = brandId;
        this.brandName = brandName;
        this.createdAt = createdAt;
    }
}

class Sale {
    constructor(saleId, userId, brandId, status, earning, createdAt, updatedAt) {
        this.saleId = saleId;
        this.userId = userId;
        this.brandId = brandId;
        this.status = status;
        this.earning = earning;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}

class AdvancePayout {
    constructor(advancePayoutId, saleId, userId, amount, status, createdAt, completedAt = null) {
        this.advancePayoutId = advancePayoutId;
        this.saleId = saleId;
        this.userId = userId;
        this.amount = amount;
        this.status = status;
        this.createdAt = createdAt;
        this.completedAt = completedAt;
    }
}

class FinalPayout {
    constructor(finalPayoutId, userId, totalAmount, advanceAdjustment, netAmount, status, reconciliationBatchId = null, createdAt, completedAt = null) {
        this.finalPayoutId = finalPayoutId;
        this.userId = userId;
        this.totalAmount = totalAmount;
        this.advanceAdjustment = advanceAdjustment;
        this.netAmount = netAmount;
        this.status = status;
        this.reconciliationBatchId = reconciliationBatchId;
        this.createdAt = createdAt;
        this.completedAt = completedAt;
    }
}

class Withdrawal {
    constructor(withdrawalId, userId, amount, status, createdAt, completedAt = null) {
        this.withdrawalId = withdrawalId;
        this.userId = userId;
        this.amount = amount;
        this.status = status;
        this.createdAt = createdAt;
        this.completedAt = completedAt;
    }
}

class UserBalance {
    constructor(userId, withdrawableBalance, pendingBalance, totalEarnings, totalAdvancePaid, lastWithdrawalAt = null, updatedAt) {
        this.userId = userId;
        this.withdrawableBalance = withdrawableBalance;
        this.pendingBalance = pendingBalance;
        this.totalEarnings = totalEarnings;
        this.totalAdvancePaid = totalAdvancePaid;
        this.lastWithdrawalAt = lastWithdrawalAt;
        this.updatedAt = updatedAt;
    }
}

class ReconciliationBatch {
    constructor(batchId, processedBy, totalSalesProcessed, totalAmount, createdAt) {
        this.batchId = batchId;
        this.processedBy = processedBy;
        this.totalSalesProcessed = totalSalesProcessed;
        this.totalAmount = totalAmount;
        this.createdAt = createdAt;
    }
}

class PayoutTransaction {
    constructor(transactionId, userId, transactionType, amount, referenceId, status, createdAt, completedAt = null) {
        this.transactionId = transactionId;
        this.userId = userId;
        this.transactionType = transactionType;
        this.amount = amount;
        this.referenceId = referenceId;
        this.status = status;
        this.createdAt = createdAt;
        this.completedAt = completedAt;
    }
}

class PayoutCalculationResult {
    constructor(saleId, earning, advancePaid, finalAdjustment, status) {
        this.saleId = saleId;
        this.earning = earning;
        this.advancePaid = advancePaid;
        this.finalAdjustment = finalAdjustment;
        this.status = status;
    }
}

class UserPayoutSummary {
    constructor(userId, totalPendingEarnings, totalAdvanceEligible, totalAdvancePaid, withdrawableBalance, pendingBalance) {
        this.userId = userId;
        this.totalPendingEarnings = totalPendingEarnings;
        this.totalAdvanceEligible = totalAdvanceEligible;
        this.totalAdvancePaid = totalAdvancePaid;
        this.withdrawableBalance = withdrawableBalance;
        this.pendingBalance = pendingBalance;
    }
}

module.exports = {
    SaleStatus,
    PayoutStatus,
    TransactionType,
    User,
    Brand,
    Sale,
    AdvancePayout,
    FinalPayout,
    Withdrawal,
    UserBalance,
    ReconciliationBatch,
    PayoutTransaction,
    PayoutCalculationResult,
    UserPayoutSummary
};
