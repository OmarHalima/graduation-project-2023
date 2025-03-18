// Custom build script for Netlify
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure we're using the WASM version of Rollup
process.env.ROLLUP_WASM_NODE = '1';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');

// Recursively copy a directory
async function copyDir(src, dest) {
  try {
    // Create the destination directory
    await fs.mkdir(dest, { recursive: true });
    
    // Read source directory
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    // Process each entry
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively copy directory
        await copyDir(srcPath, destPath);
      } else {
        // Copy file
        await fs.copyFile(srcPath, destPath);
      }
    }
    
    return true;
  } catch (err) {
    console.error(`Error copying directory from ${src} to ${dest}:`, err);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting production build process for Netlify');
  
  try {
    // Create dist directory
    await fs.mkdir(distDir, { recursive: true });
    console.log('✅ Created dist directory');
    
    // Copy public directory to dist if it exists
    try {
      await fs.access(publicDir);
      console.log('📂 Copying public directory to dist');
      const copied = await copyDir(publicDir, distDir);
      if (copied) {
        console.log('✅ Successfully copied public directory to dist');
      }
    } catch (err) {
      console.log('ℹ️ No public directory found');
    }
    
    // Run the actual Vite build
    console.log('🔨 Running Vite build...');
    
    const buildProcess = spawn('npx', ['vite', 'build'], { 
      env: { ...process.env, ROLLUP_WASM_NODE: '1' },
      stdio: 'inherit',
      cwd: rootDir
    });
    
    const exitCode = await new Promise((resolve) => {
      buildProcess.on('close', (code) => {
        console.log(`Build process exited with code ${code}`);
        resolve(code);
      });
    });
    
    if (exitCode === 0) {
      console.log('✅ Build completed successfully');
    } else {
      throw new Error(`Vite build failed with exit code ${exitCode}`);
    }
    
    // Ensure index.html exists
    try {
      await fs.access(path.join(distDir, 'index.html'));
      console.log('✅ index.html exists in dist');
    } catch (err) {
      console.error('❌ index.html not found after build - this is unexpected');
      throw err;
    }
    
    console.log('🎉 Netlify build process completed successfully');
  } catch (err) {
    console.error('❌ Build failed:', err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Build script failed:', err);
  // Exit with error code to signal build failure
  process.exit(1);
}); 