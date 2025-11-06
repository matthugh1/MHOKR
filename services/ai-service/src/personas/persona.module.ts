import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ToolModule } from '../tools/tool.module';
import { PersonaController } from './persona.controller';
import { OkrCoachPersona } from './okr-coach.persona';
import { CascadeAssistantPersona } from './cascade-assistant.persona';
import { ProgressAnalystPersona } from './progress-analyst.persona';

@Module({
  imports: [LlmModule, ToolModule],
  controllers: [PersonaController],
  providers: [OkrCoachPersona, CascadeAssistantPersona, ProgressAnalystPersona],
})
export class PersonaModule {}







