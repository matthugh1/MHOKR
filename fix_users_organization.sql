-- Script to add existing users to an organization
-- Run this to fix users who aren't part of any organization

-- Step 1: Find the organization (you may need to adjust this)
-- Replace 'acme-corp' with your organization slug if different
DO $$
DECLARE
    org_id TEXT;
    user_record RECORD;
    org_member_count INTEGER;
BEGIN
    -- Get the first organization (or specific one by slug)
    SELECT id INTO org_id FROM organizations WHERE slug = 'acme-corp' LIMIT 1;
    
    -- If no organization exists, create one
    IF org_id IS NULL THEN
        INSERT INTO organizations (id, name, slug, created_at, updated_at)
        VALUES (
            gen_random_uuid()::text,
            'Default Organization',
            'default-org',
            NOW(),
            NOW()
        )
        RETURNING id INTO org_id;
        RAISE NOTICE 'Created default organization: %', org_id;
    END IF;
    
    RAISE NOTICE 'Using organization: %', org_id;
    
    -- Add all users who aren't already in an organization
    FOR user_record IN 
        SELECT u.id, u.email, u.name
        FROM users u
        WHERE NOT EXISTS (
            SELECT 1 FROM organization_members om WHERE om.user_id = u.id
        )
    LOOP
        -- Check if this is the first user (make them ORG_ADMIN)
        SELECT COUNT(*) INTO org_member_count FROM organization_members WHERE organization_id = org_id;
        
        IF org_member_count = 0 THEN
            -- First user becomes ORG_ADMIN
            INSERT INTO organization_members (id, user_id, organization_id, role, created_at, updated_at)
            VALUES (
                gen_random_uuid()::text,
                user_record.id,
                org_id,
                'ORG_ADMIN',
                NOW(),
                NOW()
            );
            RAISE NOTICE 'Added % (%) as ORG_ADMIN', user_record.email, user_record.name;
        ELSE
            -- Other users become MEMBER
            INSERT INTO organization_members (id, user_id, organization_id, role, created_at, updated_at)
            VALUES (
                gen_random_uuid()::text,
                user_record.id,
                org_id,
                'MEMBER',
                NOW(),
                NOW()
            );
            RAISE NOTICE 'Added % (%) as MEMBER', user_record.email, user_record.name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Done! All users are now part of the organization.';
END $$;

-- Verify the results
SELECT 
    u.email,
    u.name,
    om.role,
    o.name as organization_name
FROM users u
LEFT JOIN organization_members om ON u.id = om.user_id
LEFT JOIN organizations o ON om.organization_id = o.id
ORDER BY u.created_at;




