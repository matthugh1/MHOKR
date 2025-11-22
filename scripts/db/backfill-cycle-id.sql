-- Backfill cycleId for Key Results and Initiatives
-- Run this script after adding cycleId columns to key_results and initiatives tables

-- Backfill Key Results: Set cycleId from parent Objective via ObjectiveKeyResult junction table
UPDATE key_results kr
SET cycle_id = obj.cycle_id
FROM objective_key_results okr
JOIN objectives obj ON okr."objectiveId" = obj.id
WHERE okr."keyResultId" = kr.id
  AND kr.cycle_id IS NULL
  AND obj.cycle_id IS NOT NULL;

-- Backfill Initiatives: Set cycleId from parent Objective
UPDATE initiatives i
SET cycle_id = obj.cycle_id
FROM objectives obj
WHERE i."objectiveId" = obj.id
  AND i.cycle_id IS NULL
  AND obj.cycle_id IS NOT NULL;

-- For Initiatives linked to Key Results (not directly to Objective), get cycleId via KR's objective
UPDATE initiatives i
SET cycle_id = obj.cycle_id
FROM key_results kr
JOIN objective_key_results okr ON okr."keyResultId" = kr.id
JOIN objectives obj ON okr."objectiveId" = obj.id
WHERE i."keyResultId" = kr.id
  AND i.cycle_id IS NULL
  AND i."objectiveId" IS NULL
  AND obj.cycle_id IS NOT NULL;

-- Summary
SELECT 
  'Key Results with cycleId' as type,
  COUNT(*) as count
FROM key_results
WHERE cycle_id IS NOT NULL
UNION ALL
SELECT 
  'Initiatives with cycleId' as type,
  COUNT(*) as count
FROM initiatives
WHERE cycle_id IS NOT NULL;

