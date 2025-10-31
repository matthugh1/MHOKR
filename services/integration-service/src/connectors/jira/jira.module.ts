import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JiraController } from './jira.controller';
import { JiraService } from './jira.service';

@Module({
  imports: [HttpModule],
  controllers: [JiraController],
  providers: [JiraService],
  exports: [JiraService],
})
export class JiraModule {}




