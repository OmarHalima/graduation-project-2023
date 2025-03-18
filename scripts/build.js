// Simple build script for Vercel deployment
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function buildStatic() {
  console.log('Building static site...');
  
  // Create dist directory
  await fs.mkdir(distDir, { recursive: true });
  
  // Copy public directory to dist
  if (await fs.stat(publicDir).catch(() => false)) {
    await copyDir(publicDir, distDir);
  }
  
  // Create a basic index.html if it doesn't exist
  const indexPath = path.join(distDir, 'index.html');
  const indexExists = await fs.stat(indexPath).catch(() => false);
  
  if (!indexExists) {
    const template = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Graduation Project</title>
    <script type="module" src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script type="module" src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root">
      <div class="flex min-h-screen flex-col items-center justify-center bg-gray-100">
        <div class="rounded-lg bg-white p-8 shadow-md">
          <h1 class="mb-4 text-2xl font-bold">Graduation Project</h1>
          <p class="text-gray-700">
            Your project is running! To customize this placeholder, replace this file with your actual application.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
    
    await fs.writeFile(indexPath, template);
  }
  
  console.log('Build completed successfully!');
}

// Run the build
buildStatic().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
}); 