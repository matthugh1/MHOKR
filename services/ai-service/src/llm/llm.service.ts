import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
}

@Injectable()
export class LlmService {
  private provider: 'openai' | 'anthropic';

  constructor(
    private configService: ConfigService,
    private openAIProvider: OpenAIProvider,
    private anthropicProvider: AnthropicProvider,
  ) {
    this.provider = this.configService.get<'openai' | 'anthropic'>('AI_DEFAULT_PROVIDER', 'openai');
  }

  async generateCompletion(
    messages: Message[],
    options?: CompletionOptions,
  ): Promise<string> {
    if (this.provider === 'openai') {
      return this.openAIProvider.generateCompletion(messages, options);
    } else if (this.provider === 'anthropic') {
      return this.anthropicProvider.generateCompletion(messages, options);
    }

    throw new Error(`Unknown provider: ${this.provider}`);
  }

  async generateStreamingCompletion(
    messages: Message[],
    options?: CompletionOptions,
  ): Promise<AsyncIterable<string>> {
    if (this.provider === 'openai') {
      return this.openAIProvider.generateStreamingCompletion(messages, options);
    } else if (this.provider === 'anthropic') {
      return this.anthropicProvider.generateStreamingCompletion(messages, options);
    }

    throw new Error(`Unknown provider: ${this.provider}`);
  }
}



