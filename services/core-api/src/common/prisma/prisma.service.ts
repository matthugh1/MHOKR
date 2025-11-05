import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTenantIsolationMiddleware } from './tenant-isolation.middleware';
import { getTenantContext } from './tenant-isolation.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    
    // IMPORTANT: Middleware order matters - RLS session variables must be set BEFORE tenant isolation filtering
    // Register RLS session variable middleware FIRST (runs first)
    // Only set session variables for tenant-scoped queries to avoid unnecessary overhead
    this.$use(async (params, next) => {
      // Only process tenant-scoped models and skip internal Prisma operations
      const tenantScopedModels = [
        'objective', 'keyResult', 'workspace', 'team', 'cycle', 
        'initiative', 'checkInRequest', 'strategicPillar', 'organization'
      ];
      
      // Skip if not a tenant-scoped model or if it's a metadata/internal query
      if (!params.model || !tenantScopedModels.includes(params.model)) {
        return next(params);
      }
      
      const organizationId = getTenantContext();
      const isSuperuser = organizationId === null;
      
      // Set PostgreSQL session variables for RLS only when tenant context is available
      // This reduces overhead on queries that don't need RLS
      // Use a flag to prevent recursive calls during $executeRawUnsafe
      if (organizationId !== undefined && !(params as any).__rlsVariablesSet) {
        try {
          // Mark this query to prevent recursion
          (params as any).__rlsVariablesSet = true;
          
          // Use SET (session-level) instead of SET LOCAL (transaction-level)
          // This works for both transaction and non-transaction queries
          // Connection pool will reset variables when connection is returned
          const orgIdValue = organizationId === null ? 'NULL' : `'${String(organizationId).replace(/'/g, "''")}'`;
          await this.$executeRawUnsafe(
            `SET app.current_organization_id = ${orgIdValue}`
          );
          await this.$executeRawUnsafe(
            `SET app.user_is_superuser = ${isSuperuser}`
          );
        } catch (error) {
          // If setting session variables fails, log but don't block
          // This allows the application to continue working if RLS is not fully configured
          console.warn('[PrismaService] Failed to set RLS session variables:', error);
        } finally {
          // Clean up flag
          delete (params as any).__rlsVariablesSet;
        }
      }
      
      return next(params);
    });
    
    // Register tenant isolation middleware SECOND (runs after RLS variables are set)
    this.$use(createTenantIsolationMiddleware());
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected successfully');
    console.log('🔒 Tenant isolation middleware enabled');
    console.log('🔒 PostgreSQL RLS session variable hooks configured');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('👋 Database disconnected');
  }
}






