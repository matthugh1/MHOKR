const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || 3000;
let nextApp;
let nextHandle;
let bootError = null;
let isReady = false;

// Simple file logger
function log(msg) {
    const time = new Date().toISOString();
    const line = `[${time}] ${msg}\n`;
    console.log(msg);
    try {
        fs.appendFileSync('startup.log', line);
    } catch (e) {
        // ignore
    }
}

log('Starting custom server (Probe 2)...');
log(`CWD: ${process.cwd()}`);
log(`__dirname: ${__dirname}`);
log(`PORT: ${port}`);

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

    // 1. Boot Status Endpoint
    if (pathname === '/api/boot-status') {
        res.setHeader('Content-Type', 'application/json');
        let logs = '';
        try { logs = fs.readFileSync('startup.log', 'utf8'); } catch (e) { logs = e.message; }

        res.end(JSON.stringify({
            status: isReady ? 'ready' : 'disabled',
            error: bootError ? bootError.toString() : null,
            env: { NODE_ENV: process.env.NODE_ENV, PORT: process.env.PORT },
            cwd: process.cwd(),
            files: tryListFiles(),
            logs: logs
        }, null, 2));
        return;
    }

    // 2. Hello Endpoint
    if (pathname === '/api/hello') {
        res.end('Hello from Probe 2');
        return;
    }

    // 3. Static File Serving (Explicit)
    if (pathname.startsWith('/_next/static/')) {
        const relativePath = pathname.replace('/_next/static/', '');
        const filePath = path.join(__dirname, '.next/static', relativePath);
        serveFile(res, filePath);
        return;
    }

    // 4. Public File Serving
    const publicFilePath = path.join(__dirname, 'public', pathname);
    if (fs.existsSync(publicFilePath) && fs.statSync(publicFilePath).isFile()) {
        serveFile(res, publicFilePath);
        return;
    }

    // 5. Fallback
    res.statusCode = 404;
    res.end('Next.js is disabled in this probe. Use /api/boot-status to check logs.');
});

server.listen(port, (err) => {
    if (err) {
        log('Failed to start server: ' + err);
        process.exit(1);
    }
    log(`> Bootloader listening on http://localhost:${port}`);

    // DISABLED NEXT.JS INIT FOR DIAGNOSIS
    // initNext();
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
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff2': 'font/woff2'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.statusCode = 404;
        res.end('File not found');
    }
}
