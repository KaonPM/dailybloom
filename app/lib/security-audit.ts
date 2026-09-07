export type SecurityAuditEntry = {
  actor_id: string;
  actor_name: string | null;
  actor_role: string;
  school_id: number | null;
  action: string;
  target_type?: string;
  target_id?: string;
  details: Record<string, unknown>;
};

type AuditInsertResult = { error: { message: string } | null };
export type SecurityAuditInsert = (
  entry: SecurityAuditEntry
) => PromiseLike<AuditInsertResult>;

/**
 * Makes audit persistence an explicit success condition for security-sensitive
 * server mutations. Supabase returns insert errors as data rather than throws.
 */
export async function persistSecurityAudit(
  entry: SecurityAuditEntry,
  insert: SecurityAuditInsert
) {
  const { error } = await insert(entry);
  if (error) {
    throw new Error(`Security audit write failed: ${error.message}`);
  }
}
