// connect to socket.io server
const socket = io();

// container
const eventsDiv = document.getElementById('events');

function addEventHtml(html) {
    const el = document.createElement('div');
    el.className = 'ev';
    el.innerHTML = html;
    eventsDiv.prepend(el);
}

// on EV incoming
socket.on('ev_event', (ev) => {
    addEventHtml(`<div><strong>EV</strong> ${ev.ev_id} — ETA: ${ev.eta_seconds}s — pos: ${ev.position ? ev.position.lat + ',' + ev.position.lon : 'n/a'}</div>`);
});

// on RSU decision
socket.on('rsu_decision', (dec) => {
    addEventHtml(`<div class="decision">RSU Decision: ${dec.action} (duration: ${dec.duration}s) for TLS ${dec.tls_id} — ${dec.reason}</div>`);
});

// also show acknowledgement from server (optional)
socket.on('connect', () => {
    addEventHtml(`<div>Connected to RSU server (socket id ${socket.id})</div>`);
});
