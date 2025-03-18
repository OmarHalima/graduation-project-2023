const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Validate user data
function validateUserData(userData) {
  if (!userData) {
    throw new Error('userData is required');
  }
  
  // Ensure required fields exist with default values if not provided
  return {
    department: userData.department || 'Not specified',
    position: userData.position || 'Not specified',
    cv: userData.cv || null,
    interviews: Array.isArray(userData.interviews) ? userData.interviews : [],
    notes: Array.isArray(userData.notes) ? userData.notes : [],
    projects: Array.isArray(userData.projects) ? userData.projects : []
  };
}

// Helper function to format CV data
function formatCVData(cv) {
  if (!cv) return null;

  return {
    education: Array.isArray(cv.education) ? cv.education.map(edu => ({
      institution: edu.institution,
      degree: edu.degree,
      field: edu.field,
      year: edu.graduation_year
    })) : [],
    experience: Array.isArray(cv.experience) ? cv.experience.map(exp => ({
      company: exp.company,
      position: exp.position,
      duration: exp.duration,
      responsibilities: exp.responsibilities
    })) : [],
    skills: Array.isArray(cv.skills) ? cv.skills.map(skill => skill.name) : [],
    languages: Array.isArray(cv.languages) ? cv.languages.map(lang => ({
      language: lang.language,
      proficiency: lang.proficiency
    })) : [],
    certifications: Array.isArray(cv.certifications) ? cv.certifications.map(cert => ({
      name: cert.name,
      issuer: cert.issuer,
      year: cert.year
    })) : []
  };
}

// Helper function to generate analysis prompt
function generatePrompt(userData) {
  const validatedData = validateUserData(userData);
  const cvData = formatCVData(validatedData.cv);
  
  let prompt = `As an AI career analyst, please provide a comprehensive analysis of the following employee data:

EMPLOYEE PROFILE:
- Name: ${userData.full_name || 'Not specified'}
- Department: ${validatedData.department}
- Position: ${validatedData.position}
- Email: ${userData.email || 'Not specified'}

PROFESSIONAL BACKGROUND:`;

  if (cvData) {
    prompt += `\n
Education:
${cvData.education.map(edu => `- ${edu.degree} in ${edu.field} from ${edu.institution} (${edu.year})`).join('\n')}

Work Experience:
${cvData.experience.map(exp => `- ${exp.position} at ${exp.company} (${exp.duration})`).join('\n')}

Skills:
${cvData.skills.map(skill => `- ${skill}`).join('\n')}

Languages:
${cvData.languages.map(lang => `- ${lang.language}: ${lang.proficiency}`).join('\n')}

Certifications:
${cvData.certifications.map(cert => `- ${cert.name} from ${cert.issuer} (${cert.year})`).join('\n')}`;
  } else {
    prompt += '\nNo CV data available';
  }

  prompt += `\n
CURRENT ENGAGEMENT:
- Number of Interviews Conducted: ${validatedData.interviews.length}
- Number of Notes/Feedback Provided: ${validatedData.notes.length}
- Number of Projects Involved: ${validatedData.projects.length}

Please provide a detailed analysis including:

1. PROFILE SUMMARY:
   - Professional background and qualifications
   - Current role and responsibilities
   - Skills and competencies assessment
   - Language proficiencies and certifications impact

2. KEY OBSERVATIONS:
   - Career progression and growth
   - Technical and soft skills alignment
   - Activity patterns and engagement level
   - Areas of expertise and potential growth

3. RECOMMENDATIONS:
   - Skill development opportunities
   - Career advancement pathways
   - Professional development focus areas
   - Suggested training or certifications
   - Next steps for career progression

Please provide a comprehensive, well-structured analysis that is specific, actionable, and constructive. Focus on both current strengths and growth opportunities.`;

  return prompt;
}

// Function to call Gemini API
async function generateContent(prompt) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    
    console.log('Calling Gemini API with prompt:', prompt);
    
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.8,
        topK: 40
      }
    });
    
    console.log('Gemini API response status:', response.status);
    return response.data;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Gemini API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Gemini API No Response:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Gemini API Error Setup:', error.message);
    }
    throw error;
  }
}

// Function to format the analysis text
function formatAnalysisText(text) {
  // Remove any markdown symbols and clean up the text
  let formattedText = text
    .replace(/[*#`]/g, '')  // Remove markdown symbols
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // Replace multiple newlines with double newlines
    .split('\n')
    .map(line => {
      line = line.trim();
      // Format list items
      if (line.match(/^[-*]\s/)) {
        return `• ${line.replace(/^[-*]\s/, '')}`;
      }
      return line;
    })
    .filter(line => line)  // Remove empty lines
    .join('\n');

  // Add proper spacing and formatting
  formattedText = formattedText
    // Format section headers (e.g., "1. PROFILE SUMMARY:")
    .replace(/(\d+\.\s*[A-Z][A-Z\s]+:)/g, '\n\n$1\n')
    // Format subsection headers (e.g., "EDUCATION:")
    .replace(/([A-Z][A-Z\s]+:)(?!\d)/g, '\n$1\n')
    // Ensure list items are properly spaced
    .replace(/(\n• [^\n]+)(?=\n[^•])/g, '$1\n')
    // Add extra spacing after sections
    .replace(/(:)(\n+)([^•\n])/g, '$1\n\n$3')
    // Clean up any resulting multiple newlines
    .replace(/\n{3,}/g, '\n\n');

  return formattedText.trim();
}

// Gemini API endpoint
app.post('/api/gemini', async (req, res) => {
  try {
    const { userData } = req.body;
    
    if (!userData) {
      return res.status(400).json({ error: 'userData is required in the request body' });
    }

    // Log the incoming data
    console.log('Received userData:', JSON.stringify(userData, null, 2));
    
    // Generate the prompt
    const prompt = generatePrompt(userData);
    
    // Log the generated prompt
    console.log('Generated prompt:', prompt);
    
    try {
      // Call Gemini API
      const result = await generateContent(prompt);
      
      // Extract and format the generated text
      const rawText = result.candidates[0].content.parts[0].text;
      const formattedText = formatAnalysisText(rawText);
      
      // Log successful response
      console.log('Analysis generated successfully');
      
      res.json({ analysis: formattedText });
    } catch (genError) {
      console.error('Gemini API Error:', {
        message: genError.message,
        response: genError.response?.data,
        status: genError.response?.status
      });
      throw new Error(`Gemini API Error: ${genError.response?.data?.error?.message || genError.message}`);
    }
  } catch (error) {
    // Log the detailed error
    console.error('Detailed error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Send appropriate error response
    res.status(500).json({
      error: 'Failed to generate analysis',
      details: error.message
    });
  }
});

// Function to parse CV text using Gemini API
async function parseCVContent(cvText) {
  const prompt = `You are a CV parser. Please analyze the following CV text and extract structured information in JSON format. The output should strictly follow this format:
{
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "graduation_year": "YYYY"
    }
  ],
  "experience": [
    {
      "company": "string",
      "position": "string",
      "duration": "string",
      "responsibilities": ["string"]
    }
  ],
  "skills": [
    {
      "name": "string",
      "level": "string"
    }
  ],
  "languages": [
    {
      "language": "string",
      "proficiency": "string"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "year": "YYYY"
    }
  ]
}

CV Content:
${cvText}

Please extract the information and return it in the exact JSON format specified above. Ensure all fields are present even if empty.`;

  try {
    console.log('Sending CV text to Gemini API for parsing...');
    const result = await generateContent(prompt);
    const parsedText = result.candidates[0].content.parts[0].text;
    
    // Extract the JSON part from the response
    const jsonMatch = parsedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from the response');
    }
    
    const parsedData = JSON.parse(jsonMatch[0]);
    console.log('Successfully parsed CV data:', parsedData);
    return parsedData;
  } catch (error) {
    console.error('Error in parseCVContent:', error);
    throw new Error(`Failed to parse CV content: ${error.message}`);
  }
}

// Function to download and extract text from CV file
async function extractTextFromCV(fileUrl, fileName) {
  try {
    console.log('Downloading CV file from:', fileUrl);
    const response = await axios.get(fileUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.data) {
      throw new Error('Failed to download CV file');
    }

    const buffer = Buffer.from(response.data);
    console.log('File downloaded successfully, size:', buffer.length, 'bytes');

    let cvText;
    if (fileName.toLowerCase().endsWith('.pdf')) {
      console.log('Processing PDF file...');
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      cvText = data.text;
    } else if (fileName.toLowerCase().endsWith('.doc') || fileName.toLowerCase().endsWith('.docx')) {
      console.log('Processing Word document...');
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      cvText = result.value;
    } else {
      throw new Error('Unsupported file format. Only PDF and Word documents are supported.');
    }

    if (!cvText || cvText.trim().length === 0) {
      throw new Error('No text could be extracted from the CV file');
    }

    console.log('Successfully extracted text from CV, length:', cvText.length);
    return cvText;
  } catch (error) {
    console.error('Error in extractTextFromCV:', error);
    throw new Error(`Failed to extract text from CV: ${error.message}`);
  }
}

// CV parsing endpoint
app.post('/api/parse-cv', async (req, res) => {
  try {
    console.log('Received parse CV request:', req.body);
    const { userId, fileUrl, fileName } = req.body;
    
    if (!userId || !fileUrl || !fileName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'userId, fileUrl, and fileName are required'
      });
    }

    // Extract text from CV
    const cvText = await extractTextFromCV(fileUrl, fileName);
    
    // Parse the CV text using Gemini
    const parsedData = await parseCVContent(cvText);
    
    // Validate parsed data structure
    if (!parsedData.education || !parsedData.experience || !parsedData.skills || 
        !parsedData.languages || !parsedData.certifications) {
      throw new Error('Parsed data is missing required sections');
    }

    // Validate and transform education data
    const education = parsedData.education.map(edu => ({
      institution: edu.institution || 'Not specified',
      degree: edu.degree || 'Not specified',
      field: edu.field || 'Not specified',
      graduation_year: edu.graduation_year || 'Not specified',
      user_id: userId
    })).filter(edu => edu.institution !== 'Not specified' || edu.degree !== 'Not specified');

    // Validate and transform experience data
    const experience = parsedData.experience.map(exp => ({
      company: exp.company || 'Not specified',
      position: exp.position || 'Not specified',
      duration: exp.duration || 'Not specified',
      responsibilities: Array.isArray(exp.responsibilities) ? exp.responsibilities : [],
      user_id: userId
    })).filter(exp => exp.company !== 'Not specified' || exp.position !== 'Not specified');

    // Validate and transform skills data
    const skills = parsedData.skills.map(skill => ({
      name: skill.name || 'Not specified',
      level: skill.level || 'Not specified',
      user_id: userId
    })).filter(skill => skill.name !== 'Not specified');

    // Validate and transform language data
    const languages = parsedData.languages.map(lang => ({
      language: lang.language || 'Not specified',
      proficiency: lang.proficiency || 'Not specified',
      user_id: userId
    })).filter(lang => lang.language !== 'Not specified');

    // Validate and transform certifications data
    const certifications = parsedData.certifications.map(cert => ({
      name: cert.name || 'Not specified',
      issuer: cert.issuer || 'Not specified',
      year: cert.year || 'Not specified',
      user_id: userId
    })).filter(cert => cert.name !== 'Not specified');

    // Add user_id to each section and ensure data is valid
    const dataWithUserId = {
      education: education.length > 0 ? education : [{
        institution: 'Not Available',
        degree: 'Not Available',
        field: 'Not Available',
        graduation_year: 'Not Available',
        user_id: userId
      }],
      experience: experience.length > 0 ? experience : [{
        company: 'Not Available',
        position: 'Not Available',
        duration: 'Not Available',
        responsibilities: [],
        user_id: userId
      }],
      skills: skills.length > 0 ? skills : [{
        name: 'Not Available',
        level: 'Not Available',
        user_id: userId
      }],
      languages: languages.length > 0 ? languages : [{
        language: 'Not Available',
        proficiency: 'Not Available',
        user_id: userId
      }],
      certifications: certifications.length > 0 ? certifications : [{
        name: 'Not Available',
        issuer: 'Not Available',
        year: 'Not Available',
        user_id: userId
      }]
    };

    console.log('Sending parsed data back to client:', dataWithUserId);
    res.json(dataWithUserId);
  } catch (error) {
    console.error('Error in parse-cv endpoint:', error);
    res.status(500).json({
      error: 'Failed to parse CV',
      details: error.message
    });
  }
});

// Instead of listening directly, export the app for Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the Express app
module.exports = app; 