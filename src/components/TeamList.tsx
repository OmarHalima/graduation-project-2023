import { User } from '../types/auth';
import { ProjectMember } from '../types/project';
import { UserCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface TeamListProps {
  projectId: string;
  members: ProjectMember[];
  onUpdate: () => void;
  canManageTeam: boolean;
}

export function TeamList({ projectId, members, onUpdate, canManageTeam }: TeamListProps) {
  const handleRemoveMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .match({ project_id: projectId, user_id: userId });

      if (error) throw error;

      toast.success('Team member removed');
      onUpdate();
    } catch (error: any) {
      toast.error('Error removing team member');
      console.error('Error:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Team Members</h3>
      
      <div className="space-y-4">
        {members.length === 0 ? (
          <p className="text-gray-500 text-sm">No team members assigned yet.</p>
        ) : (
          members.map(member => (
            <div 
              key={member.user_id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <UserCircle className="h-8 w-8 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">
                    {member.user?.full_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {member.user?.email}
                  </p>
                </div>
                <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {member.role}
                </span>
              </div>

              {canManageTeam && (
                <button
                  onClick={() => handleRemoveMember(member.user_id)}
                  className="text-gray-400 hover:text-red-500"
                  title="Remove member"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
} 