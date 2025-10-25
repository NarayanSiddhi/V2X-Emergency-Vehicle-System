// server.js - RSU (Roadside Unit) server with HTTP + Socket.IO
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { handleEvRequest } = require('./controllers/rsuController');

const app = express();
app.use(cors());
app.use(express.json());

// serve dashboard static files
app.use('/', express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// ensure logs directory exists
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// simple health endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// REST endpoint to accept EV priority request (optional)
app.post('/api/ev_priority', async (req, res) => {
    try {
        const evMsg = req.body;
        // handleEvRequest returns the RSU action (for now simulated)
        const rsuAction = await handleEvRequest(evMsg, io);
        return res.json({ status: 'accepted', action: rsuAction });
    } catch (err) {
        console.error('Error in /api/ev_priority', err);
        res.status(500).json({ error: 'server error' });
    }
});

// Socket.IO connection: dashboard or mock clients connect here
io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // optionally accept EV broadcasts over socket too
    socket.on('ev_priority', async (msg) => {
        console.log('Received EV message via socket:', msg.ev_id || msg);
        try {
            const action = await handleEvRequest(msg, io);
            // optionally send RSU response back to EV client (if EV is connected)
            socket.emit('rsu_response', action);
        } catch (err) {
            console.error('handleEvRequest error', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
    });
});

// start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`RSU server listening on http://localhost:${PORT}`);
    console.log(`Open dashboard at http://localhost:${PORT}/index.html`);
});
