import type { AuthBindings } from './createAuth';
import { createAuth } from './createAuth';

export interface AuthenticatedUser {
  id: string;
}

export async function getAuthenticatedUser(
  bindings: AuthBindings,
  headers: Headers,
): Promise<AuthenticatedUser | null> {
  const session = await createAuth(bindings).api.getSession({ headers });
  return session?.user?.id ? { id: session.user.id } : null;
}
