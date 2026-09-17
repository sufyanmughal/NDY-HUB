-- docs/ndymail-architecture-design.md §2: "new mail fires through the
-- existing NotificationService.notify()... no separate notification
-- stack." This was designed but never actually wired up in the earlier
-- deploy — closing that gap now. Purely additive enum value.

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'NDYMAIL';
