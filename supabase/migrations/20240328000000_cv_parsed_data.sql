-- Create the cv_parsed_data table
CREATE TABLE cv_parsed_data (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    education TEXT,
    work_experience TEXT,
    skills TEXT,
    languages TEXT,
    certifications TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create index on user_id for faster lookups
CREATE INDEX cv_parsed_data_user_id_idx ON cv_parsed_data(user_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE cv_parsed_data ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view only their own CV data
CREATE POLICY "Users can view their own CV data"
    ON cv_parsed_data
    FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    ));

-- Policy to allow users to insert/update their own CV data
CREATE POLICY "Users can insert their own CV data"
    ON cv_parsed_data
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    ));

CREATE POLICY "Users can update their own CV data"
    ON cv_parsed_data
    FOR UPDATE
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    ))
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    ));

-- Grant permissions
GRANT ALL ON cv_parsed_data TO authenticated; 