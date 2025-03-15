import { supabase } from '../lib/supabase';

// Check if the user is authenticated
async function checkAuth() {
  console.log('Checking authentication status...');
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting auth session:', error);
    return { authenticated: false, error };
  }
  
  const isAuthenticated = !!data.session;
  console.log('Authentication status:', isAuthenticated ? 'Authenticated' : 'Not authenticated');
  
  if (isAuthenticated) {
    console.log('User ID:', data.session?.user.id);
    console.log('User email:', data.session?.user.email);
  }
  
  return {
    authenticated: isAuthenticated,
    session: data.session,
    userId: data.session?.user.id
  };
}

// List all storage buckets
async function listBuckets() {
  console.log('Listing storage buckets...');
  const { data, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('Error listing buckets:', error);
    return { success: false, error };
  }
  
  console.log('Available buckets:', data);
  return { success: true, buckets: data };
}

// Test uploading to a bucket
async function testUpload(bucketName = 'user-avatars') {
  console.log(`Testing upload to ${bucketName} bucket...`);
  
  // Create a test image instead of a text file
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'green';
    ctx.fillRect(0, 0, 100, 100);
  }
  
  // Convert canvas to blob
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
  
  if (!blob) {
    console.error('Failed to create test image');
    return { success: false, error: new Error('Failed to create test image') };
  }
  
  const file = new File([blob], 'test-image.png', { type: 'image/png' });
  const testPath = `test-${Date.now()}.png`;
  
  // Try uploading
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(testPath, file, { upsert: true });
  
  if (error) {
    console.error(`Error uploading to ${bucketName}:`, error);
    console.error('Error message:', error.message);
    return { success: false, error };
  }
  
  console.log(`Successfully uploaded to ${bucketName}:`, data);
  
  // Clean up after successful test
  await supabase.storage
    .from(bucketName)
    .remove([testPath]);
    
  return { success: true, result: data };
}

// Expose to window for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).debugRLS = {
    checkAuth,
    listBuckets,
    testUpload
  };
}

export default {
  checkAuth,
  listBuckets,
  testUpload
}; 