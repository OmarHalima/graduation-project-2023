import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { User, AuthState } from '../../types/auth';

interface AuthContextType {
  user: User | null;
  session: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial Session Check:', {
        hasSession: !!session,
        sessionUser: session?.user,
        timestamp: new Date().toISOString()
      });

      if (session) {
        const now = new Date().toISOString();
        const user: User = {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '',
          role: session.user.user_metadata?.role || 'user',
          status: session.user.user_metadata?.status || 'pending',
          department: session.user.user_metadata?.department || null,
          position: session.user.user_metadata?.position || null,
          avatar_url: session.user.user_metadata?.avatar_url || null,
          created_at: session.user.created_at || now,
          updated_at: session.user.updated_at || now,
          last_login: session.user.last_sign_in_at || null,
          mfa_enabled: session.user.user_metadata?.mfa_enabled || false,
        };
        console.log('User Profile Created:', user);
        setAuthState({ user, session, loading: false });
      } else {
        console.log('No Active Session Found');
        setAuthState({ user: null, session: null, loading: false });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth State Change:', {
        event: _event,
        hasSession: !!session,
        timestamp: new Date().toISOString()
      });

      if (session) {
        const now = new Date().toISOString();
        const user: User = {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '',
          role: session.user.user_metadata?.role || 'user',
          status: session.user.user_metadata?.status || 'pending',
          department: session.user.user_metadata?.department || null,
          position: session.user.user_metadata?.position || null,
          avatar_url: session.user.user_metadata?.avatar_url || null,
          created_at: session.user.created_at || now,
          updated_at: session.user.updated_at || now,
          last_login: session.user.last_sign_in_at || null,
          mfa_enabled: session.user.user_metadata?.mfa_enabled || false,
        };
        console.log('Updated User Profile:', user);
        setAuthState({ user, session, loading: false });
      } else {
        console.log('Session Ended');
        setAuthState({ user: null, session: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 