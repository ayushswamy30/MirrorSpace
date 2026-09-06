import { useContext } from 'react';
import { UserContext } from './UserContextValue.js';

/** Session, app profile, the authenticated axios instance, and the auth actions. */
export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
}
