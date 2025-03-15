import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from URL or storage
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (session) {
          const isGoogleAuth = session.user.app_metadata.provider === 'google';
          
          // Get user profile
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            throw profileError;
          }

          // If profile doesn't exist or is Google auth, update with admin role
          if (!profile || isGoogleAuth) {
            const userData = {
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '',
              role: 'admin',
              status: 'active',
              avatar_url: session.user.user_metadata?.avatar_url,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            // Update user metadata
            if (supabaseAdmin) {
              await supabaseAdmin.auth.admin.updateUserById(
                session.user.id,
                { user_metadata: { ...session.user.user_metadata, role: 'admin', status: 'active' } }
              );
            }

            // Update or insert user profile
            const { error: upsertError } = await supabase
              .from('users')
              .upsert(userData);

            if (upsertError) throw upsertError;

            // Wait a moment for the changes to propagate
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          toast.success('Successfully signed in!');
          navigate('/', { replace: true });
        } else {
          // No session found
          toast.error('Authentication failed');
          navigate('/login', { replace: true });
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        toast.error(error.message || 'Authentication failed');
        navigate('/login', { replace: true });
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
} 