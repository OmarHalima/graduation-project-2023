import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Card,
  IconButton,
  Link,
  Grid,
  Paper,
  Stack,
  Divider
} from '@mui/material';
import { Upload, Link as LinkIcon, Trash2, FileText, Download, Brain } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface CVSectionProps {
  userId: string;
  canEdit: boolean;
  onUpdate: () => void;
}

interface ParsedCVData {
  education: string;
  work_experience: string;
  skills: string;
  languages: string;
  certifications: string;
}

export function CVSection({ userId, canEdit, onUpdate }: CVSectionProps) {
  const [loading, setLoading] = useState(false);
  const [cvUrl, setCvUrl] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [currentCV, setCurrentCV] = useState<{ file_url: string; file_name: string } | null>(null);
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
        .single();

      if (error) {
        console.error('Error fetching parsed CV data:', error);
        return;
      }

      if (data) {
        setParsedData(data);
      }
    } catch (error) {
      console.error('Error fetching parsed CV data:', error);
    }
  };

  const extractTextFromPDF = async (blob: Blob): Promise<string> => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';

      // Get total number of pages
      const numPages = pdf.numPages;
      
      // Extract text from each page
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Process each text item and maintain some formatting
        const pageText = textContent.items
          .map((item: any) => {
            // Add newlines for items that appear to be in different vertical positions
            const shouldAddNewline = item.transform && item.transform[5] && item.transform[5] < -5;
            return item.str + (shouldAddNewline ? '\n' : ' ');
          })
          .join('');

        fullText += pageText + '\n\n';
      }

      // Clean up the extracted text
      const cleanedText = fullText
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n\n')  // Replace multiple newlines with double newlines
        .trim();

      if (!cleanedText) {
        throw new Error('No readable text found in the PDF. The file might be scanned or image-based.');
      }

      return cleanedText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
      }
      throw new Error('Failed to extract text from PDF. Please make sure the PDF contains selectable text.');
    }
  };

  const extractTextFromDOCX = async (blob: Blob): Promise<string> => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error('Error extracting text from DOCX:', error);
      throw new Error('Failed to extract text from DOCX');
    }
  };

  // Add this utility function at the top of the component
  const getStorageFilePath = (fileName: string) => {
    const timestamp = Date.now();
    // Only replace spaces and parentheses, keep other characters
    const sanitizedName = fileName.replace(/[\s()]/g, '_');
    return `${timestamp}_${sanitizedName}`;
  };

  const getFileNameFromUrl = (url: string): { fileName: string, bucket: string, path: string } => {
    try {
      // Decode the URL and create URL object
      const decodedUrl = decodeURIComponent(url);
      const urlObj = new URL(decodedUrl);
      
      // Extract path parts
      const pathParts = urlObj.pathname.split('/');
      
      // Find the bucket name from the path
      const bucketIndex = pathParts.findIndex(part => part === 'public') + 1;
      const bucket = bucketIndex > 0 ? pathParts[bucketIndex] : 'cvs';
      
      // Get the full path after the bucket
      const pathStartIndex = bucketIndex + 1;
      const pathElements = pathParts.slice(pathStartIndex);
      const path = pathElements.join('/');
      
      // Get the filename (last part)
      const fileName = pathElements[pathElements.length - 1];
      
      console.log('URL processing:', {
        original: url,
        decoded: decodedUrl,
        fullPath: urlObj.pathname,
        bucket,
        path,
        fileName
      });
      
      return { fileName, bucket, path };
    } catch (error) {
      console.error('Error extracting filename from URL:', error);
      throw new Error('Invalid file URL format');
    }
  };

  const handleParseCV = async () => {
    if (!currentCV) return;
    
    try {
      setLoading(true);
      
      let fileUrl;
      let extractedText = '';  // Move declaration outside the try block
      
      try {
        // Get the file info from the URL
        const { fileName, bucket, path } = getFileNameFromUrl(currentCV.file_url);
        console.log('Processing CV file:', {
          originalUrl: currentCV.file_url,
          bucket,
          path,
          fileName
        });
        
        // Try to get a signed URL using the full path
        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600); // 1 hour expiry

        if (signedError) {
          console.error('Signed URL error:', signedError);
          
          // Try to download using the original URL
          const response = await fetch(currentCV.file_url);
          if (!response.ok) {
            throw new Error(`Failed to access file: ${response.status} ${response.statusText}`);
          }
          
          // If we can access the file directly, upload it to the cvs bucket
          const blob = await response.blob();
          const file = new File([blob], fileName, { type: blob.type });
          
          // Create a new path in the cvs bucket
          const newPath = getStorageFilePath(fileName);
          
          // Upload to the cvs bucket
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('cvs')
            .upload(newPath, file, {
              cacheControl: '3600',
              upsert: true
            });
            
          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Failed to upload file: ${uploadError.message}`);
          }

          console.log('File uploaded successfully:', uploadData);
          
          // Get a fresh signed URL from cvs bucket
          const { data: newSignedData, error: newSignedError } = await supabase.storage
            .from('cvs')
            .createSignedUrl(newPath, 3600);
            
          if (newSignedError || !newSignedData?.signedUrl) {
            throw new Error(`Failed to get signed URL after upload: ${newSignedError?.message || 'Unknown error'}`);
          }
          
          fileUrl = newSignedData.signedUrl;
          
          // Update the database with the new file location
          const { error: updateError } = await supabase
            .from('user_cvs')
            .update({
              file_url: fileUrl,
              file_path: newPath,
              bucket: 'cvs'
            })
            .eq('user_id', userId);
            
          if (updateError) {
            console.error('Error updating file location:', updateError);
            // Don't throw here, as we still have a working file URL
          }
        } else {
          fileUrl = signedData.signedUrl;
        }
        
        console.log('Using file URL:', fileUrl);

        // Verify the URL works
        const verifyResponse = await fetch(fileUrl);
        if (!verifyResponse.ok) {
          throw new Error(`Failed to verify file access: ${verifyResponse.status} ${verifyResponse.statusText}`);
        }

        // Get the file content
        const fileBlob = await verifyResponse.blob();
        
        console.log('Extracting text from file:', currentCV.file_name);

        // Extract text based on file type
        if (currentCV.file_name.toLowerCase().endsWith('.pdf')) {
          extractedText = await extractTextFromPDF(fileBlob);
          console.log('Successfully extracted text from PDF');
        } else if (currentCV.file_name.toLowerCase().match(/\.docx?$/)) {
          extractedText = await extractTextFromDOCX(fileBlob);
          console.log('Successfully extracted text from DOCX');
        } else {
          throw new Error('Unsupported file type. Please upload a PDF or Word document.');
        }

        if (!extractedText) {
          throw new Error('No text could be extracted from the file. Please ensure the file contains readable text.');
        }

        console.log('Text extraction successful, length:', extractedText.length);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error accessing or processing file:', error);
        throw new Error(`Failed to process the CV file: ${errorMessage}`);
      }

      // Call server endpoint to parse CV
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      console.log('Calling parse CV API with:', {
        userId,
        fileUrl: currentCV.file_url,
        fileName: currentCV.file_name,
        textLength: extractedText.length,
        textPreview: extractedText.substring(0, 100) + '...' // Preview first 100 chars
      });

      // Maximum number of retries
      const maxRetries = 3;
      let retryCount = 0;
      let lastError = null;

      while (retryCount < maxRetries) {
        try {
          // Format the text to ensure it's clean
          const cleanedText = extractedText
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/[\u2028\u2029]/g, '\n')  // Replace line separators with newlines
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .replace(/[^\x20-\x7E\n]/g, '') // Keep only printable ASCII and newlines
            .trim();

          // Log the first part of cleaned text for debugging
          console.log('Cleaned text preview:', cleanedText.substring(0, 200));
          console.log('Text length:', cleanedText.length);

          // Validate required fields
          if (!userId || !fileUrl || !currentCV.file_name || !cleanedText) {
            throw new Error('Missing required fields for API request');
          }

          // Use the signed URL directly (it's already properly formatted)
          const requestBody = {
            userId,
            fileUrl, // Use the signed URL we got earlier
            fileName: currentCV.file_name,
            text: cleanedText
          };

          console.log(`Sending request (attempt ${retryCount + 1}/${maxRetries}):`, {
            url: `${apiUrl}/api/parse-cv`,
            bodyLength: JSON.stringify(requestBody).length,
            textLength: cleanedText.length,
            hasRequiredFields: {
              userId: !!userId,
              fileUrl: !!requestBody.fileUrl,
              fileName: !!requestBody.fileName,
              text: !!requestBody.text
            },
            requestPreview: {
              userId: userId,
              fileUrl: requestBody.fileUrl.substring(0, 50) + '...',
              fileName: requestBody.fileName,
              textLength: requestBody.text.length
            }
          });
          
          const response = await fetch(`${apiUrl}/api/parse-cv`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            let errorMessage = 'Failed to parse CV';
            let errorDetails = null;
            const responseText = await response.text();
            try {
              const errorData = JSON.parse(responseText);
              console.error('API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                data: errorData,
                responseText,
                requestBody: {
                  ...requestBody,
                  text: `${requestBody.text.substring(0, 100)}...` // Only log first 100 chars
                }
              });
              errorMessage = errorData.details || errorData.message || errorMessage;
              errorDetails = errorData;
              
              // If it's a 400 error, don't retry
              if (response.status === 400) {
                throw new Error(`${errorMessage} (${JSON.stringify(errorDetails)})`);
              }
            } catch (e) {
              console.error('Error parsing error response:', {
                error: e,
                responseText
              });
              errorMessage = `Server error: ${response.status} ${response.statusText}`;
              if (responseText) {
                errorMessage += ` - ${responseText}`;
              }
            }
            throw new Error(errorMessage);
          }

          // If we get here, the request was successful
          const parsedData = await response.json();

          if (!parsedData || typeof parsedData !== 'object') {
            throw new Error('Invalid response format from server');
          }

          console.log('Successfully parsed CV data:', {
            sections: Object.keys(parsedData),
            dataSize: JSON.stringify(parsedData).length
          });

          // Validate the parsed data structure
          const requiredSections = ['education', 'experience', 'skills', 'languages', 'certifications'];
          const missingSections = requiredSections.filter(section => !parsedData[section]);
          
          if (missingSections.length > 0) {
            console.warn('Missing sections in parsed data:', missingSections);
            // Initialize missing sections as empty arrays
            missingSections.forEach(section => {
              parsedData[section] = [];
            });
          }

          // Save to database
          const { error: dbError } = await supabase
            .from('cv_parsed_data')
            .upsert({
              user_id: userId,
              education: formatSection(parsedData.education),
              work_experience: formatSection(parsedData.experience),
              skills: formatSection(parsedData.skills),
              languages: formatSection(parsedData.languages),
              certifications: formatSection(parsedData.certifications),
              updated_at: new Date().toISOString()
            });

          if (dbError) {
            throw dbError;
          }

          setParsedData({
            education: formatSection(parsedData.education),
            work_experience: formatSection(parsedData.experience),
            skills: formatSection(parsedData.skills),
            languages: formatSection(parsedData.languages),
            certifications: formatSection(parsedData.certifications)
          });
          
          toast.success('CV parsed successfully');
          return; // Exit the retry loop on success
          
        } catch (error) {
          lastError = error;
          retryCount++;
          
          // If this wasn't our last try, wait before retrying
          if (retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5 seconds
            console.log(`Retry ${retryCount}/${maxRetries} failed, waiting ${delay}ms before next attempt`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If we get here, all retries failed
      console.error('All retry attempts failed:', lastError);
      throw lastError || new Error('Failed to parse CV after multiple attempts');

    } catch (error: any) {
      console.error('Error parsing CV:', error);
      toast.error(error.message || 'Error parsing CV');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format sections
  const formatSection = (data: any[]): string => {
    if (!Array.isArray(data) || data.length === 0) {
      return 'No information available';
    }

    return data.map(item => {
      if (item.institution) { // Education
        return `${item.institution} - ${item.degree}\n${item.field} (${item.graduation_year})`;
      } else if (item.company) { // Experience
        return `${item.company} - ${item.position}\n${item.duration}\n${item.responsibilities.join('\n')}`;
      } else if (item.language) { // Languages
        return `${item.language} - ${item.proficiency}`;
      } else if (item.name && item.level) { // Skills
        return `${item.name} - ${item.level}`;
      } else if (item.name && item.issuer) { // Certifications
        return `${item.name} - ${item.issuer} (${item.year})`;
      }
      return JSON.stringify(item);
    }).join('\n\n');
  };

  const fetchCurrentCV = async () => {
    try {
      console.log('Fetching CV for user:', userId);
      const { data, error } = await supabase
        .from('user_cvs')
        .select('file_url, file_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching CV:', error);
        toast.error('Error loading CV');
        return;
      }

      console.log('Fetched CV data:', data);
      setCurrentCV(data || null);
    } catch (error: any) {
      console.error('Error fetching CV:', error);
      toast.error('Error loading CV');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }
      if (!file.type.match('application/pdf|application/msword|application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        toast.error('Only PDF and Word documents are allowed');
        return;
      }
      setCvFile(file);
      handleUploadCV(file);
    }
  };

  const handleUrlSubmit = async () => {
    if (!cvUrl) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_cvs')
        .upsert({
          user_id: userId,
          file_url: cvUrl,
          file_name: 'External Link',
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('CV URL updated successfully');
      setCvUrl('');
      onUpdate();
      fetchCurrentCV();
    } catch (error: any) {
      console.error('Error updating CV URL:', error);
      toast.error('Error updating CV URL');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCV = async (file: File) => {
    setLoading(true);
    try {
      // Create a unique file path with sanitized name
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[\s()]/g, '_');
      const filePath = `cvs/${timestamp}-${sanitizedName}`;
      
      console.log('Uploading file:', {
        originalName: file.name,
        sanitizedPath: filePath,
        type: file.type,
        size: file.size
      });
      
      // Upload the file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-files')
        .getPublicUrl(filePath);

      console.log('File uploaded successfully:', {
        path: filePath,
        publicUrl
      });

      // Update database with only the existing columns
      const { error: dbError } = await supabase
        .from('user_cvs')
        .upsert({
          user_id: userId,
          file_url: publicUrl,
          file_name: file.name,
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }

      toast.success('CV uploaded successfully');
      setCvFile(null);
      fetchCurrentCV();
      onUpdate();
    } catch (error: any) {
      console.error('Error uploading CV:', error);
      toast.error(`Error uploading CV: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCV = async () => {
    if (!currentCV) return;

    if (!confirm('Are you sure you want to delete this CV?')) return;

    setLoading(true);
    try {
      // Delete from database first
      const { error: dbError } = await supabase
        .from('user_cvs')
        .delete()
        .eq('user_id', userId);

      if (dbError) throw dbError;

      // Delete from storage if it's our uploaded file
      if (currentCV.file_url.includes('supabase')) {
        try {
          // Extract the file path from the URL
          const urlParts = currentCV.file_url.split('/user-files/');
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            console.log('Deleting file:', filePath);
            
            const { error: storageError } = await supabase.storage
              .from('user-files')
              .remove([filePath]);
              
            if (storageError) {
              console.error('Error deleting file from storage:', storageError);
            }
          }
        } catch (error) {
          console.error('Error deleting file from storage:', error);
        }
      }

      toast.success('CV deleted successfully');
      setCurrentCV(null);
      onUpdate();
    } catch (error: any) {
      console.error('Error deleting CV:', error);
      toast.error('Error deleting CV');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCV = async () => {
    if (!currentCV) return;

    try {
      if (currentCV.file_url.startsWith('http')) {
        window.open(currentCV.file_url, '_blank');
      } else {
        const { data, error } = await supabase.storage
          .from('cvs')
          .download(currentCV.file_url);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentCV.file_name;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error: any) {
      console.error('Error downloading CV:', error);
      toast.error('Error downloading CV');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {loading && (
        <Box display="flex" justifyContent="center" my={2}>
          <CircularProgress />
        </Box>
      )}

      <Box mb={3}>
        <Typography variant="h6" gutterBottom>
          Curriculum Vitae (CV)
        </Typography>

        {currentCV ? (
          <Card sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <FileText size={24} />
              <Typography flex={1}>{currentCV.file_name}</Typography>
              <Button
                startIcon={<Brain />}
                onClick={handleParseCV}
                variant="contained"
                color="primary"
                size="small"
                disabled={!currentCV || loading}
              >
                Parse CV
              </Button>
              <Button
                startIcon={<Download />}
                onClick={handleDownloadCV}
                variant="outlined"
                size="small"
              >
                Download
              </Button>
              {canEdit && (
                <Button
                  startIcon={<Trash2 />}
                  onClick={handleDeleteCV}
                  variant="outlined"
                  color="error"
                  size="small"
                >
                  Delete
                </Button>
              )}
            </Stack>
          </Card>
        ) : (
          <Alert severity="info" sx={{ mt: 2 }}>No CV uploaded yet.</Alert>
        )}

        {parsedData && (
          <Paper sx={{ mt: 3, p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Parsed CV Data
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">Education</Typography>
                <Typography variant="body2" whiteSpace="pre-line">{parsedData.education}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">Work Experience</Typography>
                <Typography variant="body2" whiteSpace="pre-line">{parsedData.work_experience}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">Skills</Typography>
                <Typography variant="body2" whiteSpace="pre-line">{parsedData.skills}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">Languages</Typography>
                <Typography variant="body2" whiteSpace="pre-line">{parsedData.languages}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">Certifications</Typography>
                <Typography variant="body2" whiteSpace="pre-line">{parsedData.certifications}</Typography>
              </Box>
            </Stack>
          </Paper>
        )}
      </Box>

      {canEdit && (
        <Box mt={3}>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
              />
              <Button
                variant="contained"
                startIcon={<Upload />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
              >
                Upload CV
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Or add CV URL
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Enter CV URL"
                  value={cvUrl}
                  onChange={(e) => setCvUrl(e.target.value)}
                />
                <Button
                  variant="outlined"
                  startIcon={<LinkIcon />}
                  onClick={handleUrlSubmit}
                  disabled={!cvUrl}
                >
                  Add URL
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
} 