const http = require('http');
const port = process.env.PORT || 3000;

console.log('Starting Minimal Server (Probe 3)...');

const server = http.createServer((req, res) => {
    console.log('Request:', req.url);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        message: 'Hello from Minimal Server (Probe 3)',
        node: process.version,
        port: port,
        env: process.env.NODE_ENV,
        cwd: process.cwd()
    }, null, 2));
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
