// ===========================================
// dashboard.js — fixed structured event logic
// ===========================================

// Connect to socket.io server
const socket = io("http://localhost:3000");

// Helper: safely add formatted event HTML
function addEventHtml(dec) {
    const eventList = document.getElementById("events");
    if (!eventList) return;

    // Ensure it's an object, not a string
    if (typeof dec !== "object") {
        console.warn("⚠️ Invalid event payload:", dec);
        return;
    }

    const tls = dec.tls_id || "Unknown RSU";
    const action = dec.action || "No Action";
    const reason = dec.reason || "No Reason Provided";
    const time = dec.timestamp || new Date().toLocaleTimeString();

    const item = document.createElement("div");
    item.className = "event-item";
    item.style.borderBottom = "1px solid #333";
    item.style.padding = "6px";

    item.innerHTML = `
    <b>${time}</b> — 
    <span><strong>${tls}</strong></span> | 
    <span>${action}</span> | 
    <span>${reason}</span>
  `;

    // Add color styling
    if (action.toLowerCase().includes("connected")) {
        item.style.color = "limegreen";
    } else if (action.toLowerCase().includes("extend")) {
        item.style.color = "dodgerblue";
    } else if (action.toLowerCase().includes("stop")) {
        item.style.color = "red";
    } else {
        item.style.color = "black";
    }

    eventList.prepend(item);
}

// ============================
// Socket.IO Event Handlers
// ============================

// Connection acknowledgement
socket.on("connect", () => {
    console.log("✅ Connected to RSU server", socket.id);
});

// Disconnection notice
socket.on("disconnect", () => {
    console.warn("❌ Disconnected from RSU server");
    addEventHtml({
        tls_id: "RSU_SERVER",
        action: "disconnected",
        reason: "Server unreachable",
        timestamp: new Date().toLocaleTimeString()
    });
});

// RSU decision events
socket.on("rsu_decision", (dec) => {
    console.log("🟢 RSU Decision received:", dec);
    addEventHtml(dec);
});

// EV update events (optional)
socket.on("ev_event", (ev) => {
    console.log("🚗 EV event:", ev);
    addEventHtml({
        tls_id: ev.tls_id || "EV",
        action: "update",
        reason: `EV ETA: ${ev.eta_seconds}s | Speed: ${ev.speed.toFixed(1)} m/s`,
        timestamp: new Date().toLocaleTimeString()
    });
});
