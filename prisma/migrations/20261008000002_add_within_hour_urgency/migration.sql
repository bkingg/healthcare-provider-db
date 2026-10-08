-- AlterEnum: "Urgent — within 1 hour", offered when ordering medication.
ALTER TYPE "CaseUrgency" ADD VALUE 'WITHIN_HOUR' BEFORE 'TODAY';
