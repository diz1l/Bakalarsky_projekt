ALTER TABLE "TaskTemplate" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'during';
ALTER TABLE "TaskTemplate" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ShiftTask" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'during';
ALTER TABLE "ShiftTask" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "TaskTemplate" SET "shiftType" = 'ANY', "weekdays" = '', "active" = true;
UPDATE "TaskTemplate"
SET "sortOrder" = (
  SELECT COUNT(*) - 1 FROM "TaskTemplate" AS "other"
  WHERE "other"."section" = "TaskTemplate"."section" AND "other"."id" <= "TaskTemplate"."id"
);
UPDATE "ShiftTask"
SET "section" = (SELECT "section" FROM "TaskTemplate" WHERE "TaskTemplate"."id" = "ShiftTask"."templateId"),
    "sortOrder" = (SELECT "sortOrder" FROM "TaskTemplate" WHERE "TaskTemplate"."id" = "ShiftTask"."templateId")
WHERE "templateId" IS NOT NULL;
