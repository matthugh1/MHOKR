import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ToolService } from './tool.service';

@Module({
  imports: [HttpModule],
  providers: [ToolService],
  exports: [ToolService],
})
export class ToolModule {}









