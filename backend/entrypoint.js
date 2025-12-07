const { spawn } = require('child_process');

const useMock = String(process.env.USE_MOCK || '').toLowerCase() === 'true';
const script = useMock ? 'dist/server-mock.js' : 'dist/server.js';

console.log(`[Entrypoint] Starting backend with ${useMock ? 'MOCK' : 'REAL'} mode`);

const child = spawn('node', [script], { stdio: 'inherit' });

child.on('close', (code) => {
  console.log(`[Entrypoint] Backend exited with code ${code}`);
  process.exit(code);
});


