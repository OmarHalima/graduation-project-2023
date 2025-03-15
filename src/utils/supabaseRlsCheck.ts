import { supabase, supabaseAdmin } from '../lib/supabase';

interface DiagnosticResult {
  success: boolean;
  error?: any;
  message?: string;
  step?: string;
}

/**
 * Utility to help diagnose RLS policy issues with Supabase
 */

// Check storage bucket policies
export async function checkStorageBuckets(): Promise<DiagnosticResult> {
  try {
    console.log('Checking storage buckets...');
    
    // List all buckets
    const { data: buckets, error: bucketsError } = await supabaseAdmin?.storage.listBuckets() || {};
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return { success: false, error: bucketsError };
    }
    
    console.log('Available buckets:', buckets?.map(b => b.name));
    
    // Check specifically the user-avatars bucket
    const avatarBucket = buckets?.find(b => b.name === 'user-avatars');
    if (!avatarBucket) {
      console.error('User-avatars bucket not found!');
      return { success: false, error: new Error('User-avatars bucket not found') };
    }
    
    return { success: true, message: 'Storage buckets found' };
  } catch (error) {
    console.error('Error in checkStorageBuckets:', error);
    return { success: false, error };
  }
}

// Test a storage operation
export async function testStorageUpload(): Promise<DiagnosticResult> {
  try {
    console.log('Testing storage upload...');
    
    // Create a small test image instead of a text file
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);
    }
    
    // Convert canvas to blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    
    if (!blob) {
      throw new Error('Failed to create test image');
    }
    
    const testFile = new File([blob], 'test-image.png', { type: 'image/png' });
    const testPath = `test/test-${Date.now()}.png`;
    
    // Try to upload to the avatar bucket
    const { error } = await supabase.storage
      .from('user-avatars')
      .upload(testPath, testFile, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) {
      console.error('Upload test failed:', error);
      return { success: false, error };
    }
    
    console.log('Upload test succeeded');
    
    // Clean up after successful test
    await supabase.storage
      .from('user-avatars')
      .remove([testPath]);
      
    return { success: true };
  } catch (error) {
    console.error('Error in testStorageUpload:', error);
    return { success: false, error };
  }
}

// Test a user update operation
export async function testUserUpdate(userId: string): Promise<DiagnosticResult> {
  try {
    console.log('Testing user update...');
    
    // Get current timestamp to make change detectable
    const timestamp = new Date().toISOString();
    
    // Try to update the user
    const { error } = await supabase
      .from('users')
      .update({
        updated_at: timestamp
      })
      .eq('id', userId);
    
    if (error) {
      console.error('User update test failed:', error);
      return { success: false, error };
    }
    
    console.log('User update test succeeded');
    return { success: true };
  } catch (error) {
    console.error('Error in testUserUpdate:', error);
    return { success: false, error };
  }
}

