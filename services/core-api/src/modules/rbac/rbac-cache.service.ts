/**
 * RBAC Cache Service
 * 
 * Provides caching layer for RBAC operations with Redis support.
 * Falls back to in-memory cache if Redis is not available.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { UserContext } from './types';

/**
 * In-memory cache fallback
 */
const memoryCache = new Map<string, { context: UserContext; timestamp: number }>();

/**
 * Cache configuration
 */
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  useRedis: boolean;
  redisUrl?: string;
}

@Injectable()
export class RBACCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RBACCacheService.name);
  private redisClient: any = null;
  private readonly config: CacheConfig = {
    ttl: 5 * 60 * 1000, // 5 minutes
    useRedis: process.env.REDIS_URL !== undefined,
    redisUrl: process.env.REDIS_URL,
  };

  async onModuleInit() {
    if (this.config.useRedis && this.config.redisUrl) {
      try {
        // Dynamically import Redis client (optional dependency)
        const Redis = await import('ioredis').catch(() => null);
        
        if (Redis) {
          this.redisClient = new Redis.default(this.config.redisUrl);
          this.logger.log('Redis cache initialized');
        } else {
          this.logger.warn('Redis not available, using in-memory cache');
        }
      } catch (error) {
        this.logger.warn('Failed to initialize Redis, using in-memory cache', error);
      }
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  /**
   * Get user context from cache
   */
  async get(userId: string): Promise<UserContext | null> {
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(`rbac:context:${userId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          const context = parsed.context || parsed; // Handle both formats
          // Reconstruct Maps from JSON (Maps get serialized to plain objects)
          return {
            ...context,
            tenantRoles: context.tenantRoles instanceof Map 
              ? context.tenantRoles 
              : new Map(Object.entries(context.tenantRoles || {})),
            workspaceRoles: context.workspaceRoles instanceof Map 
              ? context.workspaceRoles 
              : new Map(Object.entries(context.workspaceRoles || {})),
            teamRoles: context.teamRoles instanceof Map 
              ? context.teamRoles 
              : new Map(Object.entries(context.teamRoles || {})),
          };
        }
      } catch (error) {
        this.logger.error('Redis get error, falling back to memory cache', error);
      }
    }

    // Fallback to memory cache
    const cached = memoryCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.config.ttl) {
      const context = cached.context;
      // Reconstruct Maps if they were serialized
      return {
        ...context,
        tenantRoles: context.tenantRoles instanceof Map 
          ? context.tenantRoles 
          : new Map(Object.entries(context.tenantRoles || {})),
        workspaceRoles: context.workspaceRoles instanceof Map 
          ? context.workspaceRoles 
          : new Map(Object.entries(context.workspaceRoles || {})),
        teamRoles: context.teamRoles instanceof Map 
          ? context.teamRoles 
          : new Map(Object.entries(context.teamRoles || {})),
      };
    }

    return null;
  }

  /**
   * Set user context in cache
   */
  async set(userId: string, context: UserContext): Promise<void> {
    const data = {
      context,
      timestamp: Date.now(),
    };

    if (this.redisClient) {
      try {
        await this.redisClient.setex(
          `rbac:context:${userId}`,
          Math.floor(this.config.ttl / 1000), // Redis TTL in seconds
          JSON.stringify(context),
        );
      } catch (error) {
        this.logger.error('Redis set error, falling back to memory cache', error);
        // Fallback to memory cache
        memoryCache.set(userId, data);
      }
    } else {
      // Use memory cache
      memoryCache.set(userId, data);
    }
  }

  /**
   * Invalidate user context cache
   */
  async invalidate(userId: string): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.del(`rbac:context:${userId}`);
      } catch (error) {
        this.logger.error('Redis delete error', error);
      }
    }

    // Also clear from memory cache
    memoryCache.delete(userId);
  }

  /**
   * Clear all cached contexts
   */
  async clear(): Promise<void> {
    if (this.redisClient) {
      try {
        const keys = await this.redisClient.keys('rbac:context:*');
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (error) {
        this.logger.error('Redis clear error', error);
      }
    }

    // Clear memory cache
    memoryCache.clear();
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    type: 'redis' | 'memory';
    size: number;
    ttl: number;
  }> {
    if (this.redisClient) {
      try {
        const keys = await this.redisClient.keys('rbac:context:*');
        return {
          type: 'redis',
          size: keys.length,
          ttl: this.config.ttl,
        };
      } catch (error) {
        this.logger.error('Redis stats error', error);
      }
    }

    return {
      type: 'memory',
      size: memoryCache.size,
      ttl: this.config.ttl,
    };
  }
}

