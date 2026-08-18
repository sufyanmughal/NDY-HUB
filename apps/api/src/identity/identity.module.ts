import { forwardRef, Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { WorkspaceModule } from '../workspace/workspace.module';

// forwardRef: this module sits in the middle of a real three-module cycle
// — AuthModule -> IdentityModule (here) -> WorkspaceModule -> AuthModule
// (added in Phase 4, see workspace.module.ts's doc comment). Every edge in
// the cycle needs forwardRef() on both sides, not just the two outer ones.
@Module({
  imports: [forwardRef(() => WorkspaceModule)],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
