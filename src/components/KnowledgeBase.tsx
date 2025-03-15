import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Book, Plus, Edit2, Trash2, Search, UserCircle } from 'lucide-react';
import type { KnowledgeBaseItem, ProjectKnowledgeBase } from '../types/project';
import type { User as UserType } from '../types/auth';
import { formatDistance } from 'date-fns';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

interface KnowledgeBaseProps {
  projectId: string;
  currentUser: UserType;
}

export function KnowledgeBase({ projectId, currentUser }: KnowledgeBaseProps) {
  const [entries, setEntries] = useState<KnowledgeBaseItem[]>([]);
  const [memberKnowledge, setMemberKnowledge] = useState<ProjectKnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingEntry, setEditingEntry] = useState<KnowledgeBaseItem | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });

  useEffect(() => {
    fetchEntries();
    fetchMemberKnowledge();
  }, [projectId]);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('project_knowledge_base_entries')
        .select(`
          id,
          project_id,
          title,
          content,
          created_by,
          created_at,
          updated_at,
          author:users(
            id,
            full_name,
            email,
            role,
            status,
            avatar_url,
            mfa_enabled
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching knowledge base entries:', error);
        throw error;
      }

      // Transform the data to match the expected types
      const transformedData: KnowledgeBaseItem[] = (data || []).map((entry: any) => ({
        id: entry.id,
        project_id: entry.project_id,
        title: entry.title,
        content: entry.content,
        created_by: entry.created_by,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
        author: entry.author || null
      }));

      setEntries(transformedData);
    } catch (error: any) {
      console.error('Error fetching knowledge base entries:', error);
      toast.error('Error fetching knowledge base entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberKnowledge = async () => {
    try {
      // First, get project members
      const { data: projectMembers, error: membersError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId);

      if (membersError) throw membersError;

      if (!projectMembers?.length) {
        setMemberKnowledge([]);
        return;
      }

      const memberIds = projectMembers.map(member => member.user_id);

      // Then fetch knowledge base data with user information
      const { data: rawData, error } = await supabase
        .from('project_knowledge_base')
        .select(`
          id,
          project_id,
          user_id,
          notes,
          cv_url,
          skills,
          imported_at,
          created_at,
          updated_at,
          user:users(
            id,
            full_name,
            email,
            role,
            status,
            avatar_url,
            mfa_enabled,
            created_at,
            updated_at
          ),
          education:project_education(
            id, project_id, user_id, institution, degree, field,
            start_date, end_date, description, created_at, updated_at
          ),
          experience:project_experience(
            id, project_id, user_id, company, position,
            start_date, end_date, description, skills, created_at, updated_at
          ),
          interview_results:project_interview_results(
            id, project_id, user_id, date, interviewer, position,
            notes, score, status, created_at, updated_at
          )
        `)
        .eq('project_id', projectId)
        .in('user_id', memberIds);

      if (error) {
        console.error('Error fetching member knowledge:', error);
        throw error;
      }

      // Transform the data to match the expected types
      const transformedData: ProjectKnowledgeBase[] = (rawData || []).map((item: any) => ({
        id: item.id,
        project_id: item.project_id,
        user_id: item.user_id,
        notes: item.notes || '',
        cv_url: item.cv_url,
        skills: item.skills || [],
        imported_at: item.imported_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
        user: item.user || null,
        education: Array.isArray(item.education) ? item.education : [],
        experience: Array.isArray(item.experience) ? item.experience : [],
        interview_results: Array.isArray(item.interview_results) ? item.interview_results : []
      }));

      setMemberKnowledge(transformedData);
    } catch (error: any) {
      console.error('Error fetching member knowledge:', error);
      toast.error('Error fetching member knowledge');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('project_knowledge_base_entries')
        .insert([
          {
            project_id: projectId,
            title: formData.title,
            content: formData.content,
            created_by: currentUser.id,
            updated_at: new Date().toISOString(),
          },
        ]);

      if (error) throw error;
      toast.success('Entry created successfully');
      fetchEntries();
      setShowEditor(false);
      setFormData({ title: '', content: '' });
    } catch (error: any) {
      console.error('Error creating entry:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const { error } = await supabase
        .from('project_knowledge_base_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      toast.success('Entry deleted successfully');
      fetchEntries();
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      toast.error(error.message);
    }
  };

  const filteredEntries = entries.filter(
    entry =>
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Book className="h-6 w-6 text-blue-600" />
          Knowledge Base
        </h2>
        <button
          onClick={() => {
            setEditingEntry(null);
            setFormData({ title: '', content: '' });
            setShowEditor(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          New Entry
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Search knowledge base..."
        />
      </div>

      {/* Team Members Knowledge Base */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Team Members Knowledge</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memberKnowledge.map((member) => (
            <div key={member.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <UserCircle className="h-8 w-8 text-gray-400" />
                <div>
                  <h4 className="font-medium text-gray-900">{member.user?.full_name}</h4>
                  <p className="text-sm text-gray-500">{member.user?.email}</p>
                </div>
              </div>

              {member.skills && member.skills.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Skills</h5>
                  <div className="flex flex-wrap gap-2">
                    {member.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {member.notes && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Notes</h5>
                  <p className="text-sm text-gray-600">{member.notes}</p>
                </div>
              )}

              <div className="text-sm text-gray-500">
                Imported {formatDistance(new Date(member.imported_at), new Date(), { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Knowledge Base Entries */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Project Knowledge Base</h3>
        {showEditor ? (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg shadow-md p-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Content (Markdown)</label>
              <textarea
                required
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={10}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingEntry ? 'Update Entry' : 'Create Entry'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{entry.title}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingEntry(entry);
                        setFormData({
                          title: entry.title,
                          content: entry.content,
                        });
                        setShowEditor(true);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="prose max-w-none">
                  <ReactMarkdown>{entry.content}</ReactMarkdown>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                  Created by {entry.author?.full_name} •{' '}
                  <span>Created {formatDistance(new Date(entry.created_at), new Date(), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 