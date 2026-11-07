CREATE TABLE "ScheduleRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" DATETIME,
  "reviewedBy" TEXT,
  CONSTRAINT "ScheduleRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ScheduleRequest_employeeId_date_key" ON "ScheduleRequest"("employeeId", "date");
CREATE INDEX "ScheduleRequest_date_status_idx" ON "ScheduleRequest"("date", "status");
