import type { Role } from '@laptop-orchestra/shared';

/** Conductor iff `role=conductor` exactly. */
export function joinRoleFromSearch(search: string): Role {
  const trimmed = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(trimmed);
  return params.get('role') === 'conductor' ? 'conductor' : 'performer';
}
