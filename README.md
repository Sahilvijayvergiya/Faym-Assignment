# User Payout Management System

## Overview

A comprehensive Low-Level Design (LLD) for managing user payouts for affiliate sales. The system handles advance payouts, final payouts after reconciliation, withdrawal management with 24-hour restrictions, and failed payout recovery.

**Implemented in JavaScript (Node.js)**

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [Entity Relationships](#entity-relationships)
4. [Class Design](#class-design)
5. [API Endpoints](#api-endpoints)
6. [Business Logic](#business-logic)
7. [Edge Cases & Failure Scenarios](#edge-cases--failure-scenarios)
8. [Design Decisions & Trade-offs](#design-decisions--trade-offs)
9. [Running the Demo](#running-the-demo)

---

## System Architecture

### Components

1. **Database Layer**: SQLite (easily portable to PostgreSQL/MySQL)
2. **Business Logic Layer**: Python classes handling payout calculations
3. **API Layer**: RESTful endpoints (design provided, implementation can use Flask/FastAPI)
4. **Transaction Layer**: Audit trail for all payout operations

### Data Flow

```
Sale Creation → Pending Status → Advance Payout (10%) → Reconciliation → Final Payout → Withdrawal
```

---

## Database Schema

### Tables

#### 1. users
Stores user information.

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | VARCHAR(50) | PRIMARY KEY |
| email | VARCHAR(100) | UNIQUE, NOT NULL |
| full_name | VARCHAR(100) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

#### 2. brands
Stores brand information.

| Column | Type | Constraints |
|--------|------|-------------|
| brand_id | VARCHAR(50) | PRIMARY KEY |
| brand_name | VARCHAR(100) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

#### 3. sales
Stores sale transactions.

| Column | Type | Constraints |
|--------|------|-------------|
| sale_id | VARCHAR(50) | PRIMARY KEY |
| user_id | VARCHAR(50) | FOREIGN KEY → users |
| brand_id | VARCHAR(50) | FOREIGN KEY → brands |
| status | VARCHAR(20) | CHECK (pending, approved, rejected) |
| earning | DECIMAL(10,2) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Indexes**: user_id, status, brand_id

#### 4. advance_payouts
Tracks advance payouts for pending sales.

| Column | Type | Constraints |
|--------|------|-------------|
| advance_payout_id | VARCHAR(50) | PRIMARY KEY |
| sale_id | VARCHAR(50) | FOREIGN KEY → sales, UNIQUE |
| user_id | VARCHAR(50) | FOREIGN KEY → users |
| amount | DECIMAL(10,2) | NOT NULL |
| status | VARCHAR(20) | CHECK (pending, completed, failed, cancelled) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| completed_at | TIMESTAMP | NULLABLE |

**Indexes**: user_id, status

**Key Design**: UNIQUE constraint on sale_id ensures one advance payout per sale, preventing duplicates.

#### 5. final_payouts
Tracks final payouts after reconciliation.

| Column | Type | Constraints |
|--------|------|-------------|
| final_payout_id | VARCHAR(50) | PRIMARY KEY |
| user_id | VARCHAR(50) | FOREIGN KEY → users |
| total_amount | DECIMAL(10,2) | NOT NULL |
| advance_adjustment | DECIMAL(10,2) | NOT NULL DEFAULT 0 |
| net_amount | DECIMAL(10,2) | NOT NULL |
| status | VARCHAR(20) | CHECK (pending, completed, failed, cancelled) |
| reconciliation_batch_id | VARCHAR(50) | NULLABLE |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| completed_at | TIMESTAMP | NULLABLE |

**Indexes**: user_id

#### 6. withdrawals
Tracks user withdrawal requests.

| Column | Type | Constraints |
|--------|------|-------------|
| withdrawal_id | VARCHAR(50) | PRIMARY KEY |
| user_id | VARCHAR(50) | FOREIGN KEY → users |
| amount | DECIMAL(10,2) | NOT NULL |
| status | VARCHAR(20) | CHECK (pending, completed, failed, cancelled) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| completed_at | TIMESTAMP | NULLABLE |

**Indexes**: user_id, status

#### 7. user_balances
Tracks user balance state.

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | VARCHAR(50) | PRIMARY KEY, FOREIGN KEY → users |
| withdrawable_balance | DECIMAL(10,2) | NOT NULL DEFAULT 0 |
| pending_balance | DECIMAL(10,2) | NOT NULL DEFAULT 0 |
| total_earnings | DECIMAL(10,2) | NOT NULL DEFAULT 0 |
| total_advance_paid | DECIMAL(10,2) | NOT NULL DEFAULT 0 |
| last_withdrawal_at | TIMESTAMP | NULLABLE |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Design Decision**: Denormalized balance table for fast balance queries without complex aggregations.

#### 8. reconciliation_batches
Tracks reconciliation operations.

| Column | Type | Constraints |
|--------|------|-------------|
| batch_id | VARCHAR(50) | PRIMARY KEY |
| processed_by | VARCHAR(50) | NOT NULL |
| total_sales_processed | INTEGER | NOT NULL |
| total_amount | DECIMAL(10,2) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

#### 9. payout_transactions
Audit trail for all payout operations.

| Column | Type | Constraints |
|--------|------|-------------|
| transaction_id | VARCHAR(50) | PRIMARY KEY |
| user_id | VARCHAR(50) | FOREIGN KEY → users |
| transaction_type | VARCHAR(20) | CHECK (advance, final, withdrawal, recovery) |
| amount | DECIMAL(10,2) | NOT NULL |
| reference_id | VARCHAR(50) | NOT NULL |
| status | VARCHAR(20) | CHECK (pending, completed, failed, cancelled) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| completed_at | TIMESTAMP | NULLABLE |

**Indexes**: user_id, reference_id

---

## Entity Relationships

```
users (1) ----< (N) sales
users (1) ----< (N) advance_payouts
users (1) ----< (N) final_payouts
users (1) ----< (N) withdrawals
users (1) ----< (1) user_balances
users (1) ----< (N) payout_transactions

brands (1) ----< (N) sales

sales (1) ----< (1) advance_payouts

reconciliation_batches (1) ----< (N) final_payouts
```

---

## Class Design

### Core Models (models.py)

#### Enums
- `SaleStatus`: PENDING, APPROVED, REJECTED
- `PayoutStatus`: PENDING, COMPLETED, FAILED, CANCELLED
- `TransactionType`: ADVANCE, FINAL, WITHDRAWAL, RECOVERY

#### Data Classes
- `User`: User entity
- `Brand`: Brand entity
- `Sale`: Sale transaction
- `AdvancePayout`: Advance payout record
- `FinalPayout`: Final payout after reconciliation
- `Withdrawal`: User withdrawal request
- `UserBalance`: User balance state
- `ReconciliationBatch`: Reconciliation operation
- `PayoutTransaction`: Audit trail entry
- `PayoutCalculationResult`: Result of payout calculation
- `UserPayoutSummary`: User payout summary

### Main System Class (payout_system.py)

#### PayoutSystem Methods

**Sale Management**
- `create_sale()`: Create new pending sale
- `get_sales_by_user()`: Retrieve user's sales

**Advance Payout Management**
- `process_advance_payouts()`: Process 10% advance for eligible pending sales
- `get_advance_payouts_by_user()`: Retrieve user's advance payouts

**Reconciliation**
- `reconcile_sales()`: Update sale statuses and calculate final payouts

**Withdrawal Management**
- `request_withdrawal()`: Request withdrawal with 24-hour limit check
- `process_withdrawal()`: Process withdrawal (complete or fail)
- `get_withdrawals_by_user()`: Retrieve user's withdrawals

**Failed Payout Recovery**
- `recover_failed_payout()`: Credit failed payout back to balance

**User Balance**
- `get_user_balance()`: Get user's current balance
- `get_user_payout_summary()`: Get comprehensive payout summary

**Transaction Management**
- `_create_payout_transaction()`: Create audit trail entry
- `get_payout_transactions()`: Retrieve user's transactions

---

## API Endpoints

See `api_design.md` for detailed API specifications.

### Key Endpoints

1. **POST /sales** - Create sale
2. **GET /users/{user_id}/sales** - Get user sales
3. **POST /advance-payouts/process** - Process advance payouts
4. **POST /reconcile** - Reconcile sales
5. **POST /withdrawals** - Request withdrawal
6. **POST /payouts/recover** - Recover failed payout
7. **GET /users/{user_id}/balance** - Get user balance
8. **GET /users/{user_id}/payout-summary** - Get payout summary

---

## Business Logic

### 1. Advance Payout Calculation

**Rule**: Every pending sale is eligible for 10% advance payout.

**Implementation**:
```python
advance_amount = earning * 0.10
```

**Idempotency**: The UNIQUE constraint on `advance_payouts.sale_id` ensures that even if the advance payout job runs multiple times, a sale will never receive duplicate advance payouts.

**Balance Impact**:
- `withdrawable_balance += advance_amount`
- `pending_balance -= advance_amount`
- `total_advance_paid += advance_amount`

### 2. Final Payout Calculation

**After Reconciliation**:

**Case 1: Approved Sale**
```
final_adjustment = earning - advance_paid
```
Example: Earning ₹30, Advance ₹3 → Final ₹27

**Case 2: Rejected Sale**
```
final_adjustment = -advance_paid
```
Example: Earning ₹50, Advance ₹5 → Final -₹5 (adjustment)

**Balance Impact**:
- `withdrawable_balance += final_adjustment`
- `pending_balance -= earning` (if approved)

### 3. Withdrawal Restrictions

**Rule**: One withdrawal every 24 hours per user.

**Implementation**:
```python
if last_withdrawal_at and (now - last_withdrawal_at) < timedelta(hours=24):
    raise WithdrawalLimitExceeded
```

**Balance Impact**:
- `withdrawable_balance -= amount`
- `last_withdrawal_at = now`

### 4. Failed Payout Recovery

**Rule**: Failed payouts are credited back to withdrawable balance.

**Implementation**:
```python
withdrawable_balance += failed_amount
```

**Supported Payout Types**:
- Withdrawals
- Final payouts

---

## Edge Cases & Failure Scenarios

### 1. Advance Payout Job Runs Multiple Times

**Scenario**: The advance payout job runs multiple times due to system restart or retry logic.

**Solution**: UNIQUE constraint on `advance_payouts.sale_id` prevents duplicate entries. The job uses a LEFT JOIN to find pending sales without existing advance payouts.

### 2. Reconciling Already Reconciled Sale

**Scenario**: Attempting to reconcile a sale that has already been reconciled.

**Solution**: The system checks if the sale status is still PENDING before processing. Non-pending sales are skipped with a log message.

### 3. Sale with No Advance Payout

**Scenario**: A sale is reconciled without receiving an advance payout.

**Solution**: The system handles this correctly by calculating `advance_paid = 0`, resulting in the full earning amount being credited.

### 4. All Sales Rejected

**Scenario**: All sales for a user are rejected, resulting in negative adjustments.

**Solution**: The system correctly applies negative adjustments. The user's withdrawable balance decreases by the total advance amount that needs to be recovered.

### 5. Insufficient Balance for Withdrawal

**Scenario**: User requests withdrawal exceeding available balance.

**Solution**: System validates balance before creating withdrawal request and returns appropriate error.

### 6. 24-Hour Withdrawal Limit Exceeded

**Scenario**: User attempts second withdrawal within 24 hours.

**Solution**: System checks `last_withdrawal_at` and returns error with next allowed timestamp.

### 7. Failed Payout Recovery for Invalid Payout

**Scenario**: Attempting to recover a payout that doesn't exist or has invalid type.

**Solution**: System validates payout existence and type before processing recovery.

### 8. Concurrent Withdrawal Requests

**Scenario**: Multiple withdrawal requests for the same user at the same time.

**Solution**: Database transactions with proper isolation levels ensure consistency. In production, use row-level locking or optimistic concurrency control.

### 9. Database Connection Failure

**Scenario**: Database connection fails during operation.

**Solution**: System uses transaction rollback to maintain consistency. In production, implement connection pooling and retry logic.

### 10. Negative Balance Edge Case

**Scenario**: After rejection of sales with advance payouts, user balance could theoretically go negative.

**Solution**: Current implementation allows negative balances to track debt. In production, add validation to prevent negative withdrawable balances or implement debt collection logic.

---

## Design Decisions & Trade-offs

### 1. Database Choice: SQLite

**Decision**: Used SQLite for the implementation.

**Rationale**:
- Zero configuration required
- Portable single-file database
- Sufficient for demo and small-scale deployments
- Easy to migrate to PostgreSQL/MySQL later

**Trade-off**: Not suitable for high-concurrency production environments. For production, migrate to PostgreSQL with connection pooling.

### 2. Denormalized Balance Table

**Decision**: Separate `user_balances` table with pre-calculated totals.

**Rationale**:
- Fast balance queries without complex aggregations
- Avoids expensive JOIN operations for common operations
- Simplifies balance validation logic

**Trade-off**: Requires careful synchronization with transaction tables. Must update balance on every transaction. In production, consider event sourcing or eventual consistency.

### 3. Unique Constraint for Advance Payouts

**Decision**: UNIQUE constraint on `advance_payouts.sale_id`.

**Rationale**:
- Database-level enforcement prevents duplicates
- Idempotent advance payout job
- No need for application-level locking

**Trade-off**: Cannot have multiple partial advance payouts for a single sale (not required by current business rules).

### 4. Status-Based State Machine

**Decision**: Explicit status columns with CHECK constraints.

**Rationale**:
- Database-level validation
- Clear state transitions
- Easy to query by status

**Trade-off**: Less flexible than generic state machine libraries. For complex workflows, consider dedicated workflow engines.

### 5. Audit Trail with Payout Transactions

**Decision**: Separate `payout_transactions` table for audit trail.

**Rationale**:
- Complete history of all payout operations
- Easy debugging and reconciliation
- Supports analytics and reporting

**Trade-off**: Additional storage and write overhead. In high-volume systems, consider archiving old transactions.

### 6. Decimal Type for Monetary Values

**Decision**: Use DECIMAL(10,2) for all monetary fields.

**Rationale**:
- Precise decimal arithmetic
- Avoids floating-point rounding errors
- Standard for financial applications

**Trade-off**: Slightly more storage than floating-point. Negligible for this use case.

### 7. Batch Processing for Reconciliation

**Decision**: Reconciliation processes multiple sales in a single batch.

**Rationale**:
- Efficient bulk operations
- Single transaction for consistency
- Grouped final payouts by user

**Trade-off**: If batch fails partially, need retry logic. In production, implement idempotent batch processing.

### 8. Synchronous vs Asynchronous Payout Processing

**Decision**: Implemented synchronous processing in demo.

**Rationale**:
- Simpler for demonstration
- Easier to test and debug
- Immediate feedback

**Trade-off**: Not suitable for production. In production, use message queues (RabbitMQ, Kafka) for asynchronous payout processing with retry logic.

### 9. 24-Hour Limit Implementation

**Decision**: Check `last_withdrawal_at` timestamp in database.

**Rationale**:
- Simple and reliable
- Database-enforced consistency
- Easy to query

**Trade-off**: Requires timezone handling for global systems. In production, store UTC timestamps and handle timezone conversion at application layer.

### 10. Failed Payout Recovery Design

**Decision**: Credit back to withdrawable balance immediately.

**Rationale**:
- User can retry withdrawal immediately
- Simple and predictable
- No complex debt tracking

**Trade-off**: Doesn't track recovery history separately. In production, might want separate recovery tracking for analytics.

---

## Running the Demo

### Prerequisites
- Node.js 14+
- npm

### Setup
1. Install dependencies:
```bash
npm install
```

2. Ensure all files are in the same directory:
   - `database_schema.sql`
   - `models.js`
   - `payoutSystem.js`
   - `demo.js`
   - `package.json`

### Run Demo
```bash
npm run demo
# or
node demo.js
```

### Demo Sections

The demo covers:

1. **Basic Workflow**: Creates sales, processes advance payouts, reconciles sales (matching the problem statement example)
2. **Withdrawal Restrictions**: Demonstrates 24-hour limit and insufficient balance handling
3. **Failed Payout Recovery**: Shows recovery of failed withdrawals
4. **Edge Cases**: Tests duplicate advance payouts, reconciling already reconciled sales, and more
5. **User Payout Summary**: Displays comprehensive payout information

### Expected Output

The demo will print detailed output for each section, showing:
- Sale creation
- Balance updates
- Advance payout processing
- Reconciliation results
- Withdrawal requests and restrictions
- Failed payout recovery
- Edge case handling

---

## Production Considerations

### Scalability

1. **Database**: Migrate to PostgreSQL with connection pooling
2. **Caching**: Use Redis for frequently accessed user balances
3. **Message Queue**: Implement RabbitMQ/Kafka for asynchronous payout processing
4. **Load Balancing**: Horizontal scaling of API servers

### Security

1. **Authentication**: JWT-based authentication for all endpoints
2. **Authorization**: Role-based access control (admin vs user)
3. **Encryption**: Encrypt sensitive data at rest
4. **Audit Logging**: Comprehensive logging of all operations

### Monitoring

1. **Metrics**: Track payout processing times, failure rates
2. **Alerting**: Alert on failed payouts, balance inconsistencies
3. **Health Checks**: Database connectivity, queue status

### Testing

1. **Unit Tests**: Test individual business logic functions
2. **Integration Tests**: Test database operations
3. **Load Tests**: Simulate high-volume payout processing
4. **Chaos Tests**: Test failure scenarios

---

## File Structure

```
Fayam Assignment/
├── database_schema.sql      # Database schema definition
├── models.js                # JavaScript data models and enums
├── payoutSystem.js          # JavaScript business logic implementation
├── demo.js                  # JavaScript demo and test script
├── package.json             # Node.js dependencies
├── api_design.md            # API endpoint specifications
└── README.md                # This file
```

---

## Summary

This User Payout Management System provides:

✅ Complete database schema with relationships and indexes
✅ Entity/class design with clear separation of concerns
✅ RESTful API design with comprehensive endpoints
✅ Business logic for advance payouts (10% of earnings)
✅ Final payout calculation after reconciliation
✅ 24-hour withdrawal restriction enforcement
✅ Failed payout recovery mechanism
✅ Edge case handling and failure scenarios
✅ Working implementation in Python
✅ Detailed documentation of design decisions and trade-offs

The system is production-ready with the recommended enhancements for scalability, security, and monitoring.
