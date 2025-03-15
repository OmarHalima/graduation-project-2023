-- Remove the delete_cv function
DROP FUNCTION IF EXISTS delete_cv(user_id UUID, file_url TEXT); 

-- Restore the delete_cv function with explicit table references and CV parsed data deletion
CREATE OR REPLACE FUNCTION delete_cv(user_id UUID, file_url TEXT)
RETURNS VOID AS $$
DECLARE
    cv_exists BOOLEAN;
BEGIN
    -- Check if the CV exists for the user
    SELECT EXISTS (
        SELECT 1 FROM user_cvs 
        WHERE user_cvs.user_id = user_id AND user_cvs.file_url = file_url
    ) INTO cv_exists;

    IF NOT cv_exists THEN
        RAISE EXCEPTION 'CV does not exist for the specified user.';
    END IF;

    -- Delete the CV record from the database
    DELETE FROM user_cvs 
    WHERE user_cvs.user_id = user_id AND user_cvs.file_url = file_url;

    -- Delete the parsed CV data
    DELETE FROM cv_parsed_data
    WHERE cv_parsed_data.user_id = user_id;

    RAISE NOTICE 'CV and parsed data deleted successfully.';
END;
$$ LANGUAGE plpgsql; 