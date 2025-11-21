# Viva Goals JSON Import Guide

This guide explains how to import data from Viva Goals JSON export files into the OKR Framework.

## Overview

The import system supports importing:
- **Users** - User accounts and profiles
- **Teams** - Team structures
- **Time Periods** - OKR cycles (quarters, annual periods)
- **Tags** - OKR tags
- **Objectives & Key Results** - Complete OKR hierarchy
- **Comments** - Comments on OKRs
- **Check-ins** - Historical check-in data

## Prerequisites

1. **Database Setup**: Ensure your database is running and migrations are applied
2. **JSON Export Files**: Place your Viva Goals JSON export files in the `import/` directory (or specify a custom directory)

## Required JSON Files

The import script looks for files with these naming patterns (case-insensitive):
- `*users*.json` - Users export
- `*teams*.json` - Teams export
- `*timeperiods*.json` - Time periods export
- `*tags*.json` - Tags export
- `*objectives*.json` - Objectives and Key Results export
- `*comments*.json` - Comments export
- `*checkins*.json` - Check-ins export

## Usage

### Basic Import

```bash
npm run import:viva-goals -- --tenant=<tenant-slug>
```

### With Custom Import Directory

```bash
npm run import:viva-goals -- --tenant=<tenant-slug> --import-dir=./path/to/json/files
```

### Dry Run (Preview Without Writing)

```bash
npm run import:viva-goals -- --tenant=<tenant-slug> --dry-run
```

### With Specific User ID

```bash
npm run import:viva-goals -- --tenant=<tenant-slug> --user-id=<user-id>
```

## Arguments

- `--tenant=<slug>` (required) - The tenant/organization slug to import into
- `--import-dir=<path>` (optional) - Directory containing JSON files (default: `./import`)
- `--user-id=<id>` (optional) - User ID to use as importer (will create import user if not provided)
- `--dry-run` (optional) - Preview import without writing to database

## Import Process

The import runs in the following order:

1. **Users** - Creates/updates user accounts
2. **Teams** - Creates teams (requires a default workspace)
3. **Time Periods** - Creates OKR cycles
4. **Tags** - Imports tags (if Tag model exists)
5. **Objectives & Key Results** - Imports complete OKR hierarchy with parent-child relationships
6. **Comments** - Imports comments (if Comment/Activity model supports it)
7. **Check-ins** - Imports historical check-in data

## Data Mapping

### Users
- Maps Viva Goals users to User model
- Skips "Group" type accounts
- Uses email as unique identifier

### Teams
- Creates teams in a default workspace
- Maps team names directly

### Time Periods → Cycles
- Maps time period names to Cycle names
- Sets status to `ARCHIVED` for imported cycles
- Preserves start and end dates

### Objectives & Key Results
- Preserves external IDs for deduplication
- Maintains parent-child relationships
- Maps status values (On Track, At Risk, etc.)
- Converts weights from percentages to decimals
- Links Key Results to Objectives with weights

### Check-ins
- Links to Key Results by external ID
- Preserves check-in dates
- Maps current values and notes

## Error Handling

The import script:
- Continues processing even if individual items fail
- Collects all errors and warnings
- Displays a summary at the end
- Shows first 10 errors/warnings in detail

## Limitations

1. **Tags**: Tag import is a placeholder - adjust based on your Tag model schema
2. **Comments**: Comment import depends on your Activity/Comment model structure
3. **Tenant Isolation**: All imports are scoped to the specified tenant
4. **Deduplication**: Uses `externalId` + `source` for deduplication (updates existing records)

## Troubleshooting

### "Tenant not found"
- The tenant will be created automatically if it doesn't exist
- Ensure you're using the correct tenant slug

### "User not found" errors
- Users are created automatically during import
- Check that user emails are valid

### "Parent objective not found"
- Objectives are imported in topological order (parents before children)
- If errors occur, check the objectives JSON for missing parent references

### Database connection errors
- Ensure `DATABASE_URL` is set in your environment
- Check that the database is running and accessible

## Example Output

```
🚀 Starting Viva Goals JSON Import
   Tenant: puzzel
   Import Directory: ./import
   Dry Run: NO

✅ Tenant: Puzzel (clx123...)
✅ Import User: clx456...

📥 Step 1: Importing Users...
   ✅ Users: 150 created, 0 updated

📥 Step 2: Importing Teams...
   ✅ Teams: 12 created, 0 updated

📥 Step 3: Importing Time Periods (Cycles)...
   ✅ Cycles: 8 created, 0 updated

📥 Step 4: Importing Tags...
   ✅ Tags: 25 created

📥 Step 5: Importing Objectives & Key Results...
   ✅ Objectives: 45 created, 0 updated
   ✅ Key Results: 120 created, 0 updated

📥 Step 6: Importing Comments...
   ✅ Comments: 230 created

📥 Step 7: Importing Check-ins...
   ✅ Check-ins: 450 created

📊 Import Summary
═══════════════════════════════════════
Users:        150 created, 0 updated
Teams:        12 created, 0 updated
Cycles:       8 created, 0 updated
Tags:         25 created
Objectives:   45 created, 0 updated
Key Results:  120 created, 0 updated
Comments:     230 created
Check-ins:    450 created

✅ Import completed!
```

## API Import (Alternative)

You can also import via the API endpoint (if implemented):

```bash
POST /okr/import/json
Content-Type: application/json

{
  "jsonContent": "...",
  "tenantId": "..."
}
```

## Next Steps

After importing:
1. Review imported data in the UI
2. Verify OKR hierarchies are correct
3. Check that users have appropriate access
4. Update any missing relationships manually if needed

