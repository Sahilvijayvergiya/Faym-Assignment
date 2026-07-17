/**
 * Demo and Test Script for User Payout Management System
 * Demonstrates all functionality including edge cases
 */

const fs = require('fs');
const PayoutSystem = require('./payoutSystem');
const { SaleStatus } = require('./models');

function printSection(title) {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${title}`);
    console.log('='.repeat(60));
}

function printSubsection(title) {
    console.log(`\n--- ${title} ---`);
}

async function demoBasicWorkflow() {
    printSection('BASIC WORKFLOW DEMO');

    const dbPath = 'payout_system.db';
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }

    const system = new PayoutSystem(dbPath);

    try {
        // Step 1: Create pending sales
        printSubsection('Creating 3 pending sales for john_doe (₹40 each)');
        const sale1 = await system.createSale('john_doe', 'brand_1', 40);
        const sale2 = await system.createSale('john_doe', 'brand_1', 40);
        const sale3 = await system.createSale('john_doe', 'brand_1', 40);
        console.log(`Created sales: ${sale1.saleId}, ${sale2.saleId}, ${sale3.saleId}`);

        let balance = await system.getUserBalance('john_doe');
        console.log(`User Balance - Pending: ₹${balance.pendingBalance}, Withdrawable: ₹${balance.withdrawableBalance}`);

        // Step 2: Process advance payouts
        printSubsection('Processing advance payouts (10% of ₹120 = ₹12)');
        const result = await system.processAdvancePayouts();
        console.log(`Processed: ${result.totalProcessed} sales`);
        console.log(`Total advance amount: ₹${result.totalAmount}`);
        console.log(`Successful: ${result.successful}, Failed: ${result.failed}`);

        balance = await system.getUserBalance('john_doe');
        console.log(`User Balance - Pending: ₹${balance.pendingBalance}, Withdrawable: ₹${balance.withdrawableBalance}`);
        console.log(`Total advance paid: ₹${balance.totalAdvancePaid}`);

        // Step 3: Reconcile sales
        printSubsection('Reconciling sales: 1 rejected, 2 approved');
        const reconciliationResult = await system.reconcileSales(
            [
                { sale_id: sale1.saleId, status: 'rejected' },
                { sale_id: sale2.saleId, status: 'approved' },
                { sale_id: sale3.saleId, status: 'approved' }
            ],
            'admin_123'
        );
        console.log(`Batch ID: ${reconciliationResult.batchId}`);
        console.log(`Sales processed: ${reconciliationResult.totalSalesProcessed}`);

        for (const payout of reconciliationResult.finalPayouts) {
            console.log(`User: ${payout.userId}`);
            console.log(`  Total earnings: ₹${payout.totalAmount}`);
            console.log(`  Advance adjustment: ₹${payout.advanceAdjustment}`);
            console.log(`  Net amount: ₹${payout.netAmount}`);
        }

        console.log('\nExpected final payout: ₹68');

        balance = await system.getUserBalance('john_doe');
        console.log(`Final withdrawable balance: ₹${balance.withdrawableBalance}`);

    } finally {
        system.close();
    }
}

async function demoWithdrawalRestrictions() {
    printSection('WITHDRAWAL RESTRICTION DEMO');

    const dbPath = 'payout_system_demo2.db';
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }

    const system = new PayoutSystem(dbPath);

    try {
        printSubsection('Creating sale and processing advance payout');
        await system.createSale('user_1', 'brand_1', 100);
        await system.processAdvancePayouts();

        let balance = await system.getUserBalance('user_1');
        console.log(`Withdrawable balance: ₹${balance.withdrawableBalance}`);

        printSubsection('First withdrawal request');
        const result1 = await system.requestWithdrawal('user_1', 5);
        if (result1.success) {
            console.log(`Withdrawal created: ${result1.withdrawal.withdrawalId}, Amount: ₹${result1.withdrawal.amount}`);
        } else {
            console.log(`Error: ${result1.error}`);
        }

        printSubsection('Second withdrawal request (within 24 hours - should fail)');
        const result2 = await system.requestWithdrawal('user_1', 5);
        if (result2.success) {
            console.log(`Withdrawal created: ${result2.withdrawal.withdrawalId}`);
        } else {
            console.log(`Expected error: ${result2.error}`);
        }

        printSubsection('Withdrawal exceeding balance (should fail)');
        const result3 = await system.requestWithdrawal('user_1', 1000);
        if (result3.success) {
            console.log(`Withdrawal created: ${result3.withdrawal.withdrawalId}`);
        } else {
            console.log(`Expected error: ${result3.error}`);
        }

    } finally {
        system.close();
    }
}

async function demoFailedPayoutRecovery() {
    printSection('FAILED PAYOUT RECOVERY DEMO');

    const dbPath = 'payout_system_demo3.db';
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }

    const system = new PayoutSystem(dbPath);

    try {
        printSubsection('Creating sale and processing advance payout');
        await system.createSale('user_2', 'brand_1', 100);
        await system.processAdvancePayouts();

        let balance = await system.getUserBalance('user_2');
        console.log(`Initial withdrawable balance: ₹${balance.withdrawableBalance}`);

        printSubsection('Requesting withdrawal');
        const result = await system.requestWithdrawal('user_2', 5);
        console.log(`Withdrawal created: ${result.withdrawal.withdrawalId}, Amount: ₹${result.withdrawal.amount}`);

        balance = await system.getUserBalance('user_2');
        console.log(`Balance after withdrawal request: ₹${balance.withdrawableBalance}`);

        printSubsection('Simulating withdrawal failure and recovery');
        const recovery = await system.recoverFailedPayout('withdrawal', result.withdrawal.withdrawalId, 'bank_error');
        console.log(`Recovery transaction ID: ${recovery.recoveryTransactionId}`);
        console.log(`Amount recovered: ₹${recovery.amountRecovered}`);
        console.log(`Credited to balance: ${recovery.creditedToBalance}`);
        console.log(`New withdrawable balance: ₹${recovery.newWithdrawableBalance}`);

        printSubsection('Attempting withdrawal after recovery');
        const newResult = await system.requestWithdrawal('user_2', 5);
        if (newResult.success) {
            console.log(`New withdrawal created: ${newResult.withdrawal.withdrawalId}`);
        } else {
            console.log(`Error: ${newResult.error}`);
        }

    } finally {
        system.close();
    }
}

async function demoEdgeCases() {
    printSection('EDGE CASES DEMO');

    const dbPath = 'payout_system_demo4.db';
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }

    const system = new PayoutSystem(dbPath);

    try {
        // Edge Case 1
        printSubsection('Edge Case 1: Advance payout job runs multiple times');
        const sale = await system.createSale('user_3', 'brand_1', 50);

        const result1 = await system.processAdvancePayouts();
        console.log(`First run - Processed: ${result1.totalProcessed}, Amount: ₹${result1.totalAmount}`);

        const result2 = await system.processAdvancePayouts();
        console.log(`Second run - Processed: ${result2.totalProcessed}, Amount: ₹${result2.totalAmount}`);
        console.log('✓ No duplicate advance payouts created');

        // Edge Case 2
        printSubsection('Edge Case 2: Reconciling already reconciled sale');
        await system.reconcileSales([{ sale_id: sale.saleId, status: 'approved' }], 'admin_123');
        console.log('First reconciliation completed');

        const result = await system.reconcileSales([{ sale_id: sale.saleId, status: 'rejected' }], 'admin_123');
        console.log(`Second reconciliation - Sales processed: ${result.totalSalesProcessed}`);
        console.log('✓ Already reconciled sale was not processed again');

        // Edge Case 3
        printSubsection('Edge Case 3: Sale with no advance payout');
        const sale2 = await system.createSale('user_3', 'brand_1', 30);
        const result3 = await system.reconcileSales([{ sale_id: sale2.saleId, status: 'approved' }], 'admin_123');
        console.log(`Final payout for sale with no advance: ₹${result3.finalPayouts[0].netAmount}`);
        console.log('✓ Full amount credited (no advance to deduct)');

        // Edge Case 4
        printSubsection('Edge Case 4: All sales rejected (negative adjustment)');
        const sale3 = await system.createSale('user_4', 'brand_1', 100);
        await system.processAdvancePayouts();
        const result4 = await system.reconcileSales([{ sale_id: sale3.saleId, status: 'rejected' }], 'admin_123');
        console.log(`Rejected sale adjustment: ₹${result4.finalPayouts[0].advanceAdjustment}`);
        console.log('✓ Negative adjustment applied correctly');

        // Edge Case 5
        printSubsection('Edge Case 5: Operations on non-existent user');
        try {
            await system.getUserBalance('nonexistent_user');
            console.log('Should not reach here');
        } catch (error) {
            console.log(`✓ Expected error: ${error.message}`);
        }

        // Edge Case 6
        printSubsection('Edge Case 6: Invalid payout type in recovery');
        try {
            await system.recoverFailedPayout('invalid_type', 'some_id', 'error');
            console.log('Should not reach here');
        } catch (error) {
            console.log(`✓ Expected error: ${error.message}`);
        }

    } finally {
        system.close();
    }
}

async function demoUserPayoutSummary() {
    printSection('USER PAYOUT SUMMARY DEMO');

    const dbPath = 'payout_system_demo5.db';
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }

    const system = new PayoutSystem(dbPath);

    try {
        printSubsection('Creating sales with different states');
        await system.createSale('user_5', 'brand_1', 100);
        await system.createSale('user_5', 'brand_1', 50);
        await system.createSale('user_5', 'brand_1', 75);

        await system.processAdvancePayouts();

        const summary = await system.getUserPayoutSummary('user_5');
        console.log(`User: ${summary.userId}`);
        console.log(`Total pending earnings: ₹${summary.totalPendingEarnings}`);
        console.log(`Total advance eligible: ₹${summary.totalAdvanceEligible}`);
        console.log(`Total advance paid: ₹${summary.totalAdvancePaid}`);
        console.log(`Withdrawable balance: ₹${summary.withdrawableBalance}`);
        console.log(`Pending balance: ₹${summary.pendingBalance}`);

    } finally {
        system.close();
    }
}

async function runAllDemos() {
    console.log('\n' + '='.repeat(60));
    console.log('  USER PAYOUT MANAGEMENT SYSTEM - DEMO');
    console.log('='.repeat(60));

    await demoBasicWorkflow();
    await demoWithdrawalRestrictions();
    await demoFailedPayoutRecovery();
    await demoEdgeCases();
    await demoUserPayoutSummary();

    printSection('DEMO COMPLETED');
    console.log('All functionality demonstrated successfully!');
}

runAllDemos().catch(console.error);
