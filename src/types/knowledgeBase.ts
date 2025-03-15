export interface KnowledgeBase {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  cv_url?: string;
  notes: string;
  interview_results: InterviewResult[];
  skills: string[];
  education: Education[];
  experience: Experience[];
}

export interface InterviewResult {
  date: string;
  interviewer: string;
  position: string;
  notes: string;
  score: number;
  status: 'passed' | 'failed' | 'pending';
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  start_date: string;
  end_date?: string;
  description?: string;
}

export interface Experience {
  company: string;
  position: string;
  start_date: string;
  end_date?: string;
  description: string;
  skills: string[];
} 