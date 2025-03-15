import { useState } from 'react';
import { supabaseAdmin } from '../../../lib/supabase';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { User } from '../../types/auth';
import { useAuth } from '../../contexts/auth/AuthContext';

interface DeleteUserModalProps {
  user: User;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteUserModal({ user, onClose, onDeleted }: DeleteUserModalProps) {
  const [loading, setLoading] = useState(false);
  const { user: currentUser, session } = useAuth();

  const handleDelete = async () => {
    setLoading(true);

    try {
      if (!session?.access_token) {
        throw new Error('No active session found');
      }

      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      if (!supabaseAdmin) {
        throw new Error('Admin client not available');
      }

      // Delete user profile using RPC
      const { error: rpcError } = await supabaseAdmin.rpc('delete_user_profile', {
        p_user_id: user.id,
        p_current_user_id: currentUser.id
      });

      if (rpcError) {
        // If RPC fails, try direct deletion as fallback
        const { error: deleteError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', user.id);

        if (deleteError) {
          console.error('Fallback delete error:', deleteError);
          throw deleteError;
        }
      }

      // Delete user from auth
      if (currentUser.role === 'admin') {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (authError) {
          console.error('Error deleting auth user:', authError);
          // Don't throw here as the profile deletion was successful
        }
      }

      toast.success('User deleted successfully');
      onDeleted();
      onClose();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Error deleting user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Delete User</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete the user <span className="font-semibold">{user.full_name}</span>?
            This action cannot be undone.
          </p>

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 