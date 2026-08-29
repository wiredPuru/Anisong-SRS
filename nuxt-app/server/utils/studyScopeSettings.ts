import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.ts";
import { studyScopeSetting } from "../db/schema.ts";
import type { StudyScope } from "./cards.ts";

export type QuizMode = "auto" | "audioOnly" | "videoOnly";

function scopeCondition(scope: StudyScope) {
  const scopeId = scope.type === "all" ? null : scope.id;
  return and(
    eq(studyScopeSetting.scopeType, scope.type),
    scopeId === null ? isNull(studyScopeSetting.scopeId) : eq(studyScopeSetting.scopeId, scopeId),
  );
}

export function getScopeMode(scope: StudyScope): QuizMode {
  const row = db.select({ mode: studyScopeSetting.mode }).from(studyScopeSetting).where(scopeCondition(scope)).get();
  return row?.mode ?? "auto";
}

export function setScopeMode(scope: StudyScope, mode: QuizMode): QuizMode {
  const existing = db.select({ id: studyScopeSetting.id }).from(studyScopeSetting).where(scopeCondition(scope)).get();

  if (existing) {
    db.update(studyScopeSetting).set({ mode }).where(eq(studyScopeSetting.id, existing.id)).run();
  } else {
    db.insert(studyScopeSetting)
      .values({ scopeType: scope.type, scopeId: scope.type === "all" ? null : scope.id, mode })
      .run();
  }

  return mode;
}
