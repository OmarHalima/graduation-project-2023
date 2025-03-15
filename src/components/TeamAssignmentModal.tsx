import React, { useState, useEffect } from 'react';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { X, Search, UserPlus, UserMinus } from 'lucide-react';
import type { User } from '../types/auth';
import type { Education, Experience, InterviewResult } from '../types/knowledgeBase';
import toast from 'react-hot-toast';

interface TeamAssignmentModalProps {
  projectId: string;
  currentMembers: { user_id: string; role: string }[];
  onClose: () => void;
  onUpdate: () => void;
}

export function TeamAssignmentModal({ projectId, currentMembers, onClose, onUpdate }: TeamAssignmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [projectManagers, setProjectManagers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'full_name' | 'email' | 'role'>('full_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Change this to use a Map for better performance
  const [memberMap, setMemberMap] = useState<Map<string, string>>(
    new Map(currentMembers.map(m => [m.user_id, m.role]))
  );

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Fetched users:', data);
      setUsers(data || []);

      // Filter users into admins and project managers
      const filteredAdmins = data?.filter(user => user.role === 'admin') || [];
      const filteredProjectManagers = data?.filter(user => user.role === 'project_manager') || [];
      
      setAdmins(filteredAdmins);
      setProjectManagers(filteredProjectManagers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Error fetching users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (loading) return;
    
    try {
      setLoading(true);
      
      // First, fetch the user's knowledge base data
      const { data: knowledgeBaseData, error: knowledgeBaseError } = await supabase
        .from('knowledge_base')
        .select(`
          *,
          education (*),
          experience (*),
          interview_results (*)
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (knowledgeBaseError && !knowledgeBaseError.message.includes('No rows found')) {
        throw knowledgeBaseError;
      }

      // Add the member to the project
      const { error: memberError } = await supabase
        .from('project_members')
        .insert([{ 
          project_id: projectId, 
          user_id: userId, 
          role: 'member' 
        }]);

      if (memberError) {
        if (memberError.message.includes('duplicate key')) {
          throw new Error('User is already a member of this project');
        }
        throw memberError;
      }

      // If the user has knowledge base data, copy it to the project knowledge base
      if (knowledgeBaseData) {
        // Create a project knowledge base entry
        const { error: projectKbError } = await supabase
          .from('project_knowledge_base')
          .insert([{
            project_id: projectId,
            user_id: userId,
            notes: knowledgeBaseData.notes || '',
            cv_url: knowledgeBaseData.cv_url || '',
            skills: knowledgeBaseData.skills || [],
            imported_at: new Date().toISOString()
          }]);

        if (projectKbError) throw projectKbError;

        // Copy education records if they exist
        if (knowledgeBaseData.education && knowledgeBaseData.education.length > 0) {
          const educationRecords = knowledgeBaseData.education.map((edu: Education) => ({
            ...edu,
            project_id: projectId,
            user_id: userId
          }));
          const { error: eduError } = await supabase
            .from('project_education')
            .insert(educationRecords);
          if (eduError) throw eduError;
        }

        // Copy experience records if they exist
        if (knowledgeBaseData.experience && knowledgeBaseData.experience.length > 0) {
          const experienceRecords = knowledgeBaseData.experience.map((exp: Experience) => ({
            ...exp,
            project_id: projectId,
            user_id: userId
          }));
          const { error: expError } = await supabase
            .from('project_experience')
            .insert(experienceRecords);
          if (expError) throw expError;
        }

        // Copy interview results if they exist
        if (knowledgeBaseData.interview_results && knowledgeBaseData.interview_results.length > 0) {
          const interviewRecords = knowledgeBaseData.interview_results.map((interview: InterviewResult) => ({
            ...interview,
            project_id: projectId,
            user_id: userId
          }));
          const { error: interviewError } = await supabase
            .from('project_interview_results')
            .insert(interviewRecords);
          if (interviewError) throw interviewError;
        }
      }

      setMemberMap(new Map(memberMap.set(userId, 'member')));
      toast.success('Team member added successfully');
      onUpdate();
    } catch (error: any) {
      console.error('Error adding member:', error);
      toast.error('Error adding member: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (loading) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('project_members')
        .delete()
        .match({ project_id: projectId, user_id: userId });

      if (error) throw error;

      const newMap = new Map(memberMap);
      newMap.delete(userId);
      setMemberMap(newMap);
      toast.success('Team member removed');
      onUpdate();
    } catch (error: any) {
      toast.error('Error removing member: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort users
  const filteredAndSortedUsers = users
    .filter(user => {
      const matchesSearch = 
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'full_name') {
        return (a.full_name || '').localeCompare(b.full_name || '') * direction;
      }
      if (sortField === 'email') {
        return a.email.localeCompare(b.email) * direction;
      }
      return (a.role || '').localeCompare(b.role || '') * direction;
    });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Manage Team Members</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border rounded-lg"
                />
              </div>
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border rounded-lg px-4 py-2"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="project_manager">Project Manager</option>
              <option value="employee">Employee</option>
            </select>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{user.role}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {memberMap.has(user.id) ? (
                        <button
                          onClick={() => handleRemoveMember(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddMember(user.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Add
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 