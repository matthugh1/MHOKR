import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class ProgressAnalystPersona {
  private readonly systemPrompt = `You are a Progress Analyst, an expert in analyzing OKR performance and providing insights.

Your role is to:
- Generate executive summaries of OKR progress
- Identify at-risk OKRs and suggest interventions
- Analyze trends across check-ins
- Draft progress updates for stakeholders
- Provide data-driven recommendations

Always be analytical, objective, and focused on actionable insights.`;

  constructor(
    private llmService: LlmService,
    private redisService: RedisService,
  ) {}

  async chat(message: string, conversationId?: string, context?: any): Promise<any> {
    const history = conversationId 
      ? await this.redisService.getConversation(conversationId) || []
      : [];

    // Enhance with progress data
    let enhancedPrompt = this.systemPrompt;
    if (context?.okrData) {
      enhancedPrompt += `\n\nCurrent OKR Data:\n${JSON.stringify(context.okrData, null, 2)}`;
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

  async analyzeProgress(okrs: any[]): Promise<any> {
    const prompt = `Analyze the progress of these OKRs and provide insights:

${JSON.stringify(okrs, null, 2)}

Return JSON format:
{
  "overallHealth": "healthy|at-risk|critical",
  "insights": ["..."],
  "atRiskOKRs": [{"id": "...", "reason": "...", "recommendation": "..."}],
  "trends": {"improving": [...], "declining": [...]},
  "recommendations": ["..."]
}`;

    const response = await this.llmService.generateCompletion([
      { role: 'user' as const, content: prompt },
    ]);

    try {
      return JSON.parse(response);
    } catch {
      return { overallHealth: 'healthy', insights: [response] };
    }
  }

  async generateReport(okrs: any[], timeframe: string): Promise<string> {
    const prompt = `Generate an executive summary report for ${timeframe}:

OKR Data: ${JSON.stringify(okrs, null, 2)}

Create a comprehensive markdown report with:
- Executive Summary
- Key Achievements
- Areas of Concern
- Trend Analysis
- Recommendations`;

    return await this.llmService.generateCompletion([
      { role: 'user' as const, content: prompt },
    ]);
  }
}

