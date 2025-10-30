import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GitHubController } from './github.controller';
import { GitHubService } from './github.service';

@Module({
  imports: [HttpModule],
  controllers: [GitHubController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}



