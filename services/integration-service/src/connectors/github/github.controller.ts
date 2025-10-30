import { Controller, Get } from '@nestjs/common';
import { GitHubService } from './github.service';

@Controller('integrations/github')
export class GitHubController {
  constructor(private readonly _githubService: GitHubService) {}

  @Get('auth')
  async initiateAuth() {
    return { message: 'GitHub OAuth flow - to be implemented' };
  }
}

