const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files
app.use(express.static(path.join(__dirname, ".")));

// HTTP server
const server = http.createServer(app);

// WebSocket server on same HTTP server
const wss = new WebSocket.Server({ server });

let connectedClients = [];

// WebSocket signaling + broadcast
wss.on("connection", (ws) => {
  console.log("✅ New client connected.");
  connectedClients.push(ws);

  ws.on("message", (message) => {
    console.log("📩 Received:", message.toString());

    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (err) {
      console.error("❌ Invalid JSON:", message.toString());
      return;
    }

    // Handle initial join message to trigger the offer
    if (data.type === 'join_call' && connectedClients.length === 2) {
        // The second user to join will receive this message
        connectedClients[0].send(JSON.stringify({ type: 'user_joined' }));
        return;
    }

    // Broadcast to the other client (only one other client)
    const otherClient = connectedClients.find(client => client !== ws);
    if (otherClient && otherClient.readyState === WebSocket.OPEN) {
      otherClient.send(JSON.stringify(data));
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected.");
    connectedClients = connectedClients.filter(client => client !== ws);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});