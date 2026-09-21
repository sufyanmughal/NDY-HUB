-- Failed-login capture (client decision Q6).
--
-- Additive: one new SecurityEventType value. Recorded when a password attempt
-- fails against a real account, so the Trust Score can eventually be weighted on
-- genuine risk signals as well as positive verification. Deliberately NOT scored
-- yet — the locked v1 penalty table does not include it.

-- AlterEnum
ALTER TYPE "SecurityEventType" ADD VALUE 'LOGIN_FAILED';
