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

        // DEBUG ENDPOINT: List files to diagnose structure
        if (pathname === '/api/debug-files') {
            res.setHeader('Content-Type', 'application/json');
            try {
                const listFiles = (dir, depth = 0) => {
                    if (depth > 3) return ['...'];
                    let results = [];
                    const list = fs.readdirSync(dir);
                    list.forEach(file => {
                        const filePath = path.join(dir, file);
                        const stat = fs.statSync(filePath);
                        if (stat && stat.isDirectory()) {
                            if (file !== 'node_modules') { // Skip node_modules to keep output small
                                results = results.concat(listFiles(filePath, depth + 1).map(f => file + '/' + f));
                            } else {
                                results.push('node_modules/');
                            }
                        } else {
                            results.push(file);
                        }
                    });
                    return results;
                };

                const files = listFiles(__dirname);
                res.end(JSON.stringify({
                    cwd: process.cwd(),
                    dirname: __dirname,
                    files: files
                }, null, 2));
            } catch (e) {
                res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }

        // 1. Handle _next/static
        if (pathname.startsWith('/_next/static/')) {
            const relativePath = pathname.replace('/_next/static/', '');
            const filePath = path.join(__dirname, '.next/static', relativePath);
            serveFile(res, filePath);
            return;
        }

        // 2. Handle public files (served at root)
        // Try to find the file in the public directory
        const publicFilePath = path.join(__dirname, 'public', pathname);
        if (fs.existsSync(publicFilePath) && fs.statSync(publicFilePath).isFile()) {
            serveFile(res, publicFilePath);
            return;
        }

        // Fallback to Next.js handler
        handle(req, res, parsedUrl);
    }).listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${port}`);
    });
});

function serveFile(res, filePath) {
    if (fs.existsSync(filePath)) {
        // Basic mime types
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.otf': 'font/otf',
            '.eot': 'application/vnd.ms-fontobject'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
    } else {
        // Let Next.js handle 404s or maybe it's a dynamic route that looks like a file
        res.statusCode = 404;
        res.end('File not found');
    }
}
