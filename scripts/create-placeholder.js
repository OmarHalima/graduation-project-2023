// Simple script to create a placeholder index.html
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distPath, 'index.html');

async function createPlaceholder() {
  try {
    // Check if index.html already exists
    await fs.access(indexPath);
    console.log('✅ index.html already exists in dist');
  } catch (e) {
    // Create placeholder if it doesn't exist
    console.log('📝 Creating placeholder index.html');
    
    const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Graduation Project</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
</head>
<body class="bg-gray-100">
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
      <div class="flex justify-center">
        <div class="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
          GP
        </div>
      </div>
      <h1 class="mt-6 text-3xl font-bold text-center text-gray-800">Graduation Project</h1>
      <p class="mt-4 text-center text-gray-600">
        Your project has been successfully deployed! This is a static placeholder page.
      </p>
      <div class="mt-8 p-4 bg-blue-50 rounded-md border-l-4 border-blue-500">
        <p class="text-sm text-blue-800">
          <strong>Note:</strong> The application is using a static deployment while resolving build configuration issues. 
          To deploy with full functionality, please update your build configuration.
        </p>
      </div>
      <div class="mt-8 flex justify-center">
        <p class="text-green-600 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          Deployment successful
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
    
    await fs.writeFile(indexPath, content);
    console.log('✅ Placeholder created successfully');
  }
}

createPlaceholder().catch(err => {
  console.error('❌ Error creating placeholder:', err);
  process.exit(1);
}); 