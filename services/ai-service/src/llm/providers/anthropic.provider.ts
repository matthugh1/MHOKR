import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Message, CompletionOptions } from '../llm.service';

@Injectable()
export class AnthropicProvider {
  private client: Anthropic;
  private model: string;

  constructor(private configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.configService.get<string>('ANTHROPIC_MODEL', 'claude-3-sonnet-20240229');
  }

  async generateCompletion(
    messages: Message[],
    options?: CompletionOptions,
  ): Promise<string> {
    // Anthropic requires system message separate
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await this.client.messages.create({
      model: this.model,
      system: systemMessage?.content,
      messages: userMessages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    });

    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }

  async *generateStreamingCompletion(
    messages: Message[],
    options?: CompletionOptions,
  ): AsyncIterable<string> {
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const stream = await this.client.messages.stream({
      model: this.model,
      system: systemMessage?.content,
      messages: userMessages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }
}



