import { createContext } from 'react';

/** Shared context object. Kept apart from the provider so Fast Refresh works. */
export const UserContext = createContext(null);
