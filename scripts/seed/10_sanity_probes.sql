-- Sanity Probes SQL
-- Quick SQL queries to validate seed data

-- Count users by role
SELECT 
  ra.role,
  ra.scope_type,
  COUNT(DISTINCT ra.user_id) as user_count
FROM role_assignments ra
JOIN users u ON u.id = ra.user_id
WHERE u.email LIKE '%@puzzelcx.local'
GROUP BY ra.role, ra.scope_type
ORDER BY ra.scope_type, ra.role;

-- Count OKRs/KRs/initiatives per level
SELECT 
  CASE 
    WHEN o.organization_id IS NOT NULL AND o.workspace_id IS NULL AND o.team_id IS NULL THEN 'tenant'
    WHEN o.workspace_id IS NOT NULL AND o.team_id IS NULL THEN 'workspace'
    WHEN o.team_id IS NOT NULL THEN 'team'
    ELSE 'unknown'
  END as level,
  COUNT(DISTINCT o.id) as objectives,
  COUNT(DISTINCT kr.id) as key_results,
  COUNT(DISTINCT i.id) as initiatives
FROM objectives o
LEFT JOIN objective_key_results okr ON okr.objective_id = o.id
LEFT JOIN key_results kr ON kr.id = okr.key_result_id
LEFT JOIN initiatives i ON i.objective_id = o.id
JOIN organizations org ON org.id = o.organization_id
WHERE org.slug = 'puzzel-cx-demo'
GROUP BY level
ORDER BY level;

-- Overdue KR ratio
SELECT 
  COUNT(DISTINCT kr.id) as total_krs,
  COUNT(DISTINCT CASE 
    WHEN kr.check_in_cadence = 'WEEKLY' AND ci.created_at < NOW() - INTERVAL '7 days' THEN kr.id
    WHEN kr.check_in_cadence = 'BIWEEKLY' AND ci.created_at < NOW() - INTERVAL '14 days' THEN kr.id
    WHEN kr.check_in_cadence = 'MONTHLY' AND ci.created_at < NOW() - INTERVAL '30 days' THEN kr.id
  END) as overdue_krs,
  ROUND(100.0 * COUNT(DISTINCT CASE 
    WHEN kr.check_in_cadence = 'WEEKLY' AND ci.created_at < NOW() - INTERVAL '7 days' THEN kr.id
    WHEN kr.check_in_cadence = 'BIWEEKLY' AND ci.created_at < NOW() - INTERVAL '14 days' THEN kr.id
    WHEN kr.check_in_cadence = 'MONTHLY' AND ci.created_at < NOW() - INTERVAL '30 days' THEN kr.id
  END) / NULLIF(COUNT(DISTINCT kr.id), 0), 2) as overdue_percentage
FROM key_results kr
JOIN objective_key_results okr ON okr.key_result_id = kr.id
JOIN objectives o ON o.id = okr.objective_id
JOIN organizations org ON org.id = o.organization_id
LEFT JOIN check_ins ci ON ci.key_result_id = kr.id
WHERE org.slug = 'puzzel-cx-demo'
  AND kr.check_in_cadence IS NOT NULL
  AND kr.check_in_cadence != 'NONE';

-- Number of PRIVATE objectives and whitelist coverage
SELECT 
  COUNT(DISTINCT o.id) as private_objectives,
  COUNT(DISTINCT u.id) as whitelisted_users,
  jsonb_array_length(COALESCE(org.exec_only_whitelist, '[]'::jsonb)) as whitelist_size
FROM objectives o
JOIN organizations org ON org.id = o.organization_id
LEFT JOIN users u ON u.id::text = ANY(SELECT jsonb_array_elements_text(org.exec_only_whitelist))
WHERE org.slug = 'puzzel-cx-demo'
  AND o.visibility_level = 'PRIVATE';

-- Cross-tenant leakage check (should be zero)
SELECT 
  COUNT(*) as cross_tenant_leakage
FROM objectives o1
JOIN objectives o2 ON o1.id = o2.id
WHERE o1.organization_id != o2.organization_id;

-- Cycle distribution
SELECT 
  c.name,
  c.status,
  COUNT(DISTINCT o.id) as objectives,
  COUNT(DISTINCT kr.id) as key_results
FROM cycles c
JOIN organizations org ON org.id = c.organization_id
LEFT JOIN objectives o ON o.cycle_id = c.id
LEFT JOIN objective_key_results okr ON okr.objective_id = o.id
LEFT JOIN key_results kr ON kr.id = okr.key_result_id
WHERE org.slug = 'puzzel-cx-demo'
GROUP BY c.id, c.name, c.status
ORDER BY c.start_date;

