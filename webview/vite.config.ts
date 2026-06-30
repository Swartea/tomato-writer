import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist/webview',
    assetsDir: 'assets',
    // 固定文件名，避免 hash 导致 VS Code Webview 找不到资源
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      },
        output: {
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: (assetInfo) => {
            // CSS 文件固定为 index.css，其他保持原名
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'assets/index.css';
            }
            return 'assets/[name].[ext]';
          }
        }
    }
  }
});
