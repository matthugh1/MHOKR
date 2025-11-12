-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('SUPERUSER', 'ORG_ADMIN', 'WORKSPACE_OWNER', 'TEAM_LEAD', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Period" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OKRStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('INCREASE', 'DECREASE', 'REACH', 'MAINTAIN');

-- CreateEnum
CREATE TYPE "InitiativeStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CheckInCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'NONE');

-- CreateEnum
CREATE TYPE "VisibilityLevel" AS ENUM ('PUBLIC_TENANT', 'WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RBACRole" AS ENUM ('SUPERUSER', 'TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_VIEWER', 'WORKSPACE_LEAD', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'TEAM_LEAD', 'TEAM_CONTRIBUTOR', 'TEAM_VIEWER');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('PLATFORM', 'TENANT', 'WORKSPACE', 'TEAM');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('USER', 'ROLE_ASSIGNMENT', 'OKR', 'WORKSPACE', 'TEAM', 'TENANT', 'VISIBILITY_CHANGE');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('OBJECTIVE', 'KEY_RESULT', 'INITIATIVE', 'CHECK_IN');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'COMPLETED', 'ALIGNED', 'COMMENTED');

-- CreateEnum
CREATE TYPE "AIPersona" AS ENUM ('OKR_COACH', 'CASCADE_ASSISTANT', 'PROGRESS_ANALYST');

-- CreateEnum
CREATE TYPE "IntegrationSource" AS ENUM ('JIRA', 'GITHUB', 'SALESFORCE', 'CUSTOM_WEBHOOK');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "allowTenantAdminExecVisibility" BOOLEAN NOT NULL DEFAULT false,
    "execOnlyWhitelist" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentWorkspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "keycloakId" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "avatar" TEXT,
    "isSuperuser" BOOLEAN NOT NULL DEFAULT false,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_audits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousRole" "MemberRole",
    "newRole" "MemberRole",
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategic_pillars" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategic_pillars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT,
    "workspaceId" TEXT,
    "teamId" TEXT,
    "ownerId" TEXT NOT NULL,
    "parentId" TEXT,
    "period" "Period" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "OKRStatus" NOT NULL DEFAULT 'ON_TRACK',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "visibilityLevel" "VisibilityLevel" NOT NULL DEFAULT 'PUBLIC_TENANT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pillarId" TEXT,
    "cycleId" TEXT,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_results" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "startValue" DOUBLE PRECISION NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "status" "OKRStatus" NOT NULL DEFAULT 'ON_TRACK',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "visibilityLevel" "VisibilityLevel" NOT NULL DEFAULT 'PUBLIC_TENANT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "period" "Period",
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "checkInCadence" "CheckInCadence",

    CONSTRAINT "key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objective_key_results" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objective_key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiatives" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "keyResultId" TEXT,
    "objectiveId" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "InitiativeStatus" NOT NULL,
    "period" "Period",
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RBACRole" NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "scopeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" "AuditTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "previousRole" "RBACRole",
    "newRole" "RBACRole",
    "impersonatedUserId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "confidence" INTEGER NOT NULL,
    "note" TEXT,
    "blockers" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "persona" "AIPersona" NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kr_integrations" (
    "id" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "source" "IntegrationSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "lastSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kr_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_layouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_event_entity" (
    "id" VARCHAR(36) NOT NULL,
    "admin_event_time" BIGINT,
    "realm_id" VARCHAR(255),
    "operation_type" VARCHAR(255),
    "auth_realm_id" VARCHAR(255),
    "auth_client_id" VARCHAR(255),
    "auth_user_id" VARCHAR(255),
    "ip_address" VARCHAR(255),
    "resource_path" VARCHAR(2550),
    "representation" TEXT,
    "error" VARCHAR(255),
    "resource_type" VARCHAR(64),

    CONSTRAINT "constraint_admin_event_entity" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "associated_policy" (
    "policy_id" VARCHAR(36) NOT NULL,
    "associated_policy_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_farsrpap" PRIMARY KEY ("policy_id","associated_policy_id")
);

-- CreateTable
CREATE TABLE "authentication_execution" (
    "id" VARCHAR(36) NOT NULL,
    "alias" VARCHAR(255),
    "authenticator" VARCHAR(36),
    "realm_id" VARCHAR(36),
    "flow_id" VARCHAR(36),
    "requirement" INTEGER,
    "priority" INTEGER,
    "authenticator_flow" BOOLEAN NOT NULL DEFAULT false,
    "auth_flow_id" VARCHAR(36),
    "auth_config" VARCHAR(36),

    CONSTRAINT "constraint_auth_exec_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authentication_flow" (
    "id" VARCHAR(36) NOT NULL,
    "alias" VARCHAR(255),
    "description" VARCHAR(255),
    "realm_id" VARCHAR(36),
    "provider_id" VARCHAR(36) NOT NULL DEFAULT 'basic-flow',
    "top_level" BOOLEAN NOT NULL DEFAULT false,
    "built_in" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "constraint_auth_flow_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authenticator_config" (
    "id" VARCHAR(36) NOT NULL,
    "alias" VARCHAR(255),
    "realm_id" VARCHAR(36),

    CONSTRAINT "constraint_auth_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authenticator_config_entry" (
    "authenticator_id" VARCHAR(36) NOT NULL,
    "value" TEXT,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_auth_cfg_pk" PRIMARY KEY ("authenticator_id","name")
);

-- CreateTable
CREATE TABLE "broker_link" (
    "identity_provider" VARCHAR(255) NOT NULL,
    "storage_provider_id" VARCHAR(255),
    "realm_id" VARCHAR(36) NOT NULL,
    "broker_user_id" VARCHAR(255),
    "broker_username" VARCHAR(255),
    "token" TEXT,
    "user_id" VARCHAR(255) NOT NULL,

    CONSTRAINT "constr_broker_link_pk" PRIMARY KEY ("identity_provider","user_id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" VARCHAR(36) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "full_scope_allowed" BOOLEAN NOT NULL DEFAULT false,
    "client_id" VARCHAR(255),
    "not_before" INTEGER,
    "public_client" BOOLEAN NOT NULL DEFAULT false,
    "secret" VARCHAR(255),
    "base_url" VARCHAR(255),
    "bearer_only" BOOLEAN NOT NULL DEFAULT false,
    "management_url" VARCHAR(255),
    "surrogate_auth_required" BOOLEAN NOT NULL DEFAULT false,
    "realm_id" VARCHAR(36),
    "protocol" VARCHAR(255),
    "node_rereg_timeout" INTEGER DEFAULT 0,
    "frontchannel_logout" BOOLEAN NOT NULL DEFAULT false,
    "consent_required" BOOLEAN NOT NULL DEFAULT false,
    "name" VARCHAR(255),
    "service_accounts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "client_authenticator_type" VARCHAR(255),
    "root_url" VARCHAR(255),
    "description" VARCHAR(255),
    "registration_token" VARCHAR(255),
    "standard_flow_enabled" BOOLEAN NOT NULL DEFAULT true,
    "implicit_flow_enabled" BOOLEAN NOT NULL DEFAULT false,
    "direct_access_grants_enabled" BOOLEAN NOT NULL DEFAULT false,
    "always_display_in_console" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "constraint_7" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_attributes" (
    "client_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "value" TEXT,

    CONSTRAINT "constraint_3c" PRIMARY KEY ("client_id","name")
);

-- CreateTable
CREATE TABLE "client_auth_flow_bindings" (
    "client_id" VARCHAR(36) NOT NULL,
    "flow_id" VARCHAR(36),
    "binding_name" VARCHAR(255) NOT NULL,

    CONSTRAINT "c_cli_flow_bind" PRIMARY KEY ("client_id","binding_name")
);

-- CreateTable
CREATE TABLE "client_initial_access" (
    "id" VARCHAR(36) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,
    "timestamp" INTEGER,
    "expiration" INTEGER,
    "count" INTEGER,
    "remaining_count" INTEGER,

    CONSTRAINT "cnstr_client_init_acc_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_node_registrations" (
    "client_id" VARCHAR(36) NOT NULL,
    "value" INTEGER,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_84" PRIMARY KEY ("client_id","name")
);

-- CreateTable
CREATE TABLE "client_scope" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255),
    "realm_id" VARCHAR(36),
    "description" VARCHAR(255),
    "protocol" VARCHAR(255),

    CONSTRAINT "pk_cli_template" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_scope_attributes" (
    "scope_id" VARCHAR(36) NOT NULL,
    "value" VARCHAR(2048),
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "pk_cl_tmpl_attr" PRIMARY KEY ("scope_id","name")
);

-- CreateTable
CREATE TABLE "client_scope_client" (
    "client_id" VARCHAR(255) NOT NULL,
    "scope_id" VARCHAR(255) NOT NULL,
    "default_scope" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "c_cli_scope_bind" PRIMARY KEY ("client_id","scope_id")
);

-- CreateTable
CREATE TABLE "client_scope_role_mapping" (
    "scope_id" VARCHAR(36) NOT NULL,
    "role_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "pk_template_scope" PRIMARY KEY ("scope_id","role_id")
);

-- CreateTable
CREATE TABLE "client_session" (
    "id" VARCHAR(36) NOT NULL,
    "client_id" VARCHAR(36),
    "redirect_uri" VARCHAR(255),
    "state" VARCHAR(255),
    "timestamp" INTEGER,
    "session_id" VARCHAR(36),
    "auth_method" VARCHAR(255),
    "realm_id" VARCHAR(255),
    "auth_user_id" VARCHAR(36),
    "current_action" VARCHAR(36),

    CONSTRAINT "constraint_8" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_session_auth_status" (
    "authenticator" VARCHAR(36) NOT NULL,
    "status" INTEGER,
    "client_session" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_auth_status_pk" PRIMARY KEY ("client_session","authenticator")
);

-- CreateTable
CREATE TABLE "client_session_note" (
    "name" VARCHAR(255) NOT NULL,
    "value" VARCHAR(255),
    "client_session" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_5e" PRIMARY KEY ("client_session","name")
);

-- CreateTable
CREATE TABLE "client_session_prot_mapper" (
    "protocol_mapper_id" VARCHAR(36) NOT NULL,
    "client_session" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_cs_pmp_pk" PRIMARY KEY ("client_session","protocol_mapper_id")
);

-- CreateTable
CREATE TABLE "client_session_role" (
    "role_id" VARCHAR(255) NOT NULL,
    "client_session" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_5" PRIMARY KEY ("client_session","role_id")
);

-- CreateTable
CREATE TABLE "client_user_session_note" (
    "name" VARCHAR(255) NOT NULL,
    "value" VARCHAR(2048),
    "client_session" VARCHAR(36) NOT NULL,

    CONSTRAINT "constr_cl_usr_ses_note" PRIMARY KEY ("client_session","name")
);

-- CreateTable
CREATE TABLE "component" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255),
    "parent_id" VARCHAR(36),
    "provider_id" VARCHAR(36),
    "provider_type" VARCHAR(255),
    "realm_id" VARCHAR(36),
    "sub_type" VARCHAR(255),

    CONSTRAINT "constr_component_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_config" (
    "id" VARCHAR(36) NOT NULL,
    "component_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "value" TEXT,

    CONSTRAINT "constr_component_config_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "composite_role" (
    "composite" VARCHAR(36) NOT NULL,
    "child_role" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_composite_role" PRIMARY KEY ("composite","child_role")
);

-- CreateTable
CREATE TABLE "credential" (
    "id" VARCHAR(36) NOT NULL,
    "salt" BYTEA,
    "type" VARCHAR(255),
    "user_id" VARCHAR(36),
    "created_date" BIGINT,
    "user_label" VARCHAR(255),
    "secret_data" TEXT,
    "credential_data" TEXT,
    "priority" INTEGER,

    CONSTRAINT "constraint_f" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "databasechangelog" (
    "id" VARCHAR(255) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "dateexecuted" TIMESTAMP(6) NOT NULL,
    "orderexecuted" INTEGER NOT NULL,
    "exectype" VARCHAR(10) NOT NULL,
    "md5sum" VARCHAR(35),
    "description" VARCHAR(255),
    "comments" VARCHAR(255),
    "tag" VARCHAR(255),
    "liquibase" VARCHAR(20),
    "contexts" VARCHAR(255),
    "labels" VARCHAR(255),
    "deployment_id" VARCHAR(10)
);

-- CreateTable
CREATE TABLE "databasechangeloglock" (
    "id" INTEGER NOT NULL,
    "locked" BOOLEAN NOT NULL,
    "lockgranted" TIMESTAMP(6),
    "lockedby" VARCHAR(255),

    CONSTRAINT "databasechangeloglock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "default_client_scope" (
    "realm_id" VARCHAR(36) NOT NULL,
    "scope_id" VARCHAR(36) NOT NULL,
    "default_scope" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "r_def_cli_scope_bind" PRIMARY KEY ("realm_id","scope_id")
);

-- CreateTable
CREATE TABLE "event_entity" (
    "id" VARCHAR(36) NOT NULL,
    "client_id" VARCHAR(255),
    "details_json" VARCHAR(2550),
    "error" VARCHAR(255),
    "ip_address" VARCHAR(255),
    "realm_id" VARCHAR(255),
    "session_id" VARCHAR(255),
    "event_time" BIGINT,
    "type" VARCHAR(255),
    "user_id" VARCHAR(255),
    "details_json_long_value" TEXT,

    CONSTRAINT "constraint_4" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fed_user_attribute" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,
    "storage_provider_id" VARCHAR(36),
    "value" VARCHAR(2024),

    CONSTRAINT "constr_fed_user_attr_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fed_user_consent" (
    "id" VARCHAR(36) NOT NULL,
    "client_id" VARCHAR(255),
    "user_id" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,
    "storage_provider_id" VARCHAR(36),
    "created_date" BIGINT,
    "last_updated_date" BIGINT,
    "client_storage_provider" VARCHAR(36),
    "external_client_id" VARCHAR(255),

    CONSTRAINT "constr_fed_user_consent_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fed_user_consent_cl_scope" (
    "user_consent_id" VARCHAR(36) NOT NULL,
    "scope_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_fgrntcsnt_clsc_pm" PRIMARY KEY ("user_consent_id","scope_id")
);

-- CreateTable
CREATE TABLE "fed_user_credential" (
    "id" VARCHAR(36) NOT NULL,
    "salt" BYTEA,
    "type" VARCHAR(255),
    "created_date" BIGINT,
    "user_id" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,
    "storage_provider_id" VARCHAR(36),
    "user_label" VARCHAR(255),
    "secret_data" TEXT,
    "credential_data" TEXT,
    "priority" INTEGER,

    CONSTRAINT "constr_fed_user_cred_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fed_user_group_membership" (
    "group_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,
    "storage_provider_id" VARCHAR(36),

    CONSTRAINT "constr_fed_user_group" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "fed_user_required_action" (
    "required_action" VARCHAR(255) NOT NULL DEFAULT ' ',
    "user_id" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,
    "storage_provider_id" VARCHAR(36),

    CONSTRAINT "constr_fed_required_action" PRIMARY KEY ("required_action","user_id")
);

-- CreateTable
CREATE TABLE "fed_user_role_mapping" (
    "role_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,
    "storage_provider_id" VARCHAR(36),

    CONSTRAINT "constr_fed_user_role" PRIMARY KEY ("role_id","user_id")
);

-- CreateTable
CREATE TABLE "federated_identity" (
    "identity_provider" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36),
    "federated_user_id" VARCHAR(255),
    "federated_username" VARCHAR(255),
    "token" TEXT,
    "user_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_40" PRIMARY KEY ("identity_provider","user_id")
);

-- CreateTable
CREATE TABLE "federated_user" (
    "id" VARCHAR(255) NOT NULL,
    "storage_provider_id" VARCHAR(255),
    "realm_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constr_federated_user" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_attribute" (
    "id" VARCHAR(36) NOT NULL DEFAULT 'sybase-needs-something-here',
    "name" VARCHAR(255) NOT NULL,
    "value" VARCHAR(255),
    "group_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_group_attribute_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_role_mapping" (
    "role_id" VARCHAR(36) NOT NULL,
    "group_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_group_role" PRIMARY KEY ("role_id","group_id")
);

-- CreateTable
CREATE TABLE "identity_provider" (
    "internal_id" VARCHAR(36) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider_alias" VARCHAR(255),
    "provider_id" VARCHAR(255),
    "store_token" BOOLEAN NOT NULL DEFAULT false,
    "authenticate_by_default" BOOLEAN NOT NULL DEFAULT false,
    "realm_id" VARCHAR(36),
    "add_token_role" BOOLEAN NOT NULL DEFAULT true,
    "trust_email" BOOLEAN NOT NULL DEFAULT false,
    "first_broker_login_flow_id" VARCHAR(36),
    "post_broker_login_flow_id" VARCHAR(36),
    "provider_display_name" VARCHAR(255),
    "link_only" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "constraint_2b" PRIMARY KEY ("internal_id")
);

-- CreateTable
CREATE TABLE "identity_provider_config" (
    "identity_provider_id" VARCHAR(36) NOT NULL,
    "value" TEXT,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_d" PRIMARY KEY ("identity_provider_id","name")
);

-- CreateTable
CREATE TABLE "identity_provider_mapper" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "idp_alias" VARCHAR(255) NOT NULL,
    "idp_mapper_name" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_idpm" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idp_mapper_config" (
    "idp_mapper_id" VARCHAR(36) NOT NULL,
    "value" TEXT,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_idpmconfig" PRIMARY KEY ("idp_mapper_id","name")
);

-- CreateTable
CREATE TABLE "keycloak_group" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255),
    "parent_group" VARCHAR(36) NOT NULL,
    "realm_id" VARCHAR(36),

    CONSTRAINT "constraint_group" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keycloak_role" (
    "id" VARCHAR(36) NOT NULL,
    "client_realm_constraint" VARCHAR(255),
    "client_role" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(255),
    "name" VARCHAR(255),
    "realm_id" VARCHAR(255),
    "client" VARCHAR(36),
    "realm" VARCHAR(36),

    CONSTRAINT "constraint_a" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_model" (
    "id" VARCHAR(36) NOT NULL,
    "version" VARCHAR(36),
    "update_time" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "constraint_migmod" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_client_session" (
    "user_session_id" VARCHAR(36) NOT NULL,
    "client_id" VARCHAR(255) NOT NULL,
    "offline_flag" VARCHAR(4) NOT NULL,
    "timestamp" INTEGER,
    "data" TEXT,
    "client_storage_provider" VARCHAR(36) NOT NULL DEFAULT 'local',
    "external_client_id" VARCHAR(255) NOT NULL DEFAULT 'local',

    CONSTRAINT "constraint_offl_cl_ses_pk3" PRIMARY KEY ("user_session_id","client_id","client_storage_provider","external_client_id","offline_flag")
);

-- CreateTable
CREATE TABLE "offline_user_session" (
    "user_session_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,
    "created_on" INTEGER NOT NULL,
    "offline_flag" VARCHAR(4) NOT NULL,
    "data" TEXT,
    "last_session_refresh" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "constraint_offl_us_ses_pk2" PRIMARY KEY ("user_session_id","offline_flag")
);

-- CreateTable
CREATE TABLE "policy_config" (
    "policy_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "value" TEXT,

    CONSTRAINT "constraint_dpc" PRIMARY KEY ("policy_id","name")
);

-- CreateTable
CREATE TABLE "protocol_mapper" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "protocol" VARCHAR(255) NOT NULL,
    "protocol_mapper_name" VARCHAR(255) NOT NULL,
    "client_id" VARCHAR(36),
    "client_scope_id" VARCHAR(36),

    CONSTRAINT "constraint_pcm" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_mapper_config" (
    "protocol_mapper_id" VARCHAR(36) NOT NULL,
    "value" TEXT,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_pmconfig" PRIMARY KEY ("protocol_mapper_id","name")
);

-- CreateTable
CREATE TABLE "realm" (
    "id" VARCHAR(36) NOT NULL,
    "access_code_lifespan" INTEGER,
    "user_action_lifespan" INTEGER,
    "access_token_lifespan" INTEGER,
    "account_theme" VARCHAR(255),
    "admin_theme" VARCHAR(255),
    "email_theme" VARCHAR(255),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "events_enabled" BOOLEAN NOT NULL DEFAULT false,
    "events_expiration" BIGINT,
    "login_theme" VARCHAR(255),
    "name" VARCHAR(255),
    "not_before" INTEGER,
    "password_policy" VARCHAR(2550),
    "registration_allowed" BOOLEAN NOT NULL DEFAULT false,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "reset_password_allowed" BOOLEAN NOT NULL DEFAULT false,
    "social" BOOLEAN NOT NULL DEFAULT false,
    "ssl_required" VARCHAR(255),
    "sso_idle_timeout" INTEGER,
    "sso_max_lifespan" INTEGER,
    "update_profile_on_soc_login" BOOLEAN NOT NULL DEFAULT false,
    "verify_email" BOOLEAN NOT NULL DEFAULT false,
    "master_admin_client" VARCHAR(36),
    "login_lifespan" INTEGER,
    "internationalization_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_locale" VARCHAR(255),
    "reg_email_as_username" BOOLEAN NOT NULL DEFAULT false,
    "admin_events_enabled" BOOLEAN NOT NULL DEFAULT false,
    "admin_events_details_enabled" BOOLEAN NOT NULL DEFAULT false,
    "edit_username_allowed" BOOLEAN NOT NULL DEFAULT false,
    "otp_policy_counter" INTEGER DEFAULT 0,
    "otp_policy_window" INTEGER DEFAULT 1,
    "otp_policy_period" INTEGER DEFAULT 30,
    "otp_policy_digits" INTEGER DEFAULT 6,
    "otp_policy_alg" VARCHAR(36) DEFAULT 'HmacSHA1',
    "otp_policy_type" VARCHAR(36) DEFAULT 'totp',
    "browser_flow" VARCHAR(36),
    "registration_flow" VARCHAR(36),
    "direct_grant_flow" VARCHAR(36),
    "reset_credentials_flow" VARCHAR(36),
    "client_auth_flow" VARCHAR(36),
    "offline_session_idle_timeout" INTEGER DEFAULT 0,
    "revoke_refresh_token" BOOLEAN NOT NULL DEFAULT false,
    "access_token_life_implicit" INTEGER DEFAULT 0,
    "login_with_email_allowed" BOOLEAN NOT NULL DEFAULT true,
    "duplicate_emails_allowed" BOOLEAN NOT NULL DEFAULT false,
    "docker_auth_flow" VARCHAR(36),
    "refresh_token_max_reuse" INTEGER DEFAULT 0,
    "allow_user_managed_access" BOOLEAN NOT NULL DEFAULT false,
    "sso_max_lifespan_remember_me" INTEGER NOT NULL DEFAULT 0,
    "sso_idle_timeout_remember_me" INTEGER NOT NULL DEFAULT 0,
    "default_role" VARCHAR(255),

    CONSTRAINT "constraint_4a" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realm_attribute" (
    "name" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,
    "value" TEXT,

    CONSTRAINT "constraint_9" PRIMARY KEY ("name","realm_id")
);

-- CreateTable
CREATE TABLE "realm_default_groups" (
    "realm_id" VARCHAR(36) NOT NULL,
    "group_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constr_realm_default_groups" PRIMARY KEY ("realm_id","group_id")
);

-- CreateTable
CREATE TABLE "realm_enabled_event_types" (
    "realm_id" VARCHAR(36) NOT NULL,
    "value" VARCHAR(255) NOT NULL,

    CONSTRAINT "constr_realm_enabl_event_types" PRIMARY KEY ("realm_id","value")
);

-- CreateTable
CREATE TABLE "realm_events_listeners" (
    "realm_id" VARCHAR(36) NOT NULL,
    "value" VARCHAR(255) NOT NULL,

    CONSTRAINT "constr_realm_events_listeners" PRIMARY KEY ("realm_id","value")
);

-- CreateTable
CREATE TABLE "realm_localizations" (
    "realm_id" VARCHAR(255) NOT NULL,
    "locale" VARCHAR(255) NOT NULL,
    "texts" TEXT NOT NULL,

    CONSTRAINT "realm_localizations_pkey" PRIMARY KEY ("realm_id","locale")
);

-- CreateTable
CREATE TABLE "realm_required_credential" (
    "type" VARCHAR(255) NOT NULL,
    "form_label" VARCHAR(255),
    "input" BOOLEAN NOT NULL DEFAULT false,
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "realm_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_92" PRIMARY KEY ("realm_id","type")
);

-- CreateTable
CREATE TABLE "realm_smtp_config" (
    "realm_id" VARCHAR(36) NOT NULL,
    "value" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_e" PRIMARY KEY ("realm_id","name")
);

-- CreateTable
CREATE TABLE "realm_supported_locales" (
    "realm_id" VARCHAR(36) NOT NULL,
    "value" VARCHAR(255) NOT NULL,

    CONSTRAINT "constr_realm_supported_locales" PRIMARY KEY ("realm_id","value")
);

-- CreateTable
CREATE TABLE "redirect_uris" (
    "client_id" VARCHAR(36) NOT NULL,
    "value" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_redirect_uris" PRIMARY KEY ("client_id","value")
);

-- CreateTable
CREATE TABLE "required_action_config" (
    "required_action_id" VARCHAR(36) NOT NULL,
    "value" TEXT,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_req_act_cfg_pk" PRIMARY KEY ("required_action_id","name")
);

-- CreateTable
CREATE TABLE "required_action_provider" (
    "id" VARCHAR(36) NOT NULL,
    "alias" VARCHAR(255),
    "name" VARCHAR(255),
    "realm_id" VARCHAR(36),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_action" BOOLEAN NOT NULL DEFAULT false,
    "provider_id" VARCHAR(255),
    "priority" INTEGER,

    CONSTRAINT "constraint_req_act_prv_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_attribute" (
    "id" VARCHAR(36) NOT NULL DEFAULT 'sybase-needs-something-here',
    "name" VARCHAR(255) NOT NULL,
    "value" VARCHAR(255),
    "resource_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "res_attr_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_policy" (
    "resource_id" VARCHAR(36) NOT NULL,
    "policy_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_farsrpp" PRIMARY KEY ("resource_id","policy_id")
);

-- CreateTable
CREATE TABLE "resource_scope" (
    "resource_id" VARCHAR(36) NOT NULL,
    "scope_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_farsrsp" PRIMARY KEY ("resource_id","scope_id")
);

-- CreateTable
CREATE TABLE "resource_server" (
    "id" VARCHAR(36) NOT NULL,
    "allow_rs_remote_mgmt" BOOLEAN NOT NULL DEFAULT false,
    "policy_enforce_mode" SMALLINT NOT NULL,
    "decision_strategy" SMALLINT NOT NULL DEFAULT 1,

    CONSTRAINT "pk_resource_server" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_server_perm_ticket" (
    "id" VARCHAR(36) NOT NULL,
    "owner" VARCHAR(255) NOT NULL,
    "requester" VARCHAR(255) NOT NULL,
    "created_timestamp" BIGINT NOT NULL,
    "granted_timestamp" BIGINT,
    "resource_id" VARCHAR(36) NOT NULL,
    "scope_id" VARCHAR(36),
    "resource_server_id" VARCHAR(36) NOT NULL,
    "policy_id" VARCHAR(36),

    CONSTRAINT "constraint_fapmt" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_server_policy" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "type" VARCHAR(255) NOT NULL,
    "decision_strategy" SMALLINT,
    "logic" SMALLINT,
    "resource_server_id" VARCHAR(36) NOT NULL,
    "owner" VARCHAR(255),

    CONSTRAINT "constraint_farsrp" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_server_resource" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(255),
    "icon_uri" VARCHAR(255),
    "owner" VARCHAR(255) NOT NULL,
    "resource_server_id" VARCHAR(36) NOT NULL,
    "owner_managed_access" BOOLEAN NOT NULL DEFAULT false,
    "display_name" VARCHAR(255),

    CONSTRAINT "constraint_farsr" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_server_scope" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "icon_uri" VARCHAR(255),
    "resource_server_id" VARCHAR(36) NOT NULL,
    "display_name" VARCHAR(255),

    CONSTRAINT "constraint_farsrs" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_uris" (
    "resource_id" VARCHAR(36) NOT NULL,
    "value" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_resour_uris_pk" PRIMARY KEY ("resource_id","value")
);

-- CreateTable
CREATE TABLE "role_attribute" (
    "id" VARCHAR(36) NOT NULL,
    "role_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "value" VARCHAR(255),

    CONSTRAINT "constraint_role_attribute_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_mapping" (
    "client_id" VARCHAR(36) NOT NULL,
    "role_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_81" PRIMARY KEY ("client_id","role_id")
);

-- CreateTable
CREATE TABLE "scope_policy" (
    "scope_id" VARCHAR(36) NOT NULL,
    "policy_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_farsrsps" PRIMARY KEY ("scope_id","policy_id")
);

-- CreateTable
CREATE TABLE "user_attribute" (
    "name" VARCHAR(255) NOT NULL,
    "value" VARCHAR(255),
    "user_id" VARCHAR(36) NOT NULL,
    "id" VARCHAR(36) NOT NULL DEFAULT 'sybase-needs-something-here',

    CONSTRAINT "constraint_user_attribute_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consent" (
    "id" VARCHAR(36) NOT NULL,
    "client_id" VARCHAR(255),
    "user_id" VARCHAR(36) NOT NULL,
    "created_date" BIGINT,
    "last_updated_date" BIGINT,
    "client_storage_provider" VARCHAR(36),
    "external_client_id" VARCHAR(255),

    CONSTRAINT "constraint_grntcsnt_pm" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consent_client_scope" (
    "user_consent_id" VARCHAR(36) NOT NULL,
    "scope_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_grntcsnt_clsc_pm" PRIMARY KEY ("user_consent_id","scope_id")
);

-- CreateTable
CREATE TABLE "user_entity" (
    "id" VARCHAR(36) NOT NULL,
    "email" VARCHAR(255),
    "email_constraint" VARCHAR(255),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "federation_link" VARCHAR(255),
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "realm_id" VARCHAR(255),
    "username" VARCHAR(255),
    "created_timestamp" BIGINT,
    "service_account_client_link" VARCHAR(255),
    "not_before" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "constraint_fb" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_federation_config" (
    "user_federation_provider_id" VARCHAR(36) NOT NULL,
    "value" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_f9" PRIMARY KEY ("user_federation_provider_id","name")
);

-- CreateTable
CREATE TABLE "user_federation_mapper" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "federation_provider_id" VARCHAR(36) NOT NULL,
    "federation_mapper_type" VARCHAR(255) NOT NULL,
    "realm_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_fedmapperpm" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_federation_mapper_config" (
    "user_federation_mapper_id" VARCHAR(36) NOT NULL,
    "value" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_fedmapper_cfg_pm" PRIMARY KEY ("user_federation_mapper_id","name")
);

-- CreateTable
CREATE TABLE "user_federation_provider" (
    "id" VARCHAR(36) NOT NULL,
    "changed_sync_period" INTEGER,
    "display_name" VARCHAR(255),
    "full_sync_period" INTEGER,
    "last_sync" INTEGER,
    "priority" INTEGER,
    "provider_name" VARCHAR(255),
    "realm_id" VARCHAR(36),

    CONSTRAINT "constraint_5c" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_membership" (
    "group_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_user_group" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "user_required_action" (
    "user_id" VARCHAR(36) NOT NULL,
    "required_action" VARCHAR(255) NOT NULL DEFAULT ' ',

    CONSTRAINT "constraint_required_action" PRIMARY KEY ("required_action","user_id")
);

-- CreateTable
CREATE TABLE "user_role_mapping" (
    "role_id" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,

    CONSTRAINT "constraint_c" PRIMARY KEY ("role_id","user_id")
);

-- CreateTable
CREATE TABLE "user_session" (
    "id" VARCHAR(36) NOT NULL,
    "auth_method" VARCHAR(255),
    "ip_address" VARCHAR(255),
    "last_session_refresh" INTEGER,
    "login_username" VARCHAR(255),
    "realm_id" VARCHAR(255),
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "started" INTEGER,
    "user_id" VARCHAR(255),
    "user_session_state" INTEGER,
    "broker_session_id" VARCHAR(255),
    "broker_user_id" VARCHAR(255),

    CONSTRAINT "constraint_57" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_session_note" (
    "user_session" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "value" VARCHAR(2048),

    CONSTRAINT "constraint_usn_pk" PRIMARY KEY ("user_session","name")
);

-- CreateTable
CREATE TABLE "username_login_failure" (
    "realm_id" VARCHAR(36) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "failed_login_not_before" INTEGER,
    "last_failure" BIGINT,
    "last_ip_failure" VARCHAR(255),
    "num_failures" INTEGER,

    CONSTRAINT "CONSTRAINT_17-2" PRIMARY KEY ("realm_id","username")
);

-- CreateTable
CREATE TABLE "web_origins" (
    "client_id" VARCHAR(36) NOT NULL,
    "value" VARCHAR(255) NOT NULL,

    CONSTRAINT "constraint_web_origins" PRIMARY KEY ("client_id","value")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "workspaces_organizationId_idx" ON "workspaces"("organizationId");

-- CreateIndex
CREATE INDEX "workspaces_parentWorkspaceId_idx" ON "workspaces"("parentWorkspaceId");

-- CreateIndex
CREATE INDEX "teams_workspaceId_idx" ON "teams"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_keycloakId_key" ON "users"("keycloakId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_keycloakId_idx" ON "users"("keycloakId");

-- CreateIndex
CREATE INDEX "users_isSuperuser_idx" ON "users"("isSuperuser");

-- CreateIndex
CREATE INDEX "users_managerId_idx" ON "users"("managerId");

-- CreateIndex
CREATE INDEX "team_members_userId_idx" ON "team_members"("userId");

-- CreateIndex
CREATE INDEX "team_members_teamId_idx" ON "team_members"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_userId_teamId_key" ON "team_members"("userId", "teamId");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- CreateIndex
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_userId_workspaceId_key" ON "workspace_members"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE INDEX "organization_members_organizationId_idx" ON "organization_members"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_userId_organizationId_key" ON "organization_members"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "permission_audits_userId_idx" ON "permission_audits"("userId");

-- CreateIndex
CREATE INDEX "permission_audits_entityType_entityId_idx" ON "permission_audits"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "permission_audits_performedBy_idx" ON "permission_audits"("performedBy");

-- CreateIndex
CREATE INDEX "strategic_pillars_organizationId_idx" ON "strategic_pillars"("organizationId");

-- CreateIndex
CREATE INDEX "cycles_organizationId_idx" ON "cycles"("organizationId");

-- CreateIndex
CREATE INDEX "cycles_status_idx" ON "cycles"("status");

-- CreateIndex
CREATE INDEX "objectives_organizationId_idx" ON "objectives"("organizationId");

-- CreateIndex
CREATE INDEX "objectives_workspaceId_idx" ON "objectives"("workspaceId");

-- CreateIndex
CREATE INDEX "objectives_teamId_idx" ON "objectives"("teamId");

-- CreateIndex
CREATE INDEX "objectives_ownerId_idx" ON "objectives"("ownerId");

-- CreateIndex
CREATE INDEX "objectives_parentId_idx" ON "objectives"("parentId");

-- CreateIndex
CREATE INDEX "objectives_pillarId_idx" ON "objectives"("pillarId");

-- CreateIndex
CREATE INDEX "objectives_cycleId_idx" ON "objectives"("cycleId");

-- CreateIndex
CREATE INDEX "objectives_visibilityLevel_idx" ON "objectives"("visibilityLevel");

-- CreateIndex
CREATE INDEX "objectives_isPublished_idx" ON "objectives"("isPublished");

-- CreateIndex
CREATE INDEX "key_results_ownerId_idx" ON "key_results"("ownerId");

-- CreateIndex
CREATE INDEX "key_results_visibilityLevel_idx" ON "key_results"("visibilityLevel");

-- CreateIndex
CREATE INDEX "key_results_isPublished_idx" ON "key_results"("isPublished");

-- CreateIndex
CREATE INDEX "objective_key_results_objectiveId_idx" ON "objective_key_results"("objectiveId");

-- CreateIndex
CREATE INDEX "objective_key_results_keyResultId_idx" ON "objective_key_results"("keyResultId");

-- CreateIndex
CREATE UNIQUE INDEX "objective_key_results_objectiveId_keyResultId_key" ON "objective_key_results"("objectiveId", "keyResultId");

-- CreateIndex
CREATE INDEX "initiatives_keyResultId_idx" ON "initiatives"("keyResultId");

-- CreateIndex
CREATE INDEX "initiatives_objectiveId_idx" ON "initiatives"("objectiveId");

-- CreateIndex
CREATE INDEX "initiatives_ownerId_idx" ON "initiatives"("ownerId");

-- CreateIndex
CREATE INDEX "role_assignments_userId_idx" ON "role_assignments"("userId");

-- CreateIndex
CREATE INDEX "role_assignments_scopeType_scopeId_idx" ON "role_assignments"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "role_assignments_role_idx" ON "role_assignments"("role");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_userId_role_scopeType_scopeId_key" ON "role_assignments"("userId", "role", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "check_ins_keyResultId_idx" ON "check_ins"("keyResultId");

-- CreateIndex
CREATE INDEX "check_ins_userId_idx" ON "check_ins"("userId");

-- CreateIndex
CREATE INDEX "activities_entityType_entityId_idx" ON "activities"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activities_userId_idx" ON "activities"("userId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "ai_conversations"("userId");

-- CreateIndex
CREATE INDEX "ai_conversations_workspaceId_idx" ON "ai_conversations"("workspaceId");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "ai_messages"("conversationId");

-- CreateIndex
CREATE INDEX "kr_integrations_keyResultId_idx" ON "kr_integrations"("keyResultId");

-- CreateIndex
CREATE UNIQUE INDEX "kr_integrations_keyResultId_source_externalId_key" ON "kr_integrations"("keyResultId", "source", "externalId");

-- CreateIndex
CREATE INDEX "user_layouts_userId_idx" ON "user_layouts"("userId");

-- CreateIndex
CREATE INDEX "user_layouts_entityId_idx" ON "user_layouts"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "user_layouts_userId_entityType_entityId_key" ON "user_layouts"("userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "idx_admin_event_time" ON "admin_event_entity"("realm_id", "admin_event_time");

-- CreateIndex
CREATE INDEX "idx_assoc_pol_assoc_pol_id" ON "associated_policy"("associated_policy_id");

-- CreateIndex
CREATE INDEX "idx_auth_exec_flow" ON "authentication_execution"("flow_id");

-- CreateIndex
CREATE INDEX "idx_auth_exec_realm_flow" ON "authentication_execution"("realm_id", "flow_id");

-- CreateIndex
CREATE INDEX "idx_auth_flow_realm" ON "authentication_flow"("realm_id");

-- CreateIndex
CREATE INDEX "idx_auth_config_realm" ON "authenticator_config"("realm_id");

-- CreateIndex
CREATE INDEX "idx_client_id" ON "client"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_b71cjlbenv945rb6gcon438at" ON "client"("realm_id", "client_id");

-- CreateIndex
CREATE INDEX "idx_client_init_acc_realm" ON "client_initial_access"("realm_id");

-- CreateIndex
CREATE INDEX "idx_realm_clscope" ON "client_scope"("realm_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_cli_scope" ON "client_scope"("realm_id", "name");

-- CreateIndex
CREATE INDEX "idx_clscope_attrs" ON "client_scope_attributes"("scope_id");

-- CreateIndex
CREATE INDEX "idx_cl_clscope" ON "client_scope_client"("scope_id");

-- CreateIndex
CREATE INDEX "idx_clscope_cl" ON "client_scope_client"("client_id");

-- CreateIndex
CREATE INDEX "idx_clscope_role" ON "client_scope_role_mapping"("scope_id");

-- CreateIndex
CREATE INDEX "idx_role_clscope" ON "client_scope_role_mapping"("role_id");

-- CreateIndex
CREATE INDEX "idx_client_session_session" ON "client_session"("session_id");

-- CreateIndex
CREATE INDEX "idx_component_provider_type" ON "component"("provider_type");

-- CreateIndex
CREATE INDEX "idx_component_realm" ON "component"("realm_id");

-- CreateIndex
CREATE INDEX "idx_compo_config_compo" ON "component_config"("component_id");

-- CreateIndex
CREATE INDEX "idx_composite" ON "composite_role"("composite");

-- CreateIndex
CREATE INDEX "idx_composite_child" ON "composite_role"("child_role");

-- CreateIndex
CREATE INDEX "idx_user_credential" ON "credential"("user_id");

-- CreateIndex
CREATE INDEX "idx_defcls_realm" ON "default_client_scope"("realm_id");

-- CreateIndex
CREATE INDEX "idx_defcls_scope" ON "default_client_scope"("scope_id");

-- CreateIndex
CREATE INDEX "idx_event_time" ON "event_entity"("realm_id", "event_time");

-- CreateIndex
CREATE INDEX "idx_fu_attribute" ON "fed_user_attribute"("user_id", "realm_id", "name");

-- CreateIndex
CREATE INDEX "idx_fu_cnsnt_ext" ON "fed_user_consent"("user_id", "client_storage_provider", "external_client_id");

-- CreateIndex
CREATE INDEX "idx_fu_consent" ON "fed_user_consent"("user_id", "client_id");

-- CreateIndex
CREATE INDEX "idx_fu_consent_ru" ON "fed_user_consent"("realm_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_fu_credential" ON "fed_user_credential"("user_id", "type");

-- CreateIndex
CREATE INDEX "idx_fu_credential_ru" ON "fed_user_credential"("realm_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_fu_group_membership" ON "fed_user_group_membership"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "idx_fu_group_membership_ru" ON "fed_user_group_membership"("realm_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_fu_required_action" ON "fed_user_required_action"("user_id", "required_action");

-- CreateIndex
CREATE INDEX "idx_fu_required_action_ru" ON "fed_user_required_action"("realm_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_fu_role_mapping" ON "fed_user_role_mapping"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "idx_fu_role_mapping_ru" ON "fed_user_role_mapping"("realm_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_fedidentity_feduser" ON "federated_identity"("federated_user_id");

-- CreateIndex
CREATE INDEX "idx_fedidentity_user" ON "federated_identity"("user_id");

-- CreateIndex
CREATE INDEX "idx_group_attr_group" ON "group_attribute"("group_id");

-- CreateIndex
CREATE INDEX "idx_group_role_mapp_group" ON "group_role_mapping"("group_id");

-- CreateIndex
CREATE INDEX "idx_ident_prov_realm" ON "identity_provider"("realm_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_2daelwnibji49avxsrtuf6xj33" ON "identity_provider"("provider_alias", "realm_id");

-- CreateIndex
CREATE INDEX "idx_id_prov_mapp_realm" ON "identity_provider_mapper"("realm_id");

-- CreateIndex
CREATE UNIQUE INDEX "sibling_names" ON "keycloak_group"("realm_id", "parent_group", "name");

-- CreateIndex
CREATE INDEX "idx_keycloak_role_client" ON "keycloak_role"("client");

-- CreateIndex
CREATE INDEX "idx_keycloak_role_realm" ON "keycloak_role"("realm");

-- CreateIndex
CREATE UNIQUE INDEX "UK_J3RWUVD56ONTGSUHOGM184WW2-2" ON "keycloak_role"("name", "client_realm_constraint");

-- CreateIndex
CREATE INDEX "idx_update_time" ON "migration_model"("update_time");

-- CreateIndex
CREATE INDEX "idx_offline_css_preload" ON "offline_client_session"("client_id", "offline_flag");

-- CreateIndex
CREATE INDEX "idx_us_sess_id_on_cl_sess" ON "offline_client_session"("user_session_id");

-- CreateIndex
CREATE INDEX "idx_offline_uss_by_user" ON "offline_user_session"("user_id", "realm_id", "offline_flag");

-- CreateIndex
CREATE INDEX "idx_offline_uss_by_usersess" ON "offline_user_session"("realm_id", "offline_flag", "user_session_id");

-- CreateIndex
CREATE INDEX "idx_offline_uss_createdon" ON "offline_user_session"("created_on");

-- CreateIndex
CREATE INDEX "idx_offline_uss_preload" ON "offline_user_session"("offline_flag", "created_on", "user_session_id");

-- CreateIndex
CREATE INDEX "idx_clscope_protmap" ON "protocol_mapper"("client_scope_id");

-- CreateIndex
CREATE INDEX "idx_protocol_mapper_client" ON "protocol_mapper"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_orvsdmla56612eaefiq6wl5oi" ON "realm"("name");

-- CreateIndex
CREATE INDEX "idx_realm_master_adm_cli" ON "realm"("master_admin_client");

-- CreateIndex
CREATE INDEX "idx_realm_attr_realm" ON "realm_attribute"("realm_id");

-- CreateIndex
CREATE UNIQUE INDEX "con_group_id_def_groups" ON "realm_default_groups"("group_id");

-- CreateIndex
CREATE INDEX "idx_realm_def_grp_realm" ON "realm_default_groups"("realm_id");

-- CreateIndex
CREATE INDEX "idx_realm_evt_types_realm" ON "realm_enabled_event_types"("realm_id");

-- CreateIndex
CREATE INDEX "idx_realm_evt_list_realm" ON "realm_events_listeners"("realm_id");

-- CreateIndex
CREATE INDEX "idx_realm_supp_local_realm" ON "realm_supported_locales"("realm_id");

-- CreateIndex
CREATE INDEX "idx_redir_uri_client" ON "redirect_uris"("client_id");

-- CreateIndex
CREATE INDEX "idx_req_act_prov_realm" ON "required_action_provider"("realm_id");

-- CreateIndex
CREATE INDEX "idx_res_policy_policy" ON "resource_policy"("policy_id");

-- CreateIndex
CREATE INDEX "idx_res_scope_scope" ON "resource_scope"("scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_frsr6t700s9v50bu18ws5pmt" ON "resource_server_perm_ticket"("owner", "requester", "resource_server_id", "resource_id", "scope_id");

-- CreateIndex
CREATE INDEX "idx_res_serv_pol_res_serv" ON "resource_server_policy"("resource_server_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_frsrpt700s9v50bu18ws5ha6" ON "resource_server_policy"("name", "resource_server_id");

-- CreateIndex
CREATE INDEX "idx_res_srv_res_res_srv" ON "resource_server_resource"("resource_server_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_frsr6t700s9v50bu18ws5ha6" ON "resource_server_resource"("name", "owner", "resource_server_id");

-- CreateIndex
CREATE INDEX "idx_res_srv_scope_res_srv" ON "resource_server_scope"("resource_server_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_frsrst700s9v50bu18ws5ha6" ON "resource_server_scope"("name", "resource_server_id");

-- CreateIndex
CREATE INDEX "idx_role_attribute" ON "role_attribute"("role_id");

-- CreateIndex
CREATE INDEX "idx_scope_mapping_role" ON "scope_mapping"("role_id");

-- CreateIndex
CREATE INDEX "idx_scope_policy_policy" ON "scope_policy"("policy_id");

-- CreateIndex
CREATE INDEX "idx_user_attribute" ON "user_attribute"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_attribute_name" ON "user_attribute"("name", "value");

-- CreateIndex
CREATE INDEX "idx_user_consent" ON "user_consent"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_jkuwuvd56ontgsuhogm8uewrt" ON "user_consent"("client_id", "client_storage_provider", "external_client_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_usconsent_clscope" ON "user_consent_client_scope"("user_consent_id");

-- CreateIndex
CREATE INDEX "idx_user_email" ON "user_entity"("email");

-- CreateIndex
CREATE INDEX "idx_user_service_account" ON "user_entity"("realm_id", "service_account_client_link");

-- CreateIndex
CREATE UNIQUE INDEX "uk_dykn684sl8up1crfei6eckhd7" ON "user_entity"("realm_id", "email_constraint");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ru8tt6t700s9v50bu18ws5ha6" ON "user_entity"("realm_id", "username");

-- CreateIndex
CREATE INDEX "idx_usr_fed_map_fed_prv" ON "user_federation_mapper"("federation_provider_id");

-- CreateIndex
CREATE INDEX "idx_usr_fed_map_realm" ON "user_federation_mapper"("realm_id");

-- CreateIndex
CREATE INDEX "idx_usr_fed_prv_realm" ON "user_federation_provider"("realm_id");

-- CreateIndex
CREATE INDEX "idx_user_group_mapping" ON "user_group_membership"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_reqactions" ON "user_required_action"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_role_mapping" ON "user_role_mapping"("user_id");

-- CreateIndex
CREATE INDEX "idx_web_orig_client" ON "web_origins"("client_id");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_parentWorkspaceId_fkey" FOREIGN KEY ("parentWorkspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_audits" ADD CONSTRAINT "permission_audits_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_audits" ADD CONSTRAINT "permission_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategic_pillars" ADD CONSTRAINT "strategic_pillars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "strategic_pillars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objective_key_results" ADD CONSTRAINT "objective_key_results_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objective_key_results" ADD CONSTRAINT "objective_key_results_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_impersonatedUserId_fkey" FOREIGN KEY ("impersonatedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kr_integrations" ADD CONSTRAINT "kr_integrations_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associated_policy" ADD CONSTRAINT "fk_frsr5s213xcx4wnkog82ssrfy" FOREIGN KEY ("associated_policy_id") REFERENCES "resource_server_policy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "associated_policy" ADD CONSTRAINT "fk_frsrpas14xcx4wnkog82ssrfy" FOREIGN KEY ("policy_id") REFERENCES "resource_server_policy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "authentication_execution" ADD CONSTRAINT "fk_auth_exec_flow" FOREIGN KEY ("flow_id") REFERENCES "authentication_flow"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "authentication_execution" ADD CONSTRAINT "fk_auth_exec_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "authentication_flow" ADD CONSTRAINT "fk_auth_flow_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "authenticator_config" ADD CONSTRAINT "fk_auth_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_attributes" ADD CONSTRAINT "fk3c47c64beacca966" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_initial_access" ADD CONSTRAINT "fk_client_init_acc_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_node_registrations" ADD CONSTRAINT "fk4129723ba992f594" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_scope_attributes" ADD CONSTRAINT "fk_cl_scope_attr_scope" FOREIGN KEY ("scope_id") REFERENCES "client_scope"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_scope_role_mapping" ADD CONSTRAINT "fk_cl_scope_rm_scope" FOREIGN KEY ("scope_id") REFERENCES "client_scope"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_session" ADD CONSTRAINT "fk_b4ao2vcvat6ukau74wbwtfqo1" FOREIGN KEY ("session_id") REFERENCES "user_session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_session_auth_status" ADD CONSTRAINT "auth_status_constraint" FOREIGN KEY ("client_session") REFERENCES "client_session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_session_note" ADD CONSTRAINT "fk5edfb00ff51c2736" FOREIGN KEY ("client_session") REFERENCES "client_session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_session_prot_mapper" ADD CONSTRAINT "fk_33a8sgqw18i532811v7o2dk89" FOREIGN KEY ("client_session") REFERENCES "client_session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_session_role" ADD CONSTRAINT "fk_11b7sgqw18i532811v7o2dv76" FOREIGN KEY ("client_session") REFERENCES "client_session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_user_session_note" ADD CONSTRAINT "fk_cl_usr_ses_note" FOREIGN KEY ("client_session") REFERENCES "client_session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "component" ADD CONSTRAINT "fk_component_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "component_config" ADD CONSTRAINT "fk_component_config" FOREIGN KEY ("component_id") REFERENCES "component"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "composite_role" ADD CONSTRAINT "fk_a63wvekftu8jo1pnj81e7mce2" FOREIGN KEY ("composite") REFERENCES "keycloak_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "composite_role" ADD CONSTRAINT "fk_gr7thllb9lu8q4vqa4524jjy8" FOREIGN KEY ("child_role") REFERENCES "keycloak_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "credential" ADD CONSTRAINT "fk_pfyr0glasqyl0dei3kl69r6v0" FOREIGN KEY ("user_id") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "default_client_scope" ADD CONSTRAINT "fk_r_def_cli_scope_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "federated_identity" ADD CONSTRAINT "fk404288b92ef007a6" FOREIGN KEY ("user_id") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "group_attribute" ADD CONSTRAINT "fk_group_attribute_group" FOREIGN KEY ("group_id") REFERENCES "keycloak_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "group_role_mapping" ADD CONSTRAINT "fk_group_role_group" FOREIGN KEY ("group_id") REFERENCES "keycloak_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "identity_provider" ADD CONSTRAINT "fk2b4ebc52ae5c3b34" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "identity_provider_config" ADD CONSTRAINT "fkdc4897cf864c4e43" FOREIGN KEY ("identity_provider_id") REFERENCES "identity_provider"("internal_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "identity_provider_mapper" ADD CONSTRAINT "fk_idpm_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "idp_mapper_config" ADD CONSTRAINT "fk_idpmconfig" FOREIGN KEY ("idp_mapper_id") REFERENCES "identity_provider_mapper"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "keycloak_role" ADD CONSTRAINT "fk_6vyqfe4cn4wlq8r6kt5vdsj5c" FOREIGN KEY ("realm") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "policy_config" ADD CONSTRAINT "fkdc34197cf864c4e43" FOREIGN KEY ("policy_id") REFERENCES "resource_server_policy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "protocol_mapper" ADD CONSTRAINT "fk_cli_scope_mapper" FOREIGN KEY ("client_scope_id") REFERENCES "client_scope"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "protocol_mapper" ADD CONSTRAINT "fk_pcm_realm" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "protocol_mapper_config" ADD CONSTRAINT "fk_pmconfig" FOREIGN KEY ("protocol_mapper_id") REFERENCES "protocol_mapper"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "realm_attribute" ADD CONSTRAINT "fk_8shxd6l3e9atqukacxgpffptw" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "realm_default_groups" ADD CONSTRAINT "fk_def_groups_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "realm_enabled_event_types" ADD CONSTRAINT "fk_h846o4h0w8epx5nwedrf5y69j" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "realm_events_listeners" ADD CONSTRAINT "fk_h846o4h0w8epx5nxev9f5y69j" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "realm_required_credential" ADD CONSTRAINT "fk_5hg65lybevavkqfki3kponh9v" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "realm_smtp_config" ADD CONSTRAINT "fk_70ej8xdxgxd0b9hh6180irr0o" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "realm_supported_locales" ADD CONSTRAINT "fk_supported_locales_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "redirect_uris" ADD CONSTRAINT "fk_1burs8pb4ouj97h5wuppahv9f" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "required_action_provider" ADD CONSTRAINT "fk_req_act_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_attribute" ADD CONSTRAINT "fk_5hrm2vlf9ql5fu022kqepovbr" FOREIGN KEY ("resource_id") REFERENCES "resource_server_resource"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_policy" ADD CONSTRAINT "fk_frsrpos53xcx4wnkog82ssrfy" FOREIGN KEY ("resource_id") REFERENCES "resource_server_resource"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_policy" ADD CONSTRAINT "fk_frsrpp213xcx4wnkog82ssrfy" FOREIGN KEY ("policy_id") REFERENCES "resource_server_policy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_scope" ADD CONSTRAINT "fk_frsrpos13xcx4wnkog82ssrfy" FOREIGN KEY ("resource_id") REFERENCES "resource_server_resource"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_scope" ADD CONSTRAINT "fk_frsrps213xcx4wnkog82ssrfy" FOREIGN KEY ("scope_id") REFERENCES "resource_server_scope"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_server_perm_ticket" ADD CONSTRAINT "fk_frsrho213xcx4wnkog82sspmt" FOREIGN KEY ("resource_server_id") REFERENCES "resource_server"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_server_perm_ticket" ADD CONSTRAINT "fk_frsrho213xcx4wnkog83sspmt" FOREIGN KEY ("resource_id") REFERENCES "resource_server_resource"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_server_perm_ticket" ADD CONSTRAINT "fk_frsrho213xcx4wnkog84sspmt" FOREIGN KEY ("scope_id") REFERENCES "resource_server_scope"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_server_perm_ticket" ADD CONSTRAINT "fk_frsrpo2128cx4wnkog82ssrfy" FOREIGN KEY ("policy_id") REFERENCES "resource_server_policy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_server_policy" ADD CONSTRAINT "fk_frsrpo213xcx4wnkog82ssrfy" FOREIGN KEY ("resource_server_id") REFERENCES "resource_server"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_server_resource" ADD CONSTRAINT "fk_frsrho213xcx4wnkog82ssrfy" FOREIGN KEY ("resource_server_id") REFERENCES "resource_server"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_server_scope" ADD CONSTRAINT "fk_frsrso213xcx4wnkog82ssrfy" FOREIGN KEY ("resource_server_id") REFERENCES "resource_server"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_uris" ADD CONSTRAINT "fk_resource_server_uris" FOREIGN KEY ("resource_id") REFERENCES "resource_server_resource"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_attribute" ADD CONSTRAINT "fk_role_attribute_id" FOREIGN KEY ("role_id") REFERENCES "keycloak_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scope_mapping" ADD CONSTRAINT "fk_ouse064plmlr732lxjcn1q5f1" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scope_policy" ADD CONSTRAINT "fk_frsrasp13xcx4wnkog82ssrfy" FOREIGN KEY ("policy_id") REFERENCES "resource_server_policy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scope_policy" ADD CONSTRAINT "fk_frsrpass3xcx4wnkog82ssrfy" FOREIGN KEY ("scope_id") REFERENCES "resource_server_scope"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_attribute" ADD CONSTRAINT "fk_5hrm2vlf9ql5fu043kqepovbr" FOREIGN KEY ("user_id") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_consent" ADD CONSTRAINT "fk_grntcsnt_user" FOREIGN KEY ("user_id") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_consent_client_scope" ADD CONSTRAINT "fk_grntcsnt_clsc_usc" FOREIGN KEY ("user_consent_id") REFERENCES "user_consent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_federation_config" ADD CONSTRAINT "fk_t13hpu1j94r2ebpekr39x5eu5" FOREIGN KEY ("user_federation_provider_id") REFERENCES "user_federation_provider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_federation_mapper" ADD CONSTRAINT "fk_fedmapperpm_fedprv" FOREIGN KEY ("federation_provider_id") REFERENCES "user_federation_provider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_federation_mapper" ADD CONSTRAINT "fk_fedmapperpm_realm" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_federation_mapper_config" ADD CONSTRAINT "fk_fedmapper_cfg" FOREIGN KEY ("user_federation_mapper_id") REFERENCES "user_federation_mapper"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_federation_provider" ADD CONSTRAINT "fk_1fj32f6ptolw2qy60cd8n01e8" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_group_membership" ADD CONSTRAINT "fk_user_group_user" FOREIGN KEY ("user_id") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_required_action" ADD CONSTRAINT "fk_6qj3w1jw9cvafhe19bwsiuvmd" FOREIGN KEY ("user_id") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_role_mapping" ADD CONSTRAINT "fk_c4fqv34p1mbylloxang7b1q3l" FOREIGN KEY ("user_id") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_session_note" ADD CONSTRAINT "fk5edfb00ff51d3472" FOREIGN KEY ("user_session") REFERENCES "user_session"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "web_origins" ADD CONSTRAINT "fk_lojpho213xcx4wnkog82ssrfy" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
