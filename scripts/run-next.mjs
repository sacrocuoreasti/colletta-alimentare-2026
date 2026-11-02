import { spawn } from 'node:child_process';
const mode = process.argv[2];
if (!['dev', 'start'].includes(mode)) throw new Error('Modalità non valida');
const args = ['node_modules/next/dist/bin/next', mode];
if (mode === 'dev') args.push('--webpack');
args.push('--hostname', process.env.HOST || (mode === 'dev' ? '127.0.0.1' : '0.0.0.0'), '--port', process.env.PORT || '3000', ...process.argv.slice(3));
const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
