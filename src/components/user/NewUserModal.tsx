import { useState } from 'react';
import { supabaseAdmin } from '../../../lib/supabase';
import { X, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserRole, UserStatus } from '../../types/auth';
import { useAuth } from '../../contexts/auth/AuthContext';

interface NewUserModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function NewUserModal({ onClose, onCreated }: NewUserModalProps) {
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'employee' as UserRole,
    status: 'active' as UserStatus,
    department: '',
    position: '',
    password: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Get available roles based on current user's role
  const getAvailableRoles = () => {
    if (!currentUser) return ['employee'];

    switch (currentUser.role) {
      case 'admin':
        return ['employee', 'project_manager', 'admin'];
      case 'project_manager':
        return ['employee'];
      default:
        return ['employee'];
    }
  };

  const validatePassword = () => {
    if (formData.password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return false;
    }
    setPasswordError(null);
    return true;
  };

  const canCreateUserWithRole = (creatorRole: string, targetRole: string): boolean => {
    const roleHierarchy = {
      admin: 3,
      project_manager: 2,
      employee: 1
    };

    const creatorRoleLevel = roleHierarchy[creatorRole as keyof typeof roleHierarchy] || 0;
    const targetRoleLevel = roleHierarchy[targetRole as keyof typeof roleHierarchy] || 0;

    // Admin can create any role
    if (creatorRole === 'admin') return true;
    
    // Project managers can only create employees
    if (creatorRole === 'project_manager' && targetRole === 'employee') return true;
    
    // Others can't create users
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword()) {
      return;
    }

    if (!currentUser) {
      toast.error('You must be logged in to create users');
      return;
    }

    if (!canCreateUserWithRole(currentUser.role, formData.role)) {
      toast.error(`You don't have permission to create ${formData.role} users`);
      return;
    }

    setLoading(true);

    try {
      if (!supabaseAdmin) {
        throw new Error('Admin client not available');
      }

      console.log('Creating auth user with data:', {
        email: formData.email,
        role: formData.role,
        full_name: formData.full_name
      });

      // Create auth user with admin rights
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          full_name: formData.full_name,
          role: formData.role,
          status: formData.status,
          department: formData.department,
          position: formData.position
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      console.log('Auth user created successfully:', {
        userId: authData.user.id,
        email: authData.user.email
      });

      // Prepare user profile data
      const userProfileData = {
        id: authData.user.id,
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        status: formData.status,
        department: formData.department || null,
        position: formData.position || null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Attempting to create user profile:', userProfileData);

      // Create user profile in the users table
      const { data: profileData, error: insertError } = await supabaseAdmin
        .from('users')
        .insert(userProfileData)
        .select()
        .single();

      if (insertError) {
        console.error('Insert error details:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });

        // If profile creation fails, try to clean up the auth user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        if (deleteError) {
          console.error('Failed to clean up auth user:', deleteError);
        }

        throw new Error(`Failed to create user profile: ${insertError.message}`);
      }

      console.log('User profile created successfully:', profileData);

      if (forcePasswordChange) {
        console.log('Generating password reset link for:', formData.email);
        const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: formData.email
        });

        if (resetError) {
          console.error('Reset email error:', resetError);
          // Don't throw here, just log the error as the user is already created
        } else {
          console.log('Password reset link generated successfully');
        }
      }

      toast.success(`User ${formData.full_name} created successfully`);
      onCreated();
      onClose();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Create New User</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                minLength={8}
              />
            </div>
          </div>

          {passwordError && (
            <div className="text-red-500 text-sm">{passwordError}</div>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="forcePasswordChange"
              checked={forcePasswordChange}
              onChange={(e) => setForcePasswordChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="forcePasswordChange" className="ml-2 block text-sm text-gray-700">
              Force password change on first login
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {getAvailableRoles().map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Department</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Position</label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 