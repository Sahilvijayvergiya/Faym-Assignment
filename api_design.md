# API Endpoints Design

## Base URL
`/api/v1`

## Authentication
All endpoints require Bearer token authentication (except public endpoints if any)

---

## Sales Management

### Create Sale
```http
POST /sales
```

**Request Body:**
```json
{
  "user_id": "john_doe",
  "brand_id": "brand_1",
  "earning": 40.00
}
```

**Response:**
```json
{
  "sale_id": "sale_123",
  "user_id": "john_doe",
  "brand_id": "brand_1",
  "status": "pending",
  "earning": 40.00,
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Get Sales by User
```http
GET /users/{user_id}/sales
```

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected)
- `brand_id` (optional): Filter by brand

**Response:**
```json
{
  "sales": [
    {
      "sale_id": "sale_123",
      "user_id": "john_doe",
      "brand_id": "brand_1",
      "status": "pending",
      "earning": 40.00,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

---

## Advance Payout Management

### Process Advance Payouts (Job)
```http
POST /advance-payouts/process
```

**Description:** Processes advance payouts for all eligible pending sales (10% of earnings)

**Response:**
```json
{
  "batch_id": "advance_batch_123",
  "total_processed": 50,
  "total_amount": 120.00,
  "successful": 48,
  "failed": 2,
  "failed_sales": ["sale_456", "sale_789"]
}
```

### Get Advance Payouts by User
```http
GET /users/{user_id}/advance-payouts
```

**Response:**
```json
{
  "advance_payouts": [
    {
      "advance_payout_id": "advance_123",
      "sale_id": "sale_123",
      "user_id": "john_doe",
      "amount": 4.00,
      "status": "completed",
      "created_at": "2024-01-15T10:35:00Z",
      "completed_at": "2024-01-15T10:36:00Z"
    }
  ],
  "total": 1
}
```

---

## Reconciliation

### Reconcile Sales
```http
POST /reconcile
```

**Request Body:**
```json
{
  "sales_updates": [
    {
      "sale_id": "sale_123",
      "status": "approved"
    },
    {
      "sale_id": "sale_456",
      "status": "rejected"
    }
  ],
  "processed_by": "admin_123"
}
```

**Response:**
```json
{
  "batch_id": "recon_batch_123",
  "total_sales_processed": 2,
  "final_payouts": [
    {
      "user_id": "john_doe",
      "total_amount": 40.00,
      "advance_adjustment": -4.00,
      "net_amount": 36.00,
      "status": "pending"
    }
  ],
  "created_at": "2024-01-15T11:00:00Z"
}
```

---

## Final Payout Management

### Get Final Payouts by User
```http
GET /users/{user_id}/final-payouts
```

**Response:**
```json
{
  "final_payouts": [
    {
      "final_payout_id": "final_123",
      "user_id": "john_doe",
      "total_amount": 40.00,
      "advance_adjustment": -4.00,
      "net_amount": 36.00,
      "status": "completed",
      "reconciliation_batch_id": "recon_batch_123",
      "created_at": "2024-01-15T11:00:00Z",
      "completed_at": "2024-01-15T11:05:00Z"
    }
  ],
  "total": 1
}
```

### Process Final Payout
```http
POST /final-payouts/{final_payout_id}/process
```

**Response:**
```json
{
  "final_payout_id": "final_123",
  "status": "completed",
  "completed_at": "2024-01-15T11:05:00Z"
}
```

---

## Withdrawal Management

### Request Withdrawal
```http
POST /withdrawals
```

**Request Body:**
```json
{
  "user_id": "john_doe",
  "amount": 50.00
}
```

**Response (Success):**
```json
{
  "withdrawal_id": "withdrawal_123",
  "user_id": "john_doe",
  "amount": 50.00,
  "status": "pending",
  "created_at": "2024-01-15T12:00:00Z"
}
```

**Response (Error - 24h restriction):**
```json
{
  "error": "WITHDRAWAL_LIMIT_EXCEEDED",
  "message": "User can make only one withdrawal every 24 hours",
  "last_withdrawal_at": "2024-01-15T10:00:00Z",
  "next_withdrawal_allowed_at": "2024-01-16T10:00:00Z"
}
```

**Response (Error - Insufficient balance):**
```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Insufficient withdrawable balance",
  "requested_amount": 50.00,
  "available_balance": 30.00
}
```

### Get Withdrawals by User
```http
GET /users/{user_id}/withdrawals
```

**Response:**
```json
{
  "withdrawals": [
    {
      "withdrawal_id": "withdrawal_123",
      "user_id": "john_doe",
      "amount": 50.00,
      "status": "completed",
      "created_at": "2024-01-15T12:00:00Z",
      "completed_at": "2024-01-15T12:05:00Z"
    }
  ],
  "total": 1
}
```

### Process Withdrawal
```http
POST /withdrawals/{withdrawal_id}/process
```

**Response:**
```json
{
  "withdrawal_id": "withdrawal_123",
  "status": "completed",
  "completed_at": "2024-01-15T12:05:00Z"
}
```

---

## Failed Payout Recovery

### Handle Failed Payout
```http
POST /payouts/recover
```

**Request Body:**
```json
{
  "payout_type": "withdrawal",
  "payout_id": "withdrawal_123",
  "failure_reason": "bank_account_closed",
  "status": "failed"
}
```

**Response:**
```json
{
  "recovery_transaction_id": "recovery_123",
  "user_id": "john_doe",
  "amount_recovered": 50.00,
  "credited_to_balance": true,
  "new_withdrawable_balance": 80.00,
  "created_at": "2024-01-15T13:00:00Z"
}
```

---

## User Balance

### Get User Balance
```http
GET /users/{user_id}/balance
```

**Response:**
```json
{
  "user_id": "john_doe",
  "withdrawable_balance": 80.00,
  "pending_balance": 120.00,
  "total_earnings": 200.00,
  "total_advance_paid": 20.00,
  "last_withdrawal_at": "2024-01-15T12:00:00Z",
  "updated_at": "2024-01-15T13:00:00Z"
}
```

### Get User Payout Summary
```http
GET /users/{user_id}/payout-summary
```

**Response:**
```json
{
  "user_id": "john_doe",
  "total_pending_earnings": 120.00,
  "total_advance_eligible": 12.00,
  "total_advance_paid": 8.00,
  "withdrawable_balance": 80.00,
  "pending_balance": 120.00
}
```

---

## Error Response Format

All error responses follow this format:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

### Common Error Codes:
- `INVALID_REQUEST`: Malformed request
- `UNAUTHORIZED`: Authentication failed
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `INSUFFICIENT_BALANCE`: Not enough balance for withdrawal
- `WITHDRAWAL_LIMIT_EXCEEDED`: 24-hour withdrawal limit exceeded
- `SALE_ALREADY_RECONCILED`: Sale has already been reconciled
- `ADVANCE_ALREADY_PAID`: Advance payout already processed for this sale
- `INVALID_STATUS_TRANSITION`: Invalid status transition
- `INTERNAL_ERROR`: Server error
