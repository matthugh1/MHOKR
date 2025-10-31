import { Controller, Post, Body, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { OkrCoachPersona } from './okr-coach.persona';
import { CascadeAssistantPersona } from './cascade-assistant.persona';
import { ProgressAnalystPersona } from './progress-analyst.persona';

@Controller('personas')
export class PersonaController {
  constructor(
    private okrCoach: OkrCoachPersona,
    private cascadeAssistant: CascadeAssistantPersona,
    private progressAnalyst: ProgressAnalystPersona,
  ) {}

  @Post(':persona/chat')
  async chat(
    @Param('persona') persona: string,
    @Body() body: { message: string; conversationId?: string; context?: any },
  ) {
    switch (persona) {
      case 'okr-coach':
        return this.okrCoach.chat(body.message, body.conversationId, body.context);
      case 'cascade-assistant':
        return this.cascadeAssistant.chat(body.message, body.conversationId, body.context);
      case 'progress-analyst':
        return this.progressAnalyst.chat(body.message, body.conversationId, body.context);
      default:
        throw new Error(`Unknown persona: ${persona}`);
    }
  }

  @Sse(':persona/chat/stream')
  streamChat(
    @Param('persona') _persona: string,
    @Body() _body: { message: string; conversationId?: string; context?: any },
  ): Observable<MessageEvent> {
    // TODO [phase7-performance]: Implement SSE streaming for real-time persona responses
    throw new Error('Not implemented');
  }

  @Post('okr-coach/validate')
  async validateOKR(@Body() body: { objective: string; keyResults: string[] }) {
    return this.okrCoach.validateOKR(body.objective, body.keyResults);
  }

  @Post('okr-coach/suggest-key-results')
  async suggestKeyResults(@Body() body: { objective: string }) {
    return this.okrCoach.suggestKeyResults(body.objective);
  }

  @Post('cascade-assistant/suggest-alignments')
  async suggestAlignments(@Body() body: { childOKR: any; parentOKRs: any[] }) {
    return this.cascadeAssistant.suggestAlignments(body.childOKR, body.parentOKRs);
  }

  @Post('progress-analyst/analyze')
  async analyzeProgress(@Body() body: { okrs: any[] }) {
    return this.progressAnalyst.analyzeProgress(body.okrs);
  }

  @Post('progress-analyst/report')
  async generateReport(@Body() body: { okrs: any[]; timeframe: string }) {
    return this.progressAnalyst.generateReport(body.okrs, body.timeframe);
  }
}

