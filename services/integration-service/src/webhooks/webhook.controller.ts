import { Controller, Post, Body, Headers } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('jira')
  async handleJiraWebhook(@Body() body: any, @Headers() headers: any) {
    return this.webhookService.handleJiraWebhook(body, headers);
  }

  @Post('github')
  async handleGitHubWebhook(@Body() body: any, @Headers() headers: any) {
    return this.webhookService.handleGitHubWebhook(body, headers);
  }
}









