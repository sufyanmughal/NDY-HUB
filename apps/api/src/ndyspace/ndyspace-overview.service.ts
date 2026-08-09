import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NdyspaceMailService } from './ndyspace-mail.service';
import { NdyspaceCalendarService } from './ndyspace-calendar.service';
import { NdyspaceDriveService } from './ndyspace-drive.service';
import { NdyspaceContactsService } from './ndyspace-contacts.service';
import { NdyspaceTasksService } from './ndyspace-tasks.service';
import { NdyspaceNotificationsService } from './ndyspace-notifications.service';
import { EmailFolder, TaskStatus } from '@prisma/client';

const WIDGET_LIST_LIMIT = 5;

/**
 * Backs the Overview/dashboard-home page (§2.3-2.11 of the spec) — one
 * aggregate call so the page isn't firing eight separate requests on
 * mount. Each field below maps directly to one widget in the reference
 * screenshot's layout.
 */
@Injectable()
export class NdyspaceOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: NdyspaceMailService,
    private readonly calendar: NdyspaceCalendarService,
    private readonly drive: NdyspaceDriveService,
    private readonly contacts: NdyspaceContactsService,
    private readonly tasks: NdyspaceTasksService,
    private readonly notifications: NdyspaceNotificationsService,
  ) {}

  async getOverview(userId: string) {
    const [
      unreadMailCount,
      recentMail,
      upcomingEvents,
      driveFolders,
      recentFiles,
      storageUsage,
      recentContacts,
      openTasks,
      completedTasks,
      unreadNotificationCount,
      recentNotifications,
    ] = await Promise.all([
      this.mail.unreadCount(userId),
      this.mail
        .listFolder(userId, EmailFolder.INBOX)
        .then((rows) => rows.slice(0, WIDGET_LIST_LIMIT)),
      this.calendar.listUpcoming(userId, WIDGET_LIST_LIMIT),
      this.drive
        .listFolders(userId)
        .then((rows) => rows.slice(0, WIDGET_LIST_LIMIT)),
      this.drive
        .listRecentFiles(userId)
        .then((rows) => rows.slice(0, WIDGET_LIST_LIMIT)),
      this.drive.getStorageUsage(userId),
      this.contacts.listRecent(userId, WIDGET_LIST_LIMIT),
      this.tasks
        .listByStatus(userId, TaskStatus.OPEN)
        .then((rows) => rows.slice(0, WIDGET_LIST_LIMIT)),
      this.tasks
        .listByStatus(userId, TaskStatus.COMPLETED)
        .then((rows) => rows.slice(0, WIDGET_LIST_LIMIT)),
      this.notifications.unreadCount(userId),
      this.notifications
        .list(userId)
        .then((rows) => rows.slice(0, WIDGET_LIST_LIMIT)),
    ]);

    return {
      unreadMailCount,
      upcomingEventCount: upcomingEvents.length,
      mail: recentMail,
      calendar: upcomingEvents,
      drive: { folders: driveFolders, recentFiles, storage: storageUsage },
      contacts: recentContacts,
      tasks: { open: openTasks, completed: completedTasks },
      notifications: {
        unreadCount: unreadNotificationCount,
        recent: recentNotifications,
      },
    };
  }

  /** Mini calendar widget (§2.6) — dot indicators for every date in the
   * given month that has at least one event, sharing CalendarEvent as its
   * data source (no separate "has events" model). */
  async getMonthEventDates(userId: string, year: number, month: number) {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));
    const events = await this.prisma.calendarEvent.findMany({
      where: { userId, startAt: { gte: from, lt: to } },
      select: { startAt: true },
    });
    const dates = new Set(
      events.map((e) => e.startAt.toISOString().slice(0, 10)),
    );
    return { dates: Array.from(dates) };
  }
}
