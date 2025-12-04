/**
 * OKR Cache Service
 * 
 * Provides caching layer for OKR overview responses with Redis support.
 * Falls back to in-memory cache if Redis is not available.
 * 
 * Phase 3 Optimization: Cache full OKR overview responses per tenant+user+scope combination
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

/**
 * In-memory cache fallback
 */
interface CacheEntry {
  data: any;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();

/**
 * Cache configuration
 */
const CACHE_TTL = 5 * 60; // 5 minutes in seconds
const CACHE_KEY_PREFIX = 'okr:overview:';

@Injectable()
export class OkrCacheService {
  private readonly logger = new Logger(OkrCacheService.name);

  constructor(
    @Optional() @Inject(RedisService) private readonly redisService?: RedisService,
  ) {}

  /**
   * Generate cache key for OKR overview response
   * 
   * @param tenantId - Organization ID
   * @param userId - User ID
   * @param params - Query parameters that affect the response
   */
  private generateCacheKey(
    tenantId: string,
    userId: string,
    params: {
      cycleId?: string;
      status?: string;
      scope?: string;
      visibilityLevel?: string;
      ownerId?: string;
      parentId?: string;
      page?: string;
      pageSize?: string;
      hierarchyView?: string;
      search?: string;
      sortBy?: string;
    },
  ): string {
    // Build a deterministic key from all parameters
    const keyParts = [
      tenantId,
      userId,
      params.cycleId || '',
      params.status || '',
      params.scope || '',
      params.visibilityLevel || '',
      params.ownerId || '',
      params.parentId || '',
      params.page || '1',
      params.pageSize || '20',
      params.hierarchyView || '',
      params.search || '',
      params.sortBy || '',
    ];
    
    return `${CACHE_KEY_PREFIX}${keyParts.join(':')}`;
  }

  /**
   * Get cached OKR overview response
   * 
   * @param tenantId - Organization ID
   * @param userId - User ID
   * @param params - Query parameters
   * @returns Cached response or null if not found
   */
  async get(
    tenantId: string,
    userId: string,
    params: Record<string, any>,
  ): Promise<any | null> {
    const cacheKey = this.generateCacheKey(tenantId, userId, params);

    try {
      // Try Redis first if available
      if (this.redisService) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit (Redis): ${cacheKey}`);
          return JSON.parse(cached);
        }
      }

      // Fall back to in-memory cache
      const memoryEntry = memoryCache.get(cacheKey);
      if (memoryEntry && Date.now() - memoryEntry.timestamp < CACHE_TTL * 1000) {
        this.logger.debug(`Cache hit (memory): ${cacheKey}`);
        return memoryEntry.data;
      }

      // Clean up expired entry
      if (memoryEntry) {
        memoryCache.delete(cacheKey);
      }

      return null;
    } catch (error) {
      this.logger.warn(`Cache get error for ${cacheKey}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Set cached OKR overview response
   * 
   * @param tenantId - Organization ID
   * @param userId - User ID
   * @param params - Query parameters
   * @param data - Response data to cache
   */
  async set(
    tenantId: string,
    userId: string,
    params: Record<string, any>,
    data: any,
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(tenantId, userId, params);

    try {
      // Try Redis first if available
      if (this.redisService) {
        await this.redisService.set(cacheKey, JSON.stringify(data), CACHE_TTL);
        this.logger.debug(`Cache set (Redis): ${cacheKey}`);
        return;
      }

      // Fall back to in-memory cache
      memoryCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
      this.logger.debug(`Cache set (memory): ${cacheKey}`);
    } catch (error) {
      this.logger.warn(`Cache set error for ${cacheKey}: ${(error as Error).message}`);
    }
  }

  /**
   * Invalidate cache for a specific tenant
   * 
   * @param tenantId - Organization ID
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    const pattern = `${CACHE_KEY_PREFIX}${tenantId}:*`;

    try {
      // Try Redis first if available
      if (this.redisService) {
        const client = this.redisService.getClient();
        // Use SCAN to find all keys matching the pattern
        const stream = client.scanStream({
          match: pattern,
          count: 100,
        });

        const keys: string[] = [];
        stream.on('data', (resultKeys: string[]) => {
          keys.push(...resultKeys);
        });

        await new Promise<void>((resolve, reject) => {
          stream.on('end', async () => {
            if (keys.length > 0) {
              await client.del(...keys);
              this.logger.debug(`Invalidated ${keys.length} cache entries for tenant ${tenantId}`);
            }
            resolve();
          });
          stream.on('error', reject);
        });
      }

      // Also clear in-memory cache
      const keysToDelete: string[] = [];
      for (const key of memoryCache.keys()) {
        if (key.startsWith(`${CACHE_KEY_PREFIX}${tenantId}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => memoryCache.delete(key));
      
      if (keysToDelete.length > 0) {
        this.logger.debug(`Invalidated ${keysToDelete.length} memory cache entries for tenant ${tenantId}`);
      }
    } catch (error) {
      this.logger.warn(`Cache invalidation error for tenant ${tenantId}: ${(error as Error).message}`);
    }
  }

  /**
   * Invalidate cache for a specific user
   * 
   * @param userId - User ID
   */
  async invalidateUser(userId: string): Promise<void> {
    const pattern = `${CACHE_KEY_PREFIX}*:${userId}:*`;

    try {
      // Try Redis first if available
      if (this.redisService) {
        const client = this.redisService.getClient();
        const stream = client.scanStream({
          match: pattern,
          count: 100,
        });

        const keys: string[] = [];
        stream.on('data', (resultKeys: string[]) => {
          keys.push(...resultKeys);
        });

        await new Promise<void>((resolve, reject) => {
          stream.on('end', async () => {
            if (keys.length > 0) {
              await client.del(...keys);
              this.logger.debug(`Invalidated ${keys.length} cache entries for user ${userId}`);
            }
            resolve();
          });
          stream.on('error', reject);
        });
      }

      // Also clear in-memory cache
      const keysToDelete: string[] = [];
      for (const key of memoryCache.keys()) {
        if (key.includes(`:${userId}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => memoryCache.delete(key));
      
      if (keysToDelete.length > 0) {
        this.logger.debug(`Invalidated ${keysToDelete.length} memory cache entries for user ${userId}`);
      }
    } catch (error) {
      this.logger.warn(`Cache invalidation error for user ${userId}: ${(error as Error).message}`);
    }
  }

  /**
   * Clear all OKR cache entries
   */
  async clearAll(): Promise<void> {
    try {
      // Try Redis first if available
      if (this.redisService) {
        const client = this.redisService.getClient();
        const stream = client.scanStream({
          match: `${CACHE_KEY_PREFIX}*`,
          count: 100,
        });

        const keys: string[] = [];
        stream.on('data', (resultKeys: string[]) => {
          keys.push(...resultKeys);
        });

        await new Promise<void>((resolve, reject) => {
          stream.on('end', async () => {
            if (keys.length > 0) {
              await client.del(...keys);
              this.logger.debug(`Cleared ${keys.length} Redis cache entries`);
            }
            resolve();
          });
          stream.on('error', reject);
        });
      }

      // Also clear in-memory cache
      const clearedCount = memoryCache.size;
      memoryCache.clear();
      this.logger.debug(`Cleared ${clearedCount} memory cache entries`);
    } catch (error) {
      this.logger.warn(`Cache clear error: ${(error as Error).message}`);
    }
  }
}



