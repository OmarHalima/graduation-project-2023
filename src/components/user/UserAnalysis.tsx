import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Typography, Box, CircularProgress, Paper, Divider, Grid, List, ListItem, ListItemText } from '@mui/material';
import toast from 'react-hot-toast';

interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
  achievements?: string[];
}

interface Experience {
  company: string;
  role: string;
  start_date: string;
  end_date: string | null;
  description: string;
  responsibilities: string[];
  position?: string;
  duration?: string;
  achievements?: string[];
}

interface Skill {
  name: string;
  level: string;
  category?: string;
}

interface Language {
  language: string;
  proficiency: string;
  certifications?: string[];
}

interface Certification {
  name: string;
  issuer: string;
  year: string;
  expiry?: string | null;
}

interface Interview {
  interview_date: string;
  notes: string;
  result: string;
  interviewer: {
    full_name: string;
  };
  strengths?: string[];
  areas_for_improvement?: string[];
}

interface Note {
  note: string;
  created_at: string;
  creator: {
    full_name: string;
  };
  category?: string;
}

interface Project {
  name: string;
  role: string;
  description: string;
  start_date: string;
  end_date: string | null;
  technologies?: string[];
  outcomes?: string[];
}

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  position: string | null;
  status: string;
  education: Education[];
  experience: Experience[];
  skills: Skill[];
  languages: Language[];
  certifications: Certification[];
  interviews: Interview[];
  notes: Note[];
  projects: Project[];
}

interface UserAnalysisProps {
  userId: string;
}

const UserAnalysis: React.FC<UserAnalysisProps> = ({ userId }) => {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingData, setFetchingData] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchUserData();
    // Get the current authenticated user directly from Supabase
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('Direct session check:', {
          sessionUser: session.user,
          userId: session.user.id
        });
        setCurrentUser(session.user);
      } else {
        console.log('No active session found in direct check');
      }
    };
    getCurrentUser();
  }, [userId]);

  useEffect(() => {
    // Log authentication state when component mounts or auth state changes
    console.log('UserAnalysis component - Auth state:', { 
      isAuthenticated: !!user,
      userId: user?.id,
      viewingUserId: userId,
      currentUserFromState: currentUser?.id
    });
  }, [user, userId, currentUser]);

  const fetchUserData = async () => {
    setFetchingData(true);
    try {
      // Fetch basic user information
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          department,
          position,
          status
        `)
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Fetch CV parsed data
      const { data: cvData, error: cvError } = await supabase
        .from('cv_parsed_data')
        .select('*')
        .eq('user_id', userId)
        .single();

      let parsedEducation = [];
      let parsedExperience = [];
      let parsedSkills = [];
      let parsedLanguages = [];
      let parsedCertifications = [];

      if (cvData) {
        // Parse education
        try {
          if (cvData.education) {
            const eduLines = cvData.education.split('\n');
            for (let i = 0; i < eduLines.length; i += 2) {
              if (eduLines[i] && eduLines[i+1]) {
                const institutionDegree = eduLines[i].split(' - ');
                const institution = institutionDegree[0]?.trim();
                const degree = institutionDegree[1]?.trim();
                
                const fieldYear = eduLines[i+1].match(/(.*)\s*\((\d{4})\)/);
                const field = fieldYear?.[1]?.trim() || '';
                const year = fieldYear?.[2]?.trim() || '';
                
                parsedEducation.push({
                  institution,
                  degree,
                  field,
                  year,
                  achievements: []
                });
              }
            }
          }
        } catch (err) {
          console.error('Error parsing education:', err);
        }
        
        // Parse experience
        try {
          if (cvData.work_experience) {
            const expLines = cvData.work_experience.split('\n');
            let currentExp = null;
            
            for (let i = 0; i < expLines.length; i++) {
              const line = expLines[i].trim();
              if (line.includes(' - ') && !line.startsWith('-')) {
                // This looks like a company - role line
                if (currentExp) {
                  parsedExperience.push(currentExp);
                }
                
                const companyRole = line.split(' - ');
                currentExp = {
                  company: companyRole[0]?.trim(),
                  role: companyRole[1]?.trim(),
                  start_date: '',
                  end_date: '',
                  description: '',
                  responsibilities: [] as string[],
                  position: companyRole[1]?.trim(),
                  duration: ''
                };
              } else if (line.match(/[A-Za-z]+ \d{4} - [A-Za-z]+ \d{4}|[A-Za-z]+ \d{4} - Present/i) && currentExp) {
                // This looks like a date range
                const dates = line.split(' - ');
                currentExp.start_date = dates[0]?.trim();
                currentExp.end_date = dates[1]?.trim();
                currentExp.duration = `${dates[0]?.trim()} - ${dates[1]?.trim()}`;
              } else if (line && currentExp) {
                // This is probably a responsibility or description
                if (line.startsWith('-')) {
                  currentExp.responsibilities.push(line.substring(1).trim());
                } else {
                  if (currentExp.description) {
                    currentExp.description += ' ' + line;
                  } else {
                    currentExp.description = line;
                  }
                }
              }
            }
            
            if (currentExp) {
              parsedExperience.push(currentExp);
            }
          }
        } catch (err) {
          console.error('Error parsing work experience:', err);
        }
        
        // Parse skills
        try {
          if (cvData.skills) {
            const skillLines = cvData.skills.split('\n\n');
            for (const line of skillLines) {
              if (line.trim()) {
                const skillLevel = line.split(' - ');
                const skill = skillLevel[0]?.trim();
                const level = skillLevel[1]?.trim() !== 'Not specified' 
                  ? skillLevel[1]?.trim() 
                  : 'Intermediate';
                
                parsedSkills.push({
                  name: skill,
                  level
                });
              }
            }
          }
        } catch (err) {
          console.error('Error parsing skills:', err);
        }
        
        // Parse languages
        try {
          if (cvData.languages && !cvData.languages.includes('Not Available')) {
            const langLines = cvData.languages.split('\n');
            for (const line of langLines) {
              if (line.trim() && !line.includes('Not Available')) {
                const langLevel = line.split(' - ');
                parsedLanguages.push({
                  language: langLevel[0]?.trim(),
                  proficiency: langLevel[1]?.trim() !== 'Not Available' 
                    ? langLevel[1]?.trim() 
                    : 'Intermediate',
                  certifications: []
                });
              }
            }
          }
        } catch (err) {
          console.error('Error parsing languages:', err);
        }
        
        // Parse certifications
        try {
          if (cvData.certifications && !cvData.certifications.includes('Not Available')) {
            const certLines = cvData.certifications.split('\n');
            for (const line of certLines) {
              if (line.trim() && !line.includes('Not Available')) {
                const certMatch = line.match(/(.*) - (.*) \((.*)\)/);
                if (certMatch) {
                  parsedCertifications.push({
                    name: certMatch[1]?.trim(),
                    issuer: certMatch[2]?.trim(),
                    year: certMatch[3]?.trim(),
                    expiry: null as string | null
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error('Error parsing certifications:', err);
        }
      }

      // Fetch interviews
      const { data: interviewsData, error: interviewsError } = await supabase
          .from('user_interviews')
          .select(`
          id,
            interview_date,
            notes,
            result,
            interviewer:interviewer_id(full_name)
          `)
        .eq('user_id', userId)
        .order('interview_date', { ascending: false });

      if (interviewsError) throw interviewsError;

      // Transform interviews data to match the Interview interface
      const formattedInterviews = interviewsData ? interviewsData.map((interview: any) => ({
        interview_date: interview.interview_date,
        notes: interview.notes,
        result: interview.result,
        interviewer: {
          full_name: interview.interviewer?.full_name || 'Unknown'
        },
        strengths: [],
        areas_for_improvement: []
      })) : [];

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
          .from('user_projects')
          .select(`
            id,
          project_name,
            role,
            start_date,
            end_date,
          responsibilities,
          technologies
          `)
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

      if (projectsError) throw projectsError;

      // Transform projects data to match the Project interface
      const formattedProjects = projectsData ? projectsData.map((project: any) => ({
        name: project.project_name,
        role: project.role,
        description: project.responsibilities?.[0] || '',
        start_date: project.start_date,
        end_date: project.end_date,
        technologies: project.technologies || [],
        outcomes: []
      })) : [];

      // Fetch notes
      const { data: notesData, error: notesError } = await supabase
          .from('user_notes')
          .select(`
            id,
            note,
          category,
            created_at,
            creator:created_by(full_name)
          `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      // Transform notes data to match the Note interface
      const formattedNotes = notesData ? notesData.map((noteItem: any) => ({
        note: noteItem.note,
        created_at: noteItem.created_at,
        creator: {
          full_name: noteItem.creator?.full_name || 'Unknown'
        },
        category: noteItem.category || ''
      })) : [];

      // Check if there's already an analysis in the user_analysis table
      const { data: existingAnalysis, error: analysisError } = await supabase
        .from('user_analysis')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      // Combine all the data
      const combinedUserData = {
        ...userData,
        education: parsedEducation.length > 0 ? parsedEducation : [
          {
            institution: 'University Name',
            degree: 'Bachelor',
            field: 'Field of Study',
            year: '2025',
            achievements: []
          }
        ],
        experience: parsedExperience,
        skills: parsedSkills,
        languages: parsedLanguages.length > 0 ? parsedLanguages : [
          {
            language: 'English',
            proficiency: 'Fluent',
            certifications: []
          }
        ],
        certifications: parsedCertifications,
        interviews: formattedInterviews,
        projects: formattedProjects,
        notes: formattedNotes
      } as unknown as UserData;

      setUserData(combinedUserData);
      
      // If there's an existing analysis, use it
      if (existingAnalysis && existingAnalysis.length > 0) {
        setAnalysis(existingAnalysis[0].analysis_text);
      }
      
      setFetchingData(false);
    } catch (error: any) {
      console.error('Error fetching user data:', error);
      toast.error(error.message || 'Error fetching user data');
      setFetchingData(false);
    }
  };

  const generateAnalysis = async () => {
    setLoading(true);
    try {
      if (!userData) {
        throw new Error('No user data available');
      }

      // Get the current session directly
      const { data: { session } } = await supabase.auth.getSession();
      const authenticatedUser = session?.user || user || currentUser;

      // Log authentication state before checking
      console.log('Generate Analysis - Auth state check:', { 
        isAuthenticated: !!authenticatedUser,
        userId: authenticatedUser?.id,
        viewingUserId: userId,
        sessionExists: !!session
      });

      if (!authenticatedUser || !authenticatedUser.id) {
        console.error('No authenticated user found');
        toast.error('You must be logged in to generate an analysis');
        setLoading(false);
        return;
      }

      // Query the Supabase user_analysis table to see if there's an existing analysis
      const { data: existingAnalysis, error: analysisError } = await supabase
        .from('user_analysis')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (analysisError) throw analysisError;

      let analysisText = '';

      // If no existing analysis, create a new one
      if (!existingAnalysis || existingAnalysis.length === 0) {
        // Build a reasonable analysis based on the available data
        const strengths = [];
        const weaknesses = [];
        const recommendations = [];

        // Add some strengths based on skills
        if (userData.skills && userData.skills.length > 0) {
          for (const skill of userData.skills) {
            if (skill.level === 'Advanced' || skill.level === 'Proficient') {
              strengths.push(`Strong ${skill.name} capabilities`);
            }
            if (skill.level === 'Beginner' || skill.level === 'Intermediate') {
              weaknesses.push(`Could improve ${skill.name} skills`);
              recommendations.push(`Further training in ${skill.name}`);
            }
          }
        }

        // Add education-based strengths
        if (userData.education && userData.education.length > 0) {
          strengths.push(`Strong educational background in ${userData.education[0].field}`);
        }

        // Add experience-based strengths
        if (userData.experience && userData.experience.length > 0) {
          strengths.push(`Relevant experience at ${userData.experience[0].company}`);
        }

        // Limit arrays to 5 items each
        const uniqueStrengths = [...new Set(strengths)].slice(0, 5);
        const uniqueWeaknesses = [...new Set(weaknesses)].slice(0, 5);
        const uniqueRecommendations = [...new Set(recommendations)].slice(0, 5);

        // Build the analysis text
        analysisText = `# User Analysis Report

## Executive Summary
${userData.full_name} is a ${userData.position || 'professional'} with skills in ${userData.skills?.map(s => s.name).slice(0, 3).join(', ') || 'various areas'}.

## Technical Assessment
${userData.full_name} has demonstrated technical abilities in various domains, particularly in ${userData.skills?.slice(0, 3).map(s => s.name).join(', ') || 'technical skills'}.

## Professional Experience
${userData.experience && userData.experience.length > 0 
  ? `Has worked at ${userData.experience.map(e => e.company).join(', ')}, gaining valuable experience in ${userData.experience[0].role || userData.experience[0].position || 'their field'}.` 
  : 'Limited professional experience information available.'}

## Skill Analysis
${uniqueStrengths.map(s => `- ${s}`).join('\n')}

## Recent Performance
${userData.notes && userData.notes.length > 0
  ? `Recent notes indicate ${userData.notes[0].note?.substring(0, 100)}...`
  : 'No recent performance data available.'}

## Development Recommendations
${uniqueRecommendations.map(r => `- ${r}`).join('\n')}

## Career Path Suggestions
Based on the available skills and experience, potential career paths include:
- Data Analyst
- Business Intelligence Specialist
- Project Coordinator`;

        try {
          console.log('Inserting analysis for user:', userId);
          console.log('Current authenticated user:', authenticatedUser.id);
          
          // Try to insert the analysis into the user_analysis table
          const { data: newAnalysis, error: insertError } = await supabase
            .from('user_analysis')
            .insert({
              user_id: userId,
              analysis_text: analysisText,
              strengths: uniqueStrengths,
              weaknesses: uniqueWeaknesses,
              recommendations: uniqueRecommendations,
              created_by: authenticatedUser.id
            })
            .select()
            .single();

          if (insertError) {
            console.warn('Could not save analysis to database:', insertError.message);
            // Continue with the analysis in local state even if we can't save it
            setAnalysis(analysisText);
            toast.success('Analysis generated successfully (not saved to database)');
          } else {
            setAnalysis(analysisText);
            toast.success('Analysis generated and saved successfully');
          }
        } catch (insertError: any) {
          console.warn('Error saving analysis to database:', insertError.message);
          // Continue with the analysis in local state even if we can't save it
          setAnalysis(analysisText);
          toast.success('Analysis generated successfully (not saved to database)');
        }
      } else {
        // Use the existing analysis
        setAnalysis(existingAnalysis[0].analysis_text);
        toast.success('Retrieved existing analysis');
      }
    } catch (error: any) {
      console.error('Error generating analysis:', error);
      toast.error(error.message || 'Error generating analysis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 3, mt: 2 }}>
      {fetchingData ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
        </Box>
      ) : !userData ? (
        <Typography>No user data available</Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5">User Analysis</Typography>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={generateAnalysis}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Generate Analysis'}
            </Button>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
            <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>User Information</Typography>
              <Typography><strong>Name:</strong> {userData.full_name}</Typography>
              <Typography><strong>Position:</strong> {userData.position || 'N/A'}</Typography>
              <Typography><strong>Department:</strong> {userData.department || 'N/A'}</Typography>
              <Typography><strong>Status:</strong> {userData.status || 'N/A'}</Typography>
              </Grid>

              <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Education</Typography>
                  <List dense>
                    {userData.education.map((edu, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`${edu.degree} in ${edu.field}`}
                          secondary={`${edu.institution} (${edu.year})`}
                        />
                      </ListItem>
                    ))}
                  </List>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Experience</Typography>
                  <List dense>
                {userData.experience && userData.experience.map((exp, index) => (
                      <ListItem key={index}>
                        <ListItemText
                      primary={`${exp.role || exp.position || 'Role'} at ${exp.company}`}
                      secondary={`${exp.start_date || ''} to ${exp.end_date || 'Present'}`}
                        />
                      </ListItem>
                    ))}
                  </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Skills & Qualifications</Typography>
                <Box mb={2}>
                  <Typography variant="subtitle1" color="primary">Skills</Typography>
                  <List dense>
                  {userData.skills && userData.skills.map((skill, index) => (
                      <ListItem key={index}>
                        <ListItemText 
                          primary={skill.name}
                          secondary={`Level: ${skill.level}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
                <Box mb={2}>
                  <Typography variant="subtitle1" color="primary">Languages</Typography>
                  <List dense>
                  {userData.languages && userData.languages.map((lang, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`${lang.language}: ${lang.proficiency}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
                <Box>
                  <Typography variant="subtitle1" color="primary">Certifications</Typography>
                  <List dense>
                  {userData.certifications && userData.certifications.map((cert, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={cert.name}
                          secondary={`${cert.issuer} (${cert.year})`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Grid>
            </Grid>

      {analysis && (
        <Box mt={4}>
          <Typography variant="h6" gutterBottom>Analysis Result</Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{
            whiteSpace: 'pre-line',
            '& .section-header': {
              fontWeight: 'bold',
              fontSize: '1.2rem',
              color: 'primary.main',
              mt: 3,
              mb: 2,
              display: 'flex',
              alignItems: 'center',
            }
          }}>
            {analysis}
          </Box>
        </Box>
          )}
        </>
      )}
    </Paper>
  );
};

export default UserAnalysis; 