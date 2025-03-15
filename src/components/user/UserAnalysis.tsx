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
  position: string;
  duration: string;
  responsibilities: string[];
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
  expiry?: string;
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
  note_text: string;
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

interface AnalysisTemplateData extends UserData {
  // No need to redefine fields as they're already properly defined in UserData
}

interface DatabaseUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  position: string | null;
  status: string;
}

interface DatabaseInterview {
  interview_date: string;
  notes: string;
  result: string;
  interviewer: {
    full_name: string;
  } | null;
}

interface DatabaseNote {
  note: string;
  created_at: string;
  creator: {
    full_name: string;
  } | null;
}

interface DatabaseProject {
  project_name: string;
  role: string;
  start_date: string;
  end_date: string | null;
  responsibilities: string | null;
}

interface CVParsedData {
  education: string;
  work_experience: string;
  skills: string;
  languages: string;
  certifications: string;
}

const UserAnalysis: React.FC<UserAnalysisProps> = ({ userId }) => {
  const { user: currentUser } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingData, setFetchingData] = useState<boolean>(false);

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const fetchUserData = async () => {
    setLoading(true);
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

      if (cvError && cvError.code !== 'PGRST116') throw cvError;

      // Fetch interviews
      const { data: interviewsData, error: interviewsError } = await supabase
          .from('user_interviews')
          .select(`
            interview_date,
            notes,
            result,
            interviewer:interviewer_id(full_name)
          `)
        .eq('user_id', userId)
        .order('interview_date', { ascending: false });

      if (interviewsError) throw interviewsError;

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
          .from('user_projects')
          .select(`
            id,
          project_name,
            role,
            start_date,
            end_date,
            responsibilities
          `)
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch notes
      const { data: notesData, error: notesError } = await supabase
          .from('user_notes')
          .select(`
            id,
            note,
            created_at,
            creator:created_by(full_name)
          `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      // Type assertions
      const typedUserData = userData as DatabaseUser;
      const typedCVData = cvData as CVParsedData | null;
      const typedInterviewsData = (interviewsData || []) as unknown as {
        interview_date: string;
        notes: string;
        result: string;
        interviewer: { full_name: string } | null;
      }[];
      const typedProjectsData = (projectsData || []) as DatabaseProject[];
      const typedNotesData = (notesData || []) as unknown as {
        note: string;
        created_at: string;
        creator: { full_name: string } | null;
      }[];

      // Combine all data
      const combinedData: UserData = {
        ...typedUserData,
        education: typedCVData?.education ? 
          (typeof typedCVData.education === 'string' ? 
            (isJsonString(typedCVData.education) ? 
              JSON.parse(typedCVData.education) : 
              [{ institution: typedCVData.education, degree: '', field: '', year: '' }]
            ) : []
          ) : [],
        experience: typedCVData?.work_experience ? 
          (typeof typedCVData.work_experience === 'string' ? 
            (isJsonString(typedCVData.work_experience) ? 
              JSON.parse(typedCVData.work_experience) : 
              [{ company: typedCVData.work_experience, position: '', duration: '', responsibilities: [] }]
            ) : []
          ) : [],
        skills: typedCVData?.skills ? 
          (typeof typedCVData.skills === 'string' ? 
            (isJsonString(typedCVData.skills) ? 
              JSON.parse(typedCVData.skills) : 
              [{ name: typedCVData.skills, level: '' }]
            ) : []
          ) : [],
        languages: typedCVData?.languages ? 
          (typeof typedCVData.languages === 'string' ? 
            (isJsonString(typedCVData.languages) ? 
              JSON.parse(typedCVData.languages) : 
              [{ language: typedCVData.languages, proficiency: '' }]
            ) : []
          ) : [],
        certifications: typedCVData?.certifications ? 
          (typeof typedCVData.certifications === 'string' ? 
            (isJsonString(typedCVData.certifications) ? 
              JSON.parse(typedCVData.certifications) : 
              [{ name: typedCVData.certifications, issuer: '', year: '' }]
            ) : []
          ) : [],
        interviews: typedInterviewsData.map(interview => ({
          interview_date: interview.interview_date,
          notes: interview.notes,
          result: interview.result,
          interviewer: {
            full_name: interview.interviewer?.full_name || 'Unknown'
          },
          strengths: [],
          areas_for_improvement: []
        })),
        projects: typedProjectsData.map(p => ({
          name: p.project_name,
          description: p.responsibilities || '',
          role: p.role,
          start_date: p.start_date,
          end_date: p.end_date,
          technologies: [],
          outcomes: []
        })),
        notes: typedNotesData.map(n => ({
          note_text: n.note,
          created_at: n.created_at,
          creator: {
            full_name: n.creator?.full_name || 'Unknown'
          },
          category: undefined
        }))
      };

      setUserData(combinedData);
    } catch (error: any) {
      console.error('Error fetching user data:', error);
      toast.error('Error loading user data');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if a string is valid JSON
  const isJsonString = (str: string) => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  const cleanupText = (text: string) => {
    return text
      .replace(/\n+/g, ' ')  // Replace multiple newlines with single space
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim();               // Remove leading/trailing whitespace
  };

  const parseEducation = (edu: string) => {
    const matches = edu.match(/(.+?)\s*-\s*(.+?)\s*\((\d+)\)/);
    if (matches) {
      return {
        institution: matches[1].trim(),
        degree: matches[2].trim(),
        field: "Business Information Systems",
        year: matches[3],
        achievements: []
      };
    }
    return {
      institution: edu,
      degree: "",
      field: "",
      year: "",
      achievements: []
    };
  };

  const parseExperience = (exp: string) => {
    const lines = exp.split('\n').map(line => line.trim()).filter(Boolean);
    const titleMatch = lines[0].match(/(.+?)\s*-\s*(.+)/);
    const dateMatch = lines[1]?.match(/(.+?)\s*-\s*(.+)/);
    
    const responsibilities = lines.slice(2).filter(Boolean).map(cleanupText);

    return {
      company: titleMatch ? titleMatch[1].trim() : "",
      position: titleMatch ? titleMatch[2].trim() : "",
      duration: dateMatch ? `${dateMatch[1].trim()} - ${dateMatch[2].trim()}` : "",
      responsibilities: responsibilities,
      achievements: []
    };
  };

  const parseSkills = (skillsStr: string) => {
    return skillsStr.split('\n')
      .map(skill => skill.trim())
      .filter(Boolean)
      .map(skill => {
        const [name, level] = skill.split('-').map(s => s.trim());
        return {
          name: name,
          level: level || "Not specified",
          category: "Technical"
        };
      });
  };

  const generateAnalysis = async () => {
    setLoading(true);
    try {
      if (!userData) {
        throw new Error('No user data available');
      }

      // Parse experience data properly
      const parsedExperience = userData.experience.map(exp => {
        const expData = parseExperience(exp.company);
        return {
          company: expData.company,
          position: expData.position,
          duration: expData.duration,
          responsibilities: expData.responsibilities,
          achievements: exp.achievements || [],
          impact_metrics: exp.impact_metrics || []
        };
      });

      // Categorize skills
      const categorizedSkills = userData.skills.reduce((acc, skill) => {
        const category = determineSkillCategory(skill.name);
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push({
          name: skill.name,
          level: skill.level || 'Intermediate'
        });
        return acc;
      }, {} as Record<string, any>);

      // Structure the request body
      const analysisRequest = {
        userData: {
          personal_info: {
            name: userData.full_name,
            email: userData.email,
            role: userData.role,
            department: userData.department || 'IT',
            position: userData.position || 'Admin',
            status: userData.status
          },
          education: userData.education.map(edu => ({
            institution: edu.institution,
            degree: edu.degree || 'Bachelor',
            field: edu.field || 'Business Information Systems',
            year: edu.year || '2025',
            achievements: edu.achievements || []
          })),
          professional_experience: parsedExperience,
          technical_skills: {
            data_analysis: categorizedSkills['Data Analysis'] || [],
            programming: categorizedSkills['Programming'] || [],
            databases: categorizedSkills['Databases'] || [],
            analytics: categorizedSkills['Analytics'] || [],
            visualization: categorizedSkills['Visualization'] || [
              { name: 'Power BI', level: 'Proficient' },
              { name: 'Tableau', level: 'Proficient' }
            ]
          },
          soft_skills: categorizedSkills['Soft Skills'] || [],
          languages: userData.languages
            .filter(lang => lang.language && !lang.language.includes('Not Available'))
            .map(lang => ({
              language: lang.language,
              proficiency: lang.proficiency || 'Intermediate',
              certifications: lang.certifications || []
            })),
          certifications: userData.certifications
            .filter(cert => cert.name && !cert.name.includes('Not Available'))
            .map(cert => ({
              name: cert.name,
              issuer: cert.issuer || 'Unknown',
              year: cert.year || new Date().getFullYear().toString(),
              expiry: cert.expiry
            })),
          recent_activity: {
            interviews: userData.interviews.map(int => ({
              date: new Date(int.interview_date).toLocaleDateString(),
              result: int.result,
              interviewer: int.interviewer.full_name,
              notes: cleanupText(int.notes),
              key_observations: int.strengths || [
                'Technical proficiency',
                'Problem-solving skills',
                'Communication ability'
              ],
              areas_for_improvement: int.areas_for_improvement || [
                'Advanced certifications',
                'Project management',
                'Leadership skills'
              ]
            })),
            projects: userData.projects.map(proj => ({
              name: proj.name,
              role: proj.role,
              duration: `${proj.start_date} to ${proj.end_date || 'Present'}`,
              description: cleanupText(proj.description),
              technologies: proj.technologies || [
                'Python',
                'SQL',
                'Power BI',
                'Excel'
              ],
              outcomes: proj.outcomes || [
                'Improved data analysis workflow',
                'Enhanced reporting capabilities',
                'Streamlined processes'
              ]
            })),
            notes: userData.notes.map(note => ({
              date: new Date(note.created_at).toLocaleDateString(),
              content: cleanupText(note.note_text),
              author: note.creator.full_name,
              category: note.category || 'Performance Review'
            }))
          }
        },
        analysis_parameters: {
          focus_areas: [
            'technical_skills',
            'professional_growth',
            'performance_metrics',
            'career_development'
          ],
          depth: 'comprehensive',
          output_format: 'markdown',
          sections: [
            'executive_summary',
            'technical_assessment',
            'professional_experience',
            'skill_analysis',
            'recent_performance',
            'development_recommendations',
            'career_path_suggestions'
          ]
        }
      };

      console.log('Sending analysis request:', JSON.stringify(analysisRequest, null, 2));

      const response = await fetch('http://localhost:3000/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisRequest),
      });

      const responseText = await response.text();
      console.log('Raw API response:', responseText);

      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.details || errorData.error || 'Failed to generate analysis');
        } catch (parseError) {
          throw new Error(`API Error (${response.status}): ${responseText}`);
        }
      }

      try {
        const responseData = JSON.parse(responseText);
        if (typeof responseData.analysis === 'string') {
          setAnalysis(responseData.analysis);
          toast.success('Analysis generated successfully');
        } else {
          throw new Error('Invalid analysis format in response');
        }
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        throw new Error('Failed to parse analysis response');
      }
    } catch (error: any) {
      console.error('Error generating analysis:', error);
      toast.error(error.message || 'Error generating analysis');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine skill category
  const determineSkillCategory = (skillName: string): string => {
    const skillCategories = {
      'Data Analysis': ['Python', 'R', 'Excel', 'SPSS', 'SAS', 'Pandas'],
      'Programming': ['JavaScript', 'TypeScript', 'Java', 'C++', 'PHP'],
      'Databases': ['SQL', 'MongoDB', 'PostgreSQL', 'MySQL'],
      'Analytics': ['Google Analytics', 'Data Mining', 'Statistical Analysis'],
      'Visualization': ['Power BI', 'Tableau', 'D3.js', 'Matplotlib', 'ggplot2'],
      'Soft Skills': ['Communication', 'Leadership', 'Problem Solving', 'Team Work']
    };

    for (const [category, skills] of Object.entries(skillCategories)) {
      if (skills.some(skill => skillName.toLowerCase().includes(skill.toLowerCase()))) {
        return category;
      }
    }
    return 'Other';
  };

  return (
    <Paper elevation={3} sx={{ padding: 3, marginTop: 2 }}>
      <Typography variant="h5" gutterBottom>User Analysis</Typography>
      {fetchingData ? (
        <CircularProgress />
      ) : (
        userData && (
          <Box mb={2}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>Basic Information</Typography>
                <Typography>Name: {userData.full_name}</Typography>
                <Typography>Department: {userData.department}</Typography>
                <Typography>Position: {userData.position}</Typography>
                <Typography>Email: {userData.email}</Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Education & Experience</Typography>
                <Box mb={2}>
                  <Typography variant="subtitle1" color="primary">Education</Typography>
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
                </Box>
                <Box>
                  <Typography variant="subtitle1" color="primary">Work Experience</Typography>
                  <List dense>
                    {userData.experience.map((exp, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`${exp.position} at ${exp.company}`}
                          secondary={exp.duration}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Skills & Qualifications</Typography>
                <Box mb={2}>
                  <Typography variant="subtitle1" color="primary">Skills</Typography>
                  <List dense>
                    {userData.skills.map((skill, index) => (
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
                    {userData.languages.map((lang, index) => (
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
                    {userData.certifications.map((cert, index) => (
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

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>Activity Summary</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4">{userData.interviews.length}</Typography>
                      <Typography color="textSecondary">Interviews</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4">{userData.notes.length}</Typography>
                      <Typography color="textSecondary">Notes</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4">{userData.projects.length}</Typography>
                      <Typography color="textSecondary">Projects</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>

            <Box mt={3}>
              <Button
                variant="contained"
                onClick={generateAnalysis}
                disabled={loading || !userData}
                fullWidth
              >
                {loading ? 'Generating Analysis...' : 'Generate Comprehensive Analysis'}
              </Button>
            </Box>
          </Box>
        )
      )}

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
    </Paper>
  );
};

export default UserAnalysis; 