-- Migration: Add REMINDER_SENT to ActivityAction enum

-- Add REMINDER_SENT to ActivityAction enum
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'REMINDER_SENT';

