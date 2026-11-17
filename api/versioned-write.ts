// xmin changes for every PostgreSQL row update, including notification actions.
// It supplies an opaque comparison token without adding or backfilling columns.
export function versionedWrite(
  table: 'tasks' | 'user_settings' | 'workout_state' | 'diet_state',
  id: string | number,
  insert: Record<string, unknown>,
  changes: Record<string, unknown>,
  version: string | null | undefined
) {
  const parameters: unknown[] = [id];
  const parameter = (value: unknown) => { parameters.push(value); return `$${parameters.length}`; };
  // Identifiers come exclusively from the fixed server-side column maps.
  if (typeof version === 'string') {
    const assignments = Object.entries(changes).map(([key, value]) => `${key}=${parameter(value)}`);
    return { parameters, query: `UPDATE ${table} SET ${assignments.join(',')} WHERE id=$1 AND xmin::text=${parameter(version)} RETURNING *,xmin::text AS version` };
  }
  const entries = Object.entries(insert);
  const values = entries.map(([, value]) => parameter(value));
  const conflict = version === null ? 'DO NOTHING' : `DO UPDATE SET ${Object.entries(changes)
    .map(([key, value]) => `${key}=${parameter(value)}`).join(',')}`;
  return { parameters, query: `INSERT INTO ${table}(id,${entries.map(([key]) => key).join(',')}) VALUES($1,${values.join(',')}) ON CONFLICT(id) ${conflict} RETURNING *,xmin::text AS version` };
}

export function expectedVersion(header: string | undefined): string | null | undefined {
  return header === 'absent' ? null : header;
}
