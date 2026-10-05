import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Serve static files from the 'dist' directory
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

app.use(express.static(distPath));

// Handle SPA routing: redirect all requests to index.html
app.get('*', (req, res) => {
  console.log(`[Server] Request: ${req.url}`);
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error(`[Server] index.html NOT found at ${indexPath}`);
    res.status(404).send(`<h1>App not built</h1><p>Please wait or rebuild. Missing: ${indexPath}</p>`);
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[Server] Running on port ${port}`);
  console.log(`[Server] Dist path: ${distPath}`);
  console.log(`[Server] Index.html exists: ${fs.existsSync(indexPath)}`);
});
