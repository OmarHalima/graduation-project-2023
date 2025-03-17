import { supabase } from '../lib/supabase';

/**
 * Upload an avatar image to Supabase storage
 * @param userId The user ID
 * @param file The file to upload
 * @returns The public URL of the uploaded avatar
 */
export async function uploadAvatar(userId: string, file: File): Promise<{ url: string | null; error: Error | null }> {
  try {
    // Validate file
    if (!file || !file.type.startsWith('image/')) {
      return { url: null, error: new Error('Invalid file type. Only images are allowed.') };
    }

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return { url: null, error: new Error('File size exceeds 2MB limit') };
    }

    // Create a unique file path for the avatar using the correct structure
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `avatars/${userId}/${fileName}`;

    // Upload the file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return { url: null, error: new Error(uploadError.message) };
    }

    // Get the public URL
    const { data } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(filePath);

    return { url: data.publicUrl, error: null };
  } catch (error: any) {
    console.error('Error in uploadAvatar:', error);
    return { url: null, error };
  }
}

/**
 * Delete an avatar from Supabase storage
 * @param avatarUrl The URL of the avatar to delete
 * @param userId The user ID
 */
export async function deleteAvatar(avatarUrl: string, userId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (!avatarUrl) {
      return { success: false, error: new Error('No avatar URL provided') };
    }

    // Extract the file path from the URL
    // Example URL: https://xxxx.supabase.co/storage/v1/object/public/user-avatars/avatars/user-id/filename.jpg
    const urlParts = avatarUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const filePath = `avatars/${userId}/${fileName}`;

    // Delete the file from storage
    const { error } = await supabase.storage
      .from('user-avatars')
      .remove([filePath]);

    if (error) {
      console.error('Avatar deletion error:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Error in deleteAvatar:', error);
    return { success: false, error };
  }
}

/**
 * Update a user's avatar URL in the database
 * @param userId The user ID
 * @param avatarUrl The new avatar URL
 */
export async function updateUserAvatar(userId: string, avatarUrl: string | null): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user avatar:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Error in updateUserAvatar:', error);
    return { success: false, error };
  }
} 