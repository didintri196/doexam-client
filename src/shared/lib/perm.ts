// Permission codes from apps/server/models/auth/permission.go.
export const Perm = {
  TenantManage: 'tenant.manage',
  UserManage: 'user.manage',
  GroupManage: 'group.manage',
  ItemRead: 'item.read',
  ItemWrite: 'item.write',
  ExamRead: 'exam.read',
  ExamWrite: 'exam.write',
  ExamPublish: 'exam.publish',
  SessionManage: 'session.manage',
  SessionProctor: 'session.proctor',
  GradeWrite: 'grade.write',
  ReportRead: 'report.read',
  AttemptTake: 'attempt.take',
} as const;

export type PermCode = (typeof Perm)[keyof typeof Perm];

/** isStaff: any permission besides taking exams opens the panel. */
export function isStaff(perms: string[]): boolean {
  return perms.some((p) => p !== Perm.AttemptTake);
}

export function isParticipant(perms: string[]): boolean {
  return perms.includes(Perm.AttemptTake);
}
