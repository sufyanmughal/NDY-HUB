import { ActionRiskTier } from '@prisma/client';
import type { ModuleRef } from '@nestjs/core';
import { CreateCalendarEventDto } from '../ndyspace/dto/calendar.dto';
import { CreateContactDto } from '../ndyspace/dto/contact.dto';
import { CreateTaskDto } from '../ndyspace/dto/task.dto';
import { CreateNoteDto } from '../ndyspace/dto/note.dto';
import { NdyspaceCalendarService } from '../ndyspace/ndyspace-calendar.service';
import { NdyspaceContactsService } from '../ndyspace/ndyspace-contacts.service';
import { NdyspaceTasksService } from '../ndyspace/ndyspace-tasks.service';
import { NdyspaceNotesService } from '../ndyspace/ndyspace-notes.service';

/**
 * v1's registered actions — deliberately small (4), per
 * docs/action-engine-design.md §7: "enough to validate the contract
 * against real code, not a speculative full catalog." Each entry wraps an
 * existing, already-built domain service method unchanged — the Action
 * Engine adds a request/approval/audit envelope around it, it does not
 * reimplement it.
 *
 * `dto` is the exact same class-validator DTO the corresponding
 * controller already uses — Validate (see ActionEngineService) runs the
 * same checks a normal HTTP request would hit, just earlier in this
 * pipeline.
 *
 * The design doc's own example list named "ndyspace.file.share" as the
 * fourth action, but no sharing/ACL capability exists anywhere in
 * NDYSPACE yet (confirmed — there is nothing to wrap). Substituted
 * "note.create" instead: same LOW-risk shape, genuinely real code,
 * keeps the doc's intent (prove the pattern against real services)
 * rather than its literal example.
 */
export interface ActionRegistryEntry {
  actionKey: string;
  label: string;
  domain: string;
  riskTier: ActionRiskTier;
  requiredScopes: string[];
  reversible: boolean;
  reverseActionKey?: string;
  dto: new () => object;
  /** Calls the actual domain service. Receives the already-validated DTO
   * instance and resolves the concrete service via ModuleRef rather than
   * this file taking a hard constructor dependency on every domain
   * service — keeps the registry a plain data module, not itself a huge
   * injectable with a dozen constructor params. */
  execute: (
    moduleRef: ModuleRef,
    userId: string,
    dto: object,
  ) => Promise<unknown>;
}

export const ACTION_REGISTRY: ActionRegistryEntry[] = [
  {
    actionKey: 'calendar.event.create',
    label: 'Create calendar event',
    domain: 'calendar',
    riskTier: ActionRiskTier.MEDIUM,
    requiredScopes: ['calendar'],
    reversible: true,
    reverseActionKey: 'calendar.event.delete',
    dto: CreateCalendarEventDto,
    execute: (moduleRef, userId, dto) =>
      moduleRef
        .get(NdyspaceCalendarService, { strict: false })
        .create(userId, dto as CreateCalendarEventDto),
  },
  {
    actionKey: 'contact.create',
    label: 'Create contact',
    domain: 'contacts',
    riskTier: ActionRiskTier.LOW,
    requiredScopes: ['contacts'],
    reversible: true,
    dto: CreateContactDto,
    execute: (moduleRef, userId, dto) =>
      moduleRef
        .get(NdyspaceContactsService, { strict: false })
        .create(userId, dto as CreateContactDto),
  },
  {
    actionKey: 'task.create',
    label: 'Create task',
    domain: 'tasks',
    riskTier: ActionRiskTier.LOW,
    requiredScopes: ['tasks'],
    reversible: true,
    dto: CreateTaskDto,
    execute: (moduleRef, userId, dto) =>
      moduleRef
        .get(NdyspaceTasksService, { strict: false })
        .create(userId, dto as CreateTaskDto),
  },
  {
    actionKey: 'note.create',
    label: 'Create note',
    domain: 'ndyspace',
    riskTier: ActionRiskTier.LOW,
    requiredScopes: ['ndyspace'],
    reversible: true,
    dto: CreateNoteDto,
    execute: (moduleRef, userId, dto) =>
      moduleRef
        .get(NdyspaceNotesService, { strict: false })
        .create(userId, dto as CreateNoteDto),
  },
];

export function findActionDefinition(
  actionKey: string,
): ActionRegistryEntry | undefined {
  return ACTION_REGISTRY.find((a) => a.actionKey === actionKey);
}
