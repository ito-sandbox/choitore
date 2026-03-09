const { spawn } = require('child_process');
const path = require('path');

const dir = path.join(__dirname);
const vite = path.join(dir, 'node_modules', '.bin', 'vite');

const child = spawn(process.platform === 'win32' ? vite + '.cmd' : vite, ['--port', '5174', '--host'], {
  cwd: dir,
  stdio: 'inherit',
  shell: true,
  windowsHide: true,
});

child.on('error', (err) => {
  console.error('Failed to start vite:', err);
  process.exit(1);
});
