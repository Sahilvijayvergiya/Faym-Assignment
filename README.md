# User Payout Management System

## Low-Level Design

### System Overview

This system manages user payouts for affiliate sales with the following workflow:
1. Sales enter as "pending" status
2. Users receive 10% advance payout on pending sales
3. Administrator reconciles sales (approved/rejected)
4. Final payout calculated considering advance payouts
5. Users can withdraw with 24-hour restriction
6. Failed payouts are recovered to user balance

### Database Schema

The database consists of 9 tables:

**Core Tables:**
- `users` - User information
- `brands` - Brand information
- `sales` - Sale transactions with status (pending/approved/rejected)
- `user_balances` - User balance state (withdrawable, pending, total earnings)

**Payout Tables:**
- `advance_payouts` - Tracks 10% advance payouts (UNIQUE on sale_id prevents duplicates)
- `final_payouts` - Final payouts after reconciliation
- `withdrawals` - User withdrawal requests

**Tracking Tables:**
- `reconciliation_batches` - Reconciliation operation tracking
- `payout_transactions` - Audit trail for all payout operations

### Key Design Decisions

**1. Advance Payout Idempotency**
- UNIQUE constraint on `advance_payouts.sale_id` ensures no duplicate payouts
- Job uses LEFT JOIN to find pending sales without existing advances
- Prevents duplicate payouts even if job runs multiple times

**2. Final Payout Calculation**
- Approved: `earning - advance_paid`
- Rejected: `-advance_paid` (negative adjustment)
- Grouped by user for batch processing

**3. Withdrawal Restriction**
- 24-hour limit enforced via `last_withdrawal_at` timestamp
- Checked before creating withdrawal request
- Returns next allowed timestamp if limit exceeded

**4. Balance Management**
- Denormalized `user_balances` table for fast queries
- Updated on every transaction (advance, final, withdrawal, recovery)
- Tracks: withdrawable, pending, total earnings, total advance paid

**5. Failed Payout Recovery**
- Credits failed amount back to withdrawable balance
- Supports withdrawal and final payout recovery
- Creates recovery transaction in audit trail

### Edge Cases Handled

1. **Duplicate advance payouts** - Prevented by UNIQUE constraint
2. **Reconciling already reconciled sale** - Skipped with log message
3. **Sale with no advance payout** - Full amount credited
4. **All sales rejected** - Negative adjustments applied correctly
5. **Insufficient balance withdrawal** - Validation before request
6. **24-hour limit exceeded** - Error with next allowed time
7. **Failed payout recovery** - Amount credited back to balance
8. **Non-existent user operations** - Appropriate error handling

### API Endpoints

See `api_design.md` for detailed API specifications including:
- POST /sales - Create sale
- GET /users/{user_id}/sales - Get user sales
- POST /advance-payouts/process - Process advance payouts
- POST /reconcile - Reconcile sales
- POST /withdrawals - Request withdrawal
- POST /payouts/recover - Recover failed payout
- GET /users/{user_id}/balance - Get user balance
- GET /users/{user_id}/payout-summary - Get payout summary

## Setup

Install dependencies:
```bash
npm install
```

## Running the Demo

```bash
node demo.js
```

The demo covers:
- Basic workflow (matching assignment example)
- Withdrawal restrictions
- Failed payout recovery
- Edge cases

## Files

- `database_schema.sql` - Database schema with relationships and indexes
- `models.js` - Data models and enums
- `payoutSystem.js` - Business logic implementation
- `demo.js` - Demo script with edge cases
- `api_design.md` - API endpoint specifications
- `package.json` - Dependencies
