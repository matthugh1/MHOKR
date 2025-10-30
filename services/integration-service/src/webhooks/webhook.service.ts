import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhookService {
  async handleJiraWebhook(body: any, _headers: any) {
    console.log('Received Jira webhook:', body);
    // TODO: Implement webhook processing
    return { success: true };
  }

  async handleGitHubWebhook(body: any, _headers: any) {
    console.log('Received GitHub webhook:', body);
    // TODO: Implement webhook processing
    return { success: true };
  }
}

