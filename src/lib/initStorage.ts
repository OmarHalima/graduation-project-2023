import { supabaseAdmin } from './supabase';

/**
 * Initialize storage buckets for the application
 * This script should be run once during application setup
 * Note: Bucket policies must be set up manually in the Supabase dashboard or via SQL
 */
export async function initializeStorage() {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not available. Cannot initialize storage.');
    return { success: false, error: 'Admin client not available' };
  }

  try {
    // Check if user-avatars bucket exists, create if not
    const { data: buckets, error: getBucketsError } = await supabaseAdmin.storage.listBuckets();
    
    if (getBucketsError) {
      throw getBucketsError;
    }

    // Create user-avatars bucket if it doesn't exist
    if (!buckets.find(bucket => bucket.name === 'user-avatars')) {
      const { error: createBucketError } = await supabaseAdmin.storage.createBucket('user-avatars', {
        public: true, // Make avatars publicly accessible
        fileSizeLimit: 2 * 1024 * 1024, // 2MB limit
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });

      if (createBucketError) {
        throw createBucketError;
      }
      
      console.log('Created user-avatars bucket');
      console.log('IMPORTANT: You need to set up bucket policies manually in the Supabase dashboard or via SQL.');
      console.log('Check supabase/policies/rls_policies.sql for the recommended policies.');
    } else {
      console.log('user-avatars bucket already exists');
    }

    return { 
      success: true,
      message: 'Storage bucket created. Please set up policies manually using the SQL script in supabase/policies/rls_policies.sql'
    };
  } catch (error) {
    console.error('Error initializing storage:', error);
    return { success: false, error };
  }
}

// Function to run from a script or admin panel
export async function runStorageInitialization() {
  console.log('Initializing storage buckets...');
  const result = await initializeStorage();
  
  if (result.success) {
    console.log('Storage initialization completed successfully');
    console.log('IMPORTANT: To set up bucket policies, run the SQL in supabase/policies/rls_policies.sql');
  } else {
    console.error('Storage initialization failed:', result.error);
  }
  
  return result;
} 