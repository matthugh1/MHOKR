import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './common/redis/redis.module';
import { LlmModule } from './llm/llm.module';
import { PersonaModule } from './personas/persona.module';
import { ToolModule } from './tools/tool.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RedisModule,
    LlmModule,
    PersonaModule,
    ToolModule,
  ],
})
export class AppModule {}




