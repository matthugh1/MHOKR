import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class OkrCoachPersona {
  private readonly systemPrompt = `You are an OKR Coach, an expert in helping teams create effective Objectives and Key Results.

Your role is to:
- Guide users through OKR creation
- Validate OKRs against SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound)
- Suggest better phrasing and metrics
- Recommend appropriate objectives based on team roles
- Identify vague or unmeasurable key results

Always be encouraging, practical, and focused on helping teams achieve measurable outcomes.`;

  constructor(
    private llmService: LlmService,
    private redisService: RedisService,
  ) {}

  async chat(message: string, conversationId?: string, context?: any): Promise<any> {
    // Load conversation history
    const history = conversationId 
      ? await this.redisService.getConversation(conversationId) || []
      : [];

    // Enhance system prompt with context
    let enhancedPrompt = this.systemPrompt;
    if (context?.currentOKRs) {
      enhancedPrompt += `\n\nUser's current OKRs:\n${JSON.stringify(context.currentOKRs, null, 2)}`;
    }

    // Build messages with context
    const messages = [
      { role: 'system' as const, content: enhancedPrompt },
      ...history,
      { role: 'user' as const, content: message },
    ];

    // Generate response
    const response = await this.llmService.generateCompletion(messages);

    // Save conversation
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

  async validateOKR(objectiveText: string, keyResults: string[]): Promise<any> {
    const prompt = `Analyze this OKR and provide structured feedback:

Objective: ${objectiveText}

Key Results:
${keyResults.map((kr, i) => `${i + 1}. ${kr}`).join('\n')}

Provide feedback in JSON format:
{
  "objective": {
    "score": 0-10,
    "strengths": ["..."],
    "weaknesses": ["..."],
    "suggestions": ["..."]
  },
  "keyResults": [
    {
      "score": 0-10,
      "measurable": true/false,
      "specific": true/false,
      "suggestions": ["..."]
    }
  ],
  "overallScore": 0-10,
  "summary": "..."
}`;

    const response = await this.llmService.generateCompletion([
      { role: 'user' as const, content: prompt },
    ]);

    try {
      return JSON.parse(response);
    } catch {
      return { valid: true, summary: response };
    }
  }

  async suggestKeyResults(objectiveText: string): Promise<string[]> {
    const prompt = `For the objective: "${objectiveText}"

Generate 3-5 excellent key results that are:
- Specific and measurable
- Challenging but achievable
- Use metrics (numbers, percentages, completion states)

Return ONLY a JSON array of strings, e.g.:
["Increase monthly active users from 10K to 50K", "Achieve 95% customer satisfaction score"]`;

    const response = await this.llmService.generateCompletion([
      { role: 'user' as const, content: prompt },
    ]);

    try {
      return JSON.parse(response);
    } catch {
      const lines = response.split('\n').filter(l => l.trim().length > 10);
      return lines.map(l => l.replace(/^[\d\-\.\)]+\s*/, '').trim()).slice(0, 5);
    }
  }
}

