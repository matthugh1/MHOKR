import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTenantIsolationMiddleware } from './tenant-isolation.middleware';
import { getTenantContext } from './tenant-isolation.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100', 10);
  
  constructor() {
    super();
    
    // Phase 2.3: Query Performance Monitoring Middleware
    // Log slow queries for performance analysis
    this.$use(async (params, next) => {
      const startTime = Date.now();
      const result = await next(params);
      const duration = Date.now() - startTime;
      
      if (duration > this.SLOW_QUERY_THRESHOLD_MS) {
        this.logger.warn('Slow query detected', {
          model: params.model,
          action: params.action,
          duration: `${duration}ms`,
          threshold: `${this.SLOW_QUERY_THRESHOLD_MS}ms`,
          args: params.args ? JSON.stringify(params.args).substring(0, 200) : undefined, // Limit log size
        });
      }
      
      return result;
    });
    
    // IMPORTANT: Middleware order matters - RLS session variables must be set BEFORE tenant isolation filtering
    // Register RLS session variable middleware FIRST (runs first)
    // Only set session variables for tenant-scoped queries to avoid unnecessary overhead
    this.$use(async (params, next) => {
      // Only process tenant-scoped models and skip internal Prisma operations
      const tenantScopedModels = [
        'objective', 'keyResult', 'workspace', 'team', 'cycle', 
        'initiative', 'checkInRequest', 'strategicPillar', 'organization',
        'activity',      // ADD THIS
        'userLayout',    // ADD THIS
        'user',          // Users table - RLS enabled
        'roleAssignment', // Role assignments table - RLS enabled
      ];
      
      // Skip if not a tenant-scoped model or if it's a metadata/internal query
      if (!params.model || !tenantScopedModels.includes(params.model)) {
        return next(params);
      }
      
      const tenantId = getTenantContext();
      const isSuperuser = tenantId === null;
      
      // Set PostgreSQL session variables for RLS only when tenant context is available
      // This reduces overhead on queries that don't need RLS
      // Use a flag to prevent recursive calls during $executeRawUnsafe
      if (tenantId !== undefined && !(params as any).__rlsVariablesSet) {
        try {
          // Mark this query to prevent recursion
          (params as any).__rlsVariablesSet = true;
          
          // Use SET (session-level) instead of SET LOCAL (transaction-level)
          // This works for both transaction and non-transaction queries
          // Connection pool will reset variables when connection is returned
          // NOTE: Using app.current_organization_id to match RLS policies
          const tenantIdValue = tenantId === null ? 'NULL' : `'${String(tenantId).replace(/'/g, "''")}'`;
          
          // Debug logging removed - use structured logging service in production
          
          await this.$executeRawUnsafe(
            `SET app.current_organization_id = ${tenantIdValue}`
          );
          await this.$executeRawUnsafe(
            `SET app.user_is_superuser = '${isSuperuser ? 'true' : 'false'}'`
          );
        } catch (error) {
          // If setting session variables fails, log but don't block
          // This allows the application to continue working if RLS is not fully configured
          this.logger.error('Failed to set RLS session variables', { error: error instanceof Error ? error.message : String(error) });
        } finally {
          // Clean up flag
          delete (params as any).__rlsVariablesSet;
        }
      } else if (tenantId === undefined && params.model && String(params.model) === 'objective') {
        // Log when tenant context is missing (this should not happen for authenticated requests)
        this.logger.warn('No tenant context available for query - RLS may not filter correctly', { model: params.model });
      }
      
      return next(params);
    });
    
    // Register tenant isolation middleware SECOND (runs after RLS variables are set)
    this.$use(createTenantIsolationMiddleware());
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully');
    this.logger.log('Tenant isolation middleware enabled');
    this.logger.log('PostgreSQL RLS session variable hooks configured');
    this.logger.log(`Query performance monitoring enabled (threshold: ${this.SLOW_QUERY_THRESHOLD_MS}ms)`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}






