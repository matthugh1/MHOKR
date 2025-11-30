-- AlterTable (with IF NOT EXISTS check using dynamic SQL)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cycles') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cycles' AND column_name = 'isStandard') THEN
            EXECUTE 'ALTER TABLE "cycles" ADD COLUMN "isStandard" BOOLEAN NOT NULL DEFAULT false';
        END IF;
    END IF;
END $$;

-- CreateIndex (with IF NOT EXISTS - only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cycles') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'cycles_isStandard_idx') THEN
            EXECUTE 'CREATE INDEX "cycles_isStandard_idx" ON "cycles"("isStandard")';
        END IF;
    END IF;
END $$;







