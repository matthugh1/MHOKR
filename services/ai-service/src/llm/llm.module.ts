import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';

@Module({
  providers: [LlmService, OpenAIProvider, AnthropicProvider],
  exports: [LlmService],
})
export class LlmModule {}






