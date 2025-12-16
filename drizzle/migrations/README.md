# Database Migrations

This directory contains Drizzle ORM migration files for the Vidriera en Casa application.

## Prerequisites

- Cloudflare account with D1 database access
- Wrangler CLI installed (`npm install -g wrangler`)
- D1 database created in Cloudflare dashboard

## Setup

### 1. Create D1 Database

Create a new D1 database in your Cloudflare account:

```bash
# For development
wrangler d1 create vidriera-dev

# For production
wrangler d1 create vidriera-production
```

This will output a database ID. Copy this ID for the next step.

### 2. Update wrangler.toml

Update the `wrangler.toml` file in the project root with your database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "vidriera-dev"  # or "vidriera-production"
database_id = "your-database-id-here"
```

### 3. Run Migrations

Apply the migrations to your D1 database:

```bash
# For local development
wrangler d1 migrations apply vidriera-dev --local

# For remote development database
wrangler d1 migrations apply vidriera-dev --remote

# For production
wrangler d1 migrations apply vidriera-production --remote
```

### 4. Verify Migration

Check that all tables were created successfully:

```bash
# List tables
wrangler d1 execute vidriera-dev --command "SELECT name FROM sqlite_master WHERE type='table';"

# Check a specific table structure
wrangler d1 execute vidriera-dev --command "PRAGMA table_info(users);"
```

## Generating New Migrations

When you modify the schema in `lib/db/schema.ts`, generate a new migration:

```bash
npx drizzle-kit generate
```

This will create a new migration file in this directory.

## Migration Files

- `0000_stiff_warlock.sql` - Initial schema with all tables

## Database Schema

The database includes the following tables:

- **users** - User accounts with authentication
- **sessions** - User session tokens
- **plans** - Monthly subscription plans
- **addons** - One-time credit add-ons
- **images** - Uploaded vidriera images
- **analyses** - AI analysis results
- **payments** - MercadoPago payment records
- **credit_transactions** - Audit log for credit operations

## Troubleshooting

### Migration fails with "table already exists"

If you need to reset the database:

```bash
# WARNING: This will delete all data
wrangler d1 execute vidriera-dev --command "DROP TABLE IF EXISTS users;"
# Repeat for all tables, then run migrations again
```

### Check migration status

```bash
wrangler d1 migrations list vidriera-dev
```

### Execute custom SQL

```bash
wrangler d1 execute vidriera-dev --command "YOUR SQL HERE"
```

## Production Deployment

Before deploying to production:

1. Create production D1 database
2. Update `wrangler.toml` with production database ID
3. Run migrations with `--remote` flag
4. Verify all tables exist
5. Test with sample data
6. Deploy application

## Backup

D1 databases are automatically backed up by Cloudflare. To export data:

```bash
wrangler d1 export vidriera-production --output backup.sql
```

## Support

For issues with D1 or migrations, refer to:

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
