import { Controller, Get, Post, Body } from '@nestjs/common';
import { SlackService } from './slack.service';

@Controller('integrations/slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  @Get('auth')
  async initiateAuth() {
    return { message: 'Slack OAuth flow - to be implemented' };
  }

  @Post('notify')
  async sendNotification(@Body() body: { channel: string; message: string }) {
    return this.slackService.sendMessage(body.channel, body.message);
  }
}







