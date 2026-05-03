import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // This tells Vite to look at every file in your node_modules
          if (id.includes('node_modules')) {
            
            // 1. Put all Firebase code into its own chunk
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            
            // 2. Put React core into its own chunk
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }

            // 3. Put your icons into their own chunk
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }

            // 4. Anything else goes into a generic 'vendor' chunk
            return 'vendor-core'; 
          }
        }
      }
    }
  }
})