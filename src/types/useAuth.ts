import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { User, AuthState } from './auth';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const user: User = {
          id: session.user.id,
          email: session.user.email!,
          full_name: session.user.user_metadata.full_name,
          role: session.user.user_metadata.role,
          status: session.user.user_metadata.status,
        };
        setAuthState({ user, session, loading: false });
      } else {
        setAuthState({ user: null, session: null, loading: false });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const user: User = {
          id: session.user.id,
          email: session.user.email!,
          full_name: session.user.user_metadata.full_name,
          role: session.user.user_metadata.role,
          status: session.user.user_metadata.status,
        };
        setAuthState({ user, session, loading: false });
      } else {
        setAuthState({ user: null, session: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return authState;
} 