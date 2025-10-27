// ============================
// server.js (RSU + Dashboard)
// ============================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve dashboard frontend
app.use(express.static(path.join(__dirname, "public")));

// Store RSU decisions for dashboard
let rsuLog = [];

// ============================
//   RSU Logic
// ============================

// When a client connects (Python control.py)
io.on("connection", (socket) => {
    console.log("🚘 Connected to SUMO control.py");

    // Initial event to confirm connection on dashboard
    io.emit("rsu_decision", {
        tls_id: "RSU_SERVER",
        action: "connected",
        duration: 0,
        reason: "Server is live and ready",
        timestamp: new Date().toLocaleTimeString()
    });

    socket.on("ev_update", (data) => {
        console.log("📍 EV update received:", data);

        if (data.tls_id && data.distance < 100) {
            const decision = {
                tls_id: data.tls_id || "Unknown RSU",
                action: "extend_green_5s",
                duration: 5,
                reason: "EV approaching intersection",
                timestamp: new Date().toLocaleTimeString()
            };
            io.emit("rsu_decision", decision);
            rsuLog.push(decision);
            console.log("✅ Sent RSU decision:", decision);
        }
    });

    socket.on("disconnect", () => {
        console.log("❌ Disconnected from SUMO control.py");
    });
});


// ============================
//   Dashboard API
// ============================
app.get("/api/logs", (req, res) => {
    res.json(rsuLog);
});

// ============================
//   Start Server
// ============================
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚦 RSU server running on port ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
});
