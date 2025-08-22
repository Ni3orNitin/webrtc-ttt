const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/healthz", (_req, res) => res.send("ok"));

// HTTP server
const server = http.createServer(app);

// WebSocket server on same HTTP server
const wss = new WebSocket.Server({ server });

// WebSocket signaling + broadcast
wss.on("connection", (ws) => {
  console.log("✅ New client connected");

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

    // Broadcast to other clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => console.log("❌ Client disconnected"));
});

// Ping clients periodically
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
