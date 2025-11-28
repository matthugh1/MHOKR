const http = require('http');
const fs = require('fs');
const port = process.env.PORT || 3000;

// Write startup log
const startupLog = `Server started at ${new Date().toISOString()}\nPORT: ${port}\nCWD: ${process.cwd()}\nNode: ${process.version}\n`;
try {
    fs.writeFileSync('startup-probe.txt', startupLog);
    console.log('Startup log written');
} catch (e) {
    console.error('Failed to write startup log:', e);
}

console.log('Starting Minimal Server (Probe 4)...');
console.log(startupLog);

const server = http.createServer((req, res) => {
    console.log('Request:', req.url);

    // Serve startup log
    if (req.url === '/startup-log') {
        try {
            const log = fs.readFileSync('startup-probe.txt', 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end(log);
        } catch (e) {
            res.statusCode = 500;
            res.end('Error reading log: ' + e.message);
        }
        return;
    }

    // Default response
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        message: 'Hello from Minimal Server (Probe 4)',
        deployedAt: '2025-11-28T12:45:00Z',
        node: process.version,
        port: port,
        env: process.env.NODE_ENV,
        cwd: process.cwd()
    }, null, 2));
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
