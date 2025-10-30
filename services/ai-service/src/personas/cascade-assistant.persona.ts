import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class CascadeAssistantPersona {
  private readonly systemPrompt = `You are a Cascade Assistant, an expert in aligning OKRs across teams and departments.

Your role is to:
- Suggest parent objectives from other teams
- Identify alignment opportunities
- Detect conflicting objectives
- Recommend who should collaborate
- Help create dependencies between OKRs

Always focus on strategic alignment and cross-functional collaboration.`;

  constructor(
    private llmService: LlmService,
    private redisService: RedisService,
  ) {}

  async chat(message: string, conversationId?: string, context?: any): Promise<any> {
    const history = conversationId 
      ? await this.redisService.getConversation(conversationId) || []
      : [];

    // Enhance with OKR hierarchy context
    let enhancedPrompt = this.systemPrompt;
    if (context?.organizationOKRs) {
      enhancedPrompt += `\n\nOrganization OKRs:\n${JSON.stringify(context.organizationOKRs, null, 2)}`;
    }

    const messages = [
      { role: 'system' as const, content: enhancedPrompt },
      ...history,
      { role: 'user' as const, content: message },
    ];

    const response = await this.llmService.generateCompletion(messages);

    if (conversationId) {
      const updatedHistory = [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: response },
      ];
      await this.redisService.saveConversation(conversationId, updatedHistory, 3600);
    }

    return {
      response,
      conversationId,
    };
  }

  async suggestAlignments(childOKR: any, parentOKRs: any[]): Promise<any> {
    const prompt = `Analyze alignment between this OKR and potential parent OKRs:

Child OKR: ${JSON.stringify(childOKR, null, 2)}
Parent OKRs: ${JSON.stringify(parentOKRs, null, 2)}

Return JSON: {"bestMatches": [{"parentId": "...", "score": 0-100, "reasoning": "..."}], "suggestions": ["..."]}`;

    const response = await this.llmService.generateCompletion([
      { role: 'user' as const, content: prompt },
    ]);

    try {
      return JSON.parse(response);
    } catch {
      return { bestMatches: [], suggestions: [response] };
    }
  }
}

