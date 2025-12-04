import { Module, forwardRef } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { RBACModule } from '../rbac/rbac.module';
import { OkrModule } from '../okr/okr.module';

@Module({
  imports: [RBACModule, forwardRef(() => OkrModule)],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
