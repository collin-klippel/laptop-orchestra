import { describe, expect, it } from 'vitest';
import { joinRoleFromSearch } from './joinRole';

describe('joinRoleFromSearch', () => {
  it('treats empty or bare ? as performer', () => {
    expect(joinRoleFromSearch('')).toBe('performer');
    expect(joinRoleFromSearch('?')).toBe('performer');
  });

  it('defaults to performer without role param', () => {
    expect(joinRoleFromSearch('?x=1')).toBe('performer');
  });

  it('returns conductor only for role=conductor', () => {
    expect(joinRoleFromSearch('?role=conductor')).toBe('conductor');
    expect(joinRoleFromSearch('role=conductor')).toBe('conductor');
  });

  it('treats other role values as performer', () => {
    expect(joinRoleFromSearch('?role=foo')).toBe('performer');
    expect(joinRoleFromSearch('?role=CONDUCTOR')).toBe('performer');
  });

  it('ignores unrelated params alongside conductor role', () => {
    expect(joinRoleFromSearch('?role=conductor&x=1')).toBe('conductor');
  });
});
