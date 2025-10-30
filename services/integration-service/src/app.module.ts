import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { JiraModule } from './connectors/jira/jira.module';
import { GitHubModule } from './connectors/github/github.module';
import { SlackModule } from './connectors/slack/slack.module';
import { WebhookModule } from './webhooks/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    JiraModule,
    GitHubModule,
    SlackModule,
    WebhookModule,
  ],
})
export class AppModule {}



