# User Payout Management System

This system manages user payouts for affiliate sales with advance payouts, reconciliation, and withdrawal management.

## Features

- Advance payouts (10% of earnings for pending sales)
- Final payout calculation after reconciliation
- 24-hour withdrawal restriction
- Failed payout recovery
- SQLite database

## Setup

Install dependencies:
```bash
npm install
```

## Running the Demo

```bash
node demo.js
```

## Database Schema

See `database_schema.sql` for the complete database schema.

## API Design

See `api_design.md` for API endpoint specifications.

## Files

- `database_schema.sql` - Database schema
- `models.js` - Data models
- `payoutSystem.js` - Business logic
- `demo.js` - Demo script
- `package.json` - Dependencies
