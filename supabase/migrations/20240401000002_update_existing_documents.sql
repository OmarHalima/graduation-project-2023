-- Update existing task logs documents
UPDATE project_documents
SET title = 'Task Logs', 
    category = 'Task Logs'
WHERE title = 'Completed Tasks Log' 
  AND category = 'Project Progress';

-- Update existing phase logs documents
UPDATE project_documents
SET title = 'Phase Logs', 
    category = 'Phase Logs'
WHERE title = 'Project Phases Progress' 
  AND category = 'Project Progress'; 