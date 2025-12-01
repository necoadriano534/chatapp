import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

let serverProcess: ChildProcess | null = null;

function backendPlugin() {
  return {
    name: 'backend-plugin',
    configureServer() {
      const startBackend = () => {
        if (serverProcess) {
          serverProcess.kill();
        }
        
        // Using spawn with explicit arguments array (safer than shell: true)
        // The command and arguments are hardcoded, not user-provided
        serverProcess = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', 
          ['tsx', 'server/index.ts'], 
          {
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'development' }
          }
        );

        serverProcess.on('error', (err) => {
          console.error('Failed to start backend:', err);
        });
      };

      startBackend();

      process.on('exit', () => {
        if (serverProcess) {
          serverProcess.kill();
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), backendPlugin()],
  root: './client',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
      '@server': path.resolve(__dirname, './server')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true
  }
});
