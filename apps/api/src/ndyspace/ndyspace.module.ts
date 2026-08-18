import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NdyspaceNotificationsService } from './ndyspace-notifications.service';
import { NdyspaceNotificationsController } from './ndyspace-notifications.controller';
import { NdyspaceMailService } from './ndyspace-mail.service';
import { NdyspaceMailController } from './ndyspace-mail.controller';
import { NdyspaceCalendarService } from './ndyspace-calendar.service';
import { NdyspaceCalendarController } from './ndyspace-calendar.controller';
import { NdyspaceDriveStorageService } from './ndyspace-drive-storage.service';
import { NdyspaceDriveService } from './ndyspace-drive.service';
import { NdyspaceDriveController } from './ndyspace-drive.controller';
import { NdyspaceContactsService } from './ndyspace-contacts.service';
import { NdyspaceContactsController } from './ndyspace-contacts.controller';
import { NdyspaceTasksService } from './ndyspace-tasks.service';
import { NdyspaceTasksController } from './ndyspace-tasks.controller';
import { NdyspaceNotesService } from './ndyspace-notes.service';
import { NdyspaceNotesController } from './ndyspace-notes.controller';
import { NdyspaceBookmarksService } from './ndyspace-bookmarks.service';
import { NdyspaceBookmarksController } from './ndyspace-bookmarks.controller';
import { NdyspaceOverviewService } from './ndyspace-overview.service';
import { NdyspaceOverviewController } from './ndyspace-overview.controller';

// One module for the whole NDYSPACE domain (mail/calendar/drive/contacts/
// tasks/notes/bookmarks/notifications) rather than one module per feature —
// they're small enough individually that splitting into eight modules would
// mean eight nearly-identical module files for no real isolation benefit
// (every one of them needs AuthModule for JwtAuthGuard and PrismaModule is
// already global). Each feature still gets its own service/controller/DTO
// files, same granularity as the rest of this codebase, just registered
// together here.
@Module({
  imports: [AuthModule], // for JwtAuthGuard on every controller below
  controllers: [
    NdyspaceOverviewController,
    NdyspaceMailController,
    NdyspaceCalendarController,
    NdyspaceDriveController,
    NdyspaceContactsController,
    NdyspaceTasksController,
    NdyspaceNotesController,
    NdyspaceBookmarksController,
    NdyspaceNotificationsController,
  ],
  providers: [
    NdyspaceOverviewService,
    NdyspaceMailService,
    NdyspaceCalendarService,
    NdyspaceDriveStorageService,
    NdyspaceDriveService,
    NdyspaceContactsService,
    NdyspaceTasksService,
    NdyspaceNotesService,
    NdyspaceBookmarksService,
    NdyspaceNotificationsService,
  ],
  // Exported so ActionEngineModule (Phase 3) can resolve these via
  // ModuleRef — the Action Engine wraps these exact services rather than
  // reimplementing calendar/contact/task/note creation, per
  // docs/action-engine-design.md's "wraps existing domain services, does
  // not reimplement them" rule. Only the four the registry actually calls
  // are exported, not every NDYSPACE service — no reason to widen this
  // module's public surface further than something outside it needs today.
  exports: [
    NdyspaceCalendarService,
    NdyspaceContactsService,
    NdyspaceTasksService,
    NdyspaceNotesService,
  ],
})
export class NdyspaceModule {}