// Test avatar upload and update
export async function testAvatarUpload(userId: string): Promise<DiagnosticResult> {
  try {
    console.log('Testing avatar upload and update...');
    
    // 1. Create a small test image
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'blue';
      ctx.fillRect(0, 0, 100, 100);
    }
    
    // Convert canvas to blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    
    if (!blob) {
      throw new Error('Failed to create test image');
    }
    
    const testFile = new File([blob], 'test-avatar.png', { type: 'image/png' });
    
    // 2. Try to upload to the avatar bucket
    const fileName = `test-avatars/${userId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(fileName, testFile, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Avatar upload test failed:', uploadError);
      return { success: false, error: uploadError, step: 'upload' };
    }
    
    console.log('Avatar upload succeeded');
    
    // 3. Get the public URL
    const { data: urlData } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(fileName);
    
    // 4. Try to update the user's avatar_url
    const { error: updateError } = await supabase
      .from('users')
      .update({
        avatar_url: urlData.publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('Avatar URL update test failed:', updateError);
      return { success: false, error: updateError, step: 'update' };
    }
    
    console.log('Avatar URL update succeeded');
    
    // 5. Clean up - remove the test file
    await supabase.storage
      .from('user-avatars')
      .remove([fileName]);
    
    return { success: true };
  } catch (error) {
    console.error('Error in testAvatarUpload:', error);
    return { success: false, error };
  }
}

// Run diagnosis for dashboard page
export async function runDashboardDiagnostics(): Promise<{
  success: boolean;
  error?: any;
  activities?: { success: boolean; error?: any; hasData?: boolean };
  projects?: { success: boolean; error?: any; hasData?: boolean };
}> {
  try {
    console.log('Running dashboard diagnostics...');
    
    // Check if tables exist and have data
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('count')
      .limit(1);
    
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('count')
      .limit(1);
    
    return {
      success: true,
      activities: {
        success: activitiesError ? false : true,
        error: activitiesError,
        hasData: activities ? activities.length > 0 : false
      },
      projects: {
        success: projectsError ? false : true,
        error: projectsError,
        hasData: projects ? projects.length > 0 : false
      }
    };
  } catch (error) {
    console.error('Error in runDashboardDiagnostics:', error);
    return { success: false, error };
  }
}

// Run all diagnostic tests
export async function runAllDiagnostics(userId?: string): Promise<{
  results: Record<string, any>;
  suggestions: string[];
  hasIssues: boolean;
}> {
  console.log('Starting Supabase RLS diagnosis...');
  
  if (!userId) {
    return {
      results: {
        error: { success: false, error: 'No user ID provided' }
      },
      suggestions: ['Provide a valid user ID to run complete diagnostics'],
      hasIssues: true
    };
  }
  
  const results = {
    storageBuckets: await checkStorageBuckets(),
    storageUploadTest: await testStorageUpload(),
    userUpdateTest: await testUserUpdate(userId),
    avatarUploadTest: await testAvatarUpload(userId),
    dashboardDiagnostics: await runDashboardDiagnostics()
  };
  
  console.log('Diagnosis results:', results);
  
  // Suggest fixes based on results
  const suggestions: string[] = [];
  
  if (!results.storageBuckets.success) {
    suggestions.push('Storage bucket issue: Create a user-avatars bucket in Supabase storage');
  }
  
  if (!results.storageUploadTest.success) {
    suggestions.push('Storage upload failed: Check that the user-avatars bucket has proper RLS policies for INSERT operations');
  }
  
  if (!results.userUpdateTest.success) {
    suggestions.push('User update failed: Ensure the users table has an UPDATE policy that allows users to update their own rows');
  }
  
  if (!results.avatarUploadTest.success) {
    if (results.avatarUploadTest.step === 'upload') {
      suggestions.push('Avatar upload failed: Check storage bucket permissions');
    } else {
      suggestions.push('Avatar URL update failed: Check users table permissions');
    }
  }
  
  if (results.dashboardDiagnostics.success) {
    if (results.dashboardDiagnostics.activities && !results.dashboardDiagnostics.activities.success) {
      suggestions.push('Activities table query failed: Check RLS policies for the activities table');
    }
    if (results.dashboardDiagnostics.projects && !results.dashboardDiagnostics.projects.success) {
      suggestions.push('Projects table query failed: Check RLS policies for the projects table');
    }
  }
  
  return {
    results,
    suggestions,
    hasIssues: suggestions.length > 0
  };
}

// Specific recommendations for fixing RLS issues
export function getRlsRecommendations(): {
  tableRecommendations: Array<{table: string; policies: string[]}>;
  storageBuckets: Array<{bucket: string; policies: string[]}>;
  generalTips: string[];
} {
  return {
    tableRecommendations: [
      {
        table: 'users',
        policies: [
          "CREATE POLICY \"Users can view all users\" ON users FOR SELECT USING (true);",
          "CREATE POLICY \"Users can update their own data\" ON users FOR UPDATE USING (auth.uid() = id);"
        ]
      },
      {
        table: 'activities',
        policies: [
          "CREATE POLICY \"Everyone can view activities\" ON activities FOR SELECT USING (true);"
        ]
      },
      {
        table: 'projects',
        policies: [
          "CREATE POLICY \"Users can view all projects\" ON projects FOR SELECT USING (true);",
          "CREATE POLICY \"Project members can update their projects\" ON projects FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM project_members WHERE project_id = id));"
        ]
      }
    ],
    storageBuckets: [
      {
        bucket: 'user-avatars',
        policies: [
          "Create a policy allowing authenticated users to upload files",
          "Create a policy allowing public access to read files"
        ]
      }
    ],
    generalTips: [
      "RLS policies are enforced at the database level, not in your application code",
      "Every table needs explicit RLS policies or it will default to denying all access",
      "For avatar uploads, you need both storage bucket policies AND database table policies",
      "Use the Supabase dashboard SQL editor to add policies to your tables and buckets",
      "Consider enabling row-level logging to debug policy violations in production"
    ]
  };
} 