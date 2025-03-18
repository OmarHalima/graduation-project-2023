const { spawn } = require('child_process');
const path = require('path');

// Start the frontend
const frontend = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// Start the backend
const backend = spawn('node', ['server/index.js'], {
  stdio: 'inherit',
  shell: true
});

// Log when processes exit
frontend.on('close', (code) => {
  console.log(`Frontend process exited with code ${code}`);
});

backend.on('close', (code) => {
  console.log(`Backend process exited with code ${code}`);
});

// Handle process termination
process.on('SIGINT', () => {
  frontend.kill('SIGINT');
  backend.kill('SIGINT');
  process.exit();
}); 