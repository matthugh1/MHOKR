# Puzzel Setup and Import Guide

Quick guide for setting up a fresh Puzzel organization and importing Viva Goals JSON data.

## Quick Start

```bash
npm run setup:puzzel
```

This will:
1. ✅ Truncate all database tables (with confirmation)
2. ✅ Create "Puzzel" organization
3. ✅ Create tenant admin user (admin@puzzel.com / admin123)
4. ✅ Import Viva Goals JSON data from `./import` directory

## Options

### Skip Truncation
If you want to keep existing data and just add the organization:

```bash
npm run setup:puzzel -- --skip-truncate
```

### Custom Import Directory
Specify a different directory for JSON files:

```bash
npm run setup:puzzel -- --import-dir=./my-exports
```

### Custom Admin Credentials
Set custom admin email, password, and name:

```bash
npm run setup:puzzel -- --admin-email=your@email.com --admin-password=secure123 --admin-name="Your Name"
```

### All Options Combined
```bash
npm run setup:puzzel -- --skip-truncate --import-dir=./import --admin-email=admin@puzzel.com --admin-password=admin123 --admin-name="Admin User"
```

## Default Values

- **Organization Name**: Puzzel
- **Organization Slug**: puzzel
- **Admin Email**: admin@puzzel.com
- **Admin Password**: admin123
- **Admin Name**: Admin User
- **Import Directory**: ./import

## What Gets Imported

The script imports Objectives & Key Results from JSON files matching `*objectives*.json` in the import directory.

## After Setup

1. Login with the admin credentials
2. Verify imported OKRs in the dashboard
3. Check that users, teams, and cycles are imported correctly

## Troubleshooting

### "Import directory not found"
- Ensure JSON files are in the `./import` directory (or your specified directory)
- Check that files match the pattern `*objectives*.json`

### "Database connection error"
- Ensure `DATABASE_URL` is set in your environment
- Check that PostgreSQL is running

### "User already exists"
- The script will update existing users
- Or use `--skip-truncate` to keep existing data

## Manual Steps (if needed)

If you prefer to run steps separately:

```bash
# 1. Truncate database
cd services/core-api
ts-node scripts/truncate-all-tables.ts

# 2. Create organization and admin
ts-node scripts/setup-puzzel.ts

# 3. Import JSON data
cd ../..
npm run import:viva-goals -- --tenant=puzzel
```

