import { spawn } from 'node:child_process';

const command = process.execPath;
const args = ['scripts/run-frontend-production-redesign-check.mjs'];

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});

child.on('error', (error) => {
  console.error('Could not run frontend production redesign check:', error);
  process.exitCode = 1;
});
