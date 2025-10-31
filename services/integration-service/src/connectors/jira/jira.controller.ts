import { Controller, Get, Post, Body } from '@nestjs/common';
import { JiraService } from './jira.service';

@Controller('integrations/jira')
export class JiraController {
  constructor(private readonly jiraService: JiraService) {}

  @Get('auth')
  async initiateAuth() {
    return { message: 'Jira OAuth flow - to be implemented' };
  }

  @Post('sync')
  async syncIssues(@Body() body: { keyResultId: string; jiraIssueId: string }) {
    return this.jiraService.syncIssue(body.keyResultId, body.jiraIssueId);
  }
}




