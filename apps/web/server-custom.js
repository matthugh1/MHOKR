const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || 3000;
let nextApp;
let nextHandle;
let bootError = null;
let isReady = false;

// Helper to list files for debugging
function tryListFiles() {
    try {
        return fs.readdirSync(__dirname);
    } catch (e) {
        return ['Error listing files: ' + e.message];
    }
}

// Start server immediately (Bootloader)
const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // 1. Boot Status Endpoint - Always available
    if (pathname === '/api/boot-status') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            status: isReady ? 'ready' : (bootError ? 'failed' : 'booting'),
            error: bootError ? bootError.toString() : null,
            stack: bootError ? bootError.stack : null,
            env: {
                NODE_ENV: process.env.NODE_ENV,
                PORT: process.env.PORT
            },
            cwd: process.cwd(),
            dirname: __dirname,
            files: tryListFiles()
        }, null, 2));
        return;
    }

    // 2. Handle Boot Errors
    if (bootError) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`Application failed to start:\n\n${bootError.stack || bootError}`);
        return;
    }

    // 3. Handle Booting State
    if (!isReady) {
        // Check if it's a static file request, maybe we can serve it even if Next isn't ready?
        // Best to wait, but for debugging, let's serve static files if possible.
        if (pathname.startsWith('/_next/static/') || pathname.startsWith('/public/')) {
            // Fall through to static handler
        } else {
            res.statusCode = 503;
            res.end('Application is booting... Refresh in a few seconds.');
            return;
        }
    }

    // 4. Static File Serving (Explicit)
    if (pathname.startsWith('/_next/static/')) {
        const relativePath = pathname.replace('/_next/static/', '');
        const filePath = path.join(__dirname, '.next/static', relativePath);
        serveFile(res, filePath);
        return;
    }

    // 5. Public File Serving
    const publicFilePath = path.join(__dirname, 'public', pathname);
    if (fs.existsSync(publicFilePath) && fs.statSync(publicFilePath).isFile()) {
        serveFile(res, publicFilePath);
        return;
    }

    // 6. Delegate to Next.js
    if (isReady && nextHandle) {
        nextHandle(req, res, parsedUrl);
    } else {
        res.statusCode = 500;
        res.end('Server state inconsistent');
    }
});

server.listen(port, (err) => {
    if (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
    console.log(`> Bootloader listening on http://localhost:${port}`);

    // Initialize Next.js in background
    initNext();
});

async function initNext() {
    try {
        console.log('Initializing Next.js...');
        // Check if 'next' module exists
        try {
            require.resolve('next');
        } catch (e) {
            throw new Error(`Cannot find module 'next'. NODE_PATH=${process.env.NODE_ENV}`);
        }

        const next = require('next');
        const dev = process.env.NODE_ENV !== 'production';
        nextApp = next({ dev, dir: __dirname });
        nextHandle = nextApp.getRequestHandler();
        await nextApp.prepare();
        isReady = true;
        console.log('Next.js ready!');
    } catch (err) {
        console.error('Failed to initialize Next.js:', err);
        bootError = err;
    }
}

function serveFile(res, filePath) {
    if (fs.existsSync(filePath)) {
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
            '.otf': 'font/otf'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.statusCode = 404;
        res.end('File not found');
    }
}
