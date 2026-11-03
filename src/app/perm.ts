import { useAuth } from '@/shared/auth/auth';
import { Perm } from '@/shared/lib/perm';

export { Perm };

/** useCan answers permission questions for the signed-in staff member. */
export function useCan() {
  const { me } = useAuth();
  const perms = new Set(me?.permissions ?? []);
  const can = (...any: string[]) => any.some((p) => perms.has(p));
  return can;
}
