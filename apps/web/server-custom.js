const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

console.log('Starting custom server...');
console.log(`CWD: ${process.cwd()}`);
console.log(`__dirname: ${__dirname}`);

// Verify static directory exists
const staticDir = path.join(__dirname, '.next/static');
if (fs.existsSync(staticDir)) {
    console.log(`✅ .next/static found at: ${staticDir}`);
    // List some files
    try {
        const files = fs.readdirSync(staticDir);
        console.log('Files in .next/static:', files.slice(0, 5));
    } catch (e) {
        console.error('Error listing .next/static:', e);
    }
} else {
    console.error(`❌ .next/static NOT found at: ${staticDir}`);
    // Try to find where it is
    try {
        console.log('Listing root directory:');
        console.log(fs.readdirSync(__dirname));
    } catch (e) { }
}

app.prepare().then(() => {
    createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        const { pathname } = parsedUrl;

        // Explicitly handle static files to debug/ensure serving
        if (pathname.startsWith('/_next/static/')) {
            const relativePath = pathname.replace('/_next/static/', '');
            const filePath = path.join(__dirname, '.next/static', relativePath);

            if (fs.existsSync(filePath)) {
                // Basic mime types
                if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
                if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
                if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
                if (filePath.endsWith('.woff2')) res.setHeader('Content-Type', 'font/woff2');
                if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
                if (filePath.endsWith('.jpg')) res.setHeader('Content-Type', 'image/jpeg');
                if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');

                fs.createReadStream(filePath).pipe(res);
                return;
            } else {
                console.log(`[404] Static file not found: ${filePath}`);
            }
        }

        // Handle public files
        if (pathname.startsWith('/public/')) {
            // ... usually public files are served at root, e.g. /favicon.ico
        }

        // Fallback to Next.js handler
        handle(req, res, parsedUrl);
    }).listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${port}`);
    });
});
