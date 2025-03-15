#!/usr/bin/env node

/**
 * Script to fix RLS and Storage bucket issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('===== Supabase RLS and Storage Policy Fixer =====');
console.log('This script will help diagnose and fix RLS policy issues with your Supabase storage.');

// Step 1: Verify the SQL file exists
const sqlFilePath = path.join(__dirname, '..', 'supabase', 'policies', 'fix_rls_policies.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error('ERROR: Could not find fix_rls_policies.sql file. Make sure it exists in the supabase/policies directory.');
  process.exit(1);
}

console.log('\n✅ Found fix_rls_policies.sql');
console.log('This file contains the necessary SQL to fix the RLS policies for the user-avatars bucket.');

// Step 2: Provide instructions
console.log('\n===== Instructions =====');
console.log('1. Open your Supabase dashboard (https://app.supabase.io)');
console.log('2. Select your project');
console.log('3. Go to the SQL Editor');
console.log('4. Copy and paste the contents of supabase/policies/fix_rls_policies.sql');
console.log('5. Run the SQL query');

// Display SQL file content
console.log('\n===== SQL Contents =====');
try {
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  console.log(sqlContent);
} catch (error) {
  console.error('ERROR: Could not read SQL file:', error.message);
}

console.log('\n===== Bucket Configuration =====');
console.log('Make sure your user-avatars bucket is configured with these settings:');
console.log('- File size limit: 2MB');
console.log('- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp');
console.log('\nTo set this up:');
console.log('1. Go to Storage in your Supabase dashboard');
console.log('2. Select the user-avatars bucket (or create it if it doesn\'t exist)');
console.log('3. Go to the Settings tab');
console.log('4. Set the File Size Limit to 2097152 (2MB)');
console.log('5. Set Allowed MIME Types to: image/jpeg, image/png, image/gif, image/webp');

console.log('\n===== Verify Fixes =====');
console.log('After applying these changes, you can run the RLS debugging utility to verify:');
console.log('1. Open your application in development mode');
console.log('2. Go to the Settings page');
console.log('3. Use the RLS Debugger component to test your storage policies');

console.log('\nGood luck! If you continue to have issues, check your browser console for specific error messages.'); 