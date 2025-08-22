// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/healthz", (_req, res) => res.send("ok"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// WebSocket signaling
wss.on("connection", (ws) => {
  console.log("✅ New client connected");

  // Keep-alive (helps prevent timeout on some hosts)
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (message) => {
    console.log("📩 Received:", message);

    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error("❌ Invalid JSON:", message);
      return;
    }

    // ✅ Broadcast to all other clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => console.log("❌ Client disconnected"));
});

// Ping clients periodically (avoid idle disconnects)
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
