-- Create project_documents table
CREATE TABLE project_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create project_faqs table
CREATE TABLE project_faqs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create project_resources table
CREATE TABLE project_resources (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'link',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes for better performance
CREATE INDEX idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX idx_project_faqs_project_id ON project_faqs(project_id);
CREATE INDEX idx_project_resources_project_id ON project_resources(project_id);

-- Enable RLS
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_resources ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON project_documents TO authenticated;
GRANT ALL ON project_faqs TO authenticated;
GRANT ALL ON project_resources TO authenticated;

-- RLS Policies for project_documents
CREATE POLICY "Users can view project documents"
    ON project_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_documents.project_id
            AND project_members.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project members with manager role and admins can insert documents"
    ON project_documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_documents.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project members with manager role and admins can update documents"
    ON project_documents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_documents.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project members with manager role and admins can delete documents"
    ON project_documents FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_documents.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- RLS Policies for project_faqs
CREATE POLICY "Users can view project FAQs"
    ON project_faqs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_faqs.project_id
            AND project_members.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project members with manager role and admins can insert FAQs"
    ON project_faqs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_faqs.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project members with manager role and admins can update FAQs"
    ON project_faqs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_faqs.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project members with manager role and admins can delete FAQs"
    ON project_faqs FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_faqs.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- RLS Policies for project_resources
CREATE POLICY "Users can view project resources"
    ON project_resources FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_resources.project_id
            AND project_members.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project members with manager role and admins can insert resources"
    ON project_resources FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_resources.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project members with manager role and admins can update resources"
    ON project_resources FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_resources.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project members with manager role and admins can delete resources"
    ON project_resources FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_resources.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    ); 