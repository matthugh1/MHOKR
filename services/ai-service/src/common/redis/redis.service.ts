import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.client = new Redis(redisUrl);
  }

  async onModuleInit() {
    await this.client.ping();
    console.log('✅ Redis connected successfully (AI Service)');
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  // Conversation memory methods
  async saveConversation(conversationId: string, messages: any[], ttl?: number) {
    const key = `conversation:${conversationId}`;
    await this.client.set(key, JSON.stringify(messages));
    if (ttl) {
      await this.client.expire(key, ttl);
    }
  }

  async getConversation(conversationId: string): Promise<any[] | null> {
    const key = `conversation:${conversationId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteConversation(conversationId: string) {
    const key = `conversation:${conversationId}`;
    await this.client.del(key);
  }
}

