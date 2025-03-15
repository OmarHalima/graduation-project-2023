import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase'; // Adjusted path to supabase.js or supabase.ts
import { toast } from 'react-hot-toast';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Add environment variables type declaration
declare global {
    interface ImportMeta {
        readonly env: ImportMetaEnv;
    }
    
    interface ImportMetaEnv {
        VITE_GEMINI_API_KEY: string;
    }
}

interface CV {
    file_url: string;
    file_name: string;
}

interface ParsedCVData {
    user_id: string;
    education: string;
    work_experience: string;
    skills: string;
    languages: string;
    certifications: string;
}

const CVSection = ({ userId, canEdit, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [currentCV, setCurrentCV] = useState<CV | null>(null);
    const [parsedData, setParsedData] = useState<ParsedCVData | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

    useEffect(() => {
        fetchCurrentCV();
        fetchParsedCVData();
    }, [userId]);

    const fetchParsedCVData = async () => {
        try {
            const { data, error } = await supabase
                .from('cv_parsed_data')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error('Error fetching parsed CV data:', error);
                return;
            }

            if (data) {
                setParsedData(data as ParsedCVData);
            }
        } catch (error) {
            console.error('Error fetching parsed CV data:', error);
        }
    };

    const fetchCurrentCV = async () => {
        try {
            console.log('Fetching CV for user:', userId);
            const { data, error } = await supabase
                .from('user_cvs')
                .select('file_url, file_name')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Error fetching CV:', error);
                toast.error('Error loading CV');
                return;
            }

            console.log('Fetched CV data:', data);
            if (data) {
                setCurrentCV(data as CV);
            } else {
                console.warn('No CV found for this user.');
                setCurrentCV(null);
            }
        } catch (error) {
            console.error('Error fetching CV:', error);
            toast.error('Error loading CV');
        }
    };

    const handleDeleteCV = async () => {
        if (!currentCV) {
            toast.error('No CV available to delete.');
            return;
        }

        if (!confirm('Are you sure you want to delete this CV? This action cannot be undone.')) return;

        setLoading(true);
        try {
            const { error: deleteError } = await supabase.rpc('delete_cv', {
                user_id: userId,
                file_url: currentCV.file_url
            });

            if (deleteError) {
                console.error('Error deleting CV record:', deleteError.message);
                toast.error('Failed to delete CV record: ' + deleteError.message);
                return;
            }

            toast.success('CV deleted successfully');
            setCurrentCV(null);
            fetchCurrentCV();
        } catch (error: any) {
            console.error('Unexpected error deleting CV:', error);
            toast.error('An unexpected error occurred while deleting the CV. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleParseCV = async (file: File) => {
        try {
            // Convert the file to text
            const text = await file.text();
            
            // Create a prompt for CV parsing
            const prompt = `Please analyze this CV and extract the following information. For each section, provide a well-formatted text response (not JSON):

1. Education: List all educational qualifications with institutions and dates
2. Work Experience: List all work experiences with company names, positions, and dates
3. Skills: List all technical and professional skills
4. Languages: List all language proficiencies
5. Certifications: List all professional certifications and achievements

CV Content:
${text}

Please provide each section separately, maintaining proper formatting and structure.`;

            // Get the generative model
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            
            // Generate content
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const parsedText = response.text();
            
            // Split the response into sections
            const sections = parsedText.split(/\d\.\s+/);
            
            // Prepare data for database
            const cvData: ParsedCVData = {
                user_id: userId,
                education: sections[1]?.trim() || '',
                work_experience: sections[2]?.trim() || '',
                skills: sections[3]?.trim() || '',
                languages: sections[4]?.trim() || '',
                certifications: sections[5]?.trim() || ''
            };

            // Save to database
            const { error: dbError } = await supabase
                .from('cv_parsed_data')
                .upsert({
                    ...cvData,
                    updated_at: new Date().toISOString()
                });

            if (dbError) {
                throw dbError;
            }

            setParsedData(cvData);
            toast.success('CV parsed and saved successfully');
            
        } catch (error) {
            console.error('Error parsing CV:', error);
            toast.error('Error parsing CV: ' + error.message);
            throw error; // Re-throw the error to be handled by the caller
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            // First upload the file to Supabase storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}-${Date.now()}.${fileExt}`;
            const filePath = `cvs/${fileName}`;

            const { error: uploadError, data } = await supabase.storage
                .from('cvs')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get the public URL
            const { data: { publicUrl } } = supabase.storage
                .from('cvs')
                .getPublicUrl(filePath);

            // Save CV info to database
            const { error: dbError } = await supabase
                .from('user_cvs')
                .upsert({
                    user_id: userId,
                    file_url: publicUrl,
                    file_name: file.name
                });

            if (dbError) throw dbError;

            // Parse the CV using Gemini API
            await handleParseCV(file);

            toast.success('CV uploaded successfully');
            await fetchCurrentCV();
        } catch (error: any) {
            console.error('Error uploading CV:', error);
            toast.error('Error uploading CV: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="cv-section">
            {canEdit && (
                <div className="cv-actions">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.txt"
                        style={{ display: 'none' }}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                        className="upload-btn"
                    >
                        {loading ? 'Processing...' : 'Upload CV'}
                    </button>
                    {currentCV && (
                        <button 
                            onClick={handleDeleteCV} 
                            disabled={loading}
                            className="delete-btn"
                        >
                            Delete CV
                        </button>
                    )}
                </div>
            )}
            
            {currentCV && (
                <div className="cv-preview">
                    <h3>Current CV: {currentCV.file_name}</h3>
                    <a href={currentCV.file_url} target="_blank" rel="noopener noreferrer">
                        View CV
                    </a>
                </div>
            )}

            {parsedData && (
                <div className="parsed-data">
                    <h3>Parsed CV Data:</h3>
                    <div className="cv-sections">
                        <section>
                            <h4>Education</h4>
                            <p>{parsedData.education}</p>
                        </section>
                        <section>
                            <h4>Work Experience</h4>
                            <p>{parsedData.work_experience}</p>
                        </section>
                        <section>
                            <h4>Skills</h4>
                            <p>{parsedData.skills}</p>
                        </section>
                        <section>
                            <h4>Languages</h4>
                            <p>{parsedData.languages}</p>
                        </section>
                        <section>
                            <h4>Certifications</h4>
                            <p>{parsedData.certifications}</p>
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CVSection; 