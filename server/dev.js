import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['server/signaling-server.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];

function shutdown() {
  processes.forEach((child) => child.kill());
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
