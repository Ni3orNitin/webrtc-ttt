const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the current directory
app.use(express.static(__dirname));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let connectedClients = [];

wss.on("connection", (ws) => {
  console.log("✅ New client connected.");
  connectedClients.push(ws);
  
  // FIX: When a second client connects, tell the first one to start the call.
  if (connectedClients.length === 2) {
    connectedClients[0].send(JSON.stringify({ type: 'peer_connected' }));
  }

  ws.on("message", (message) => {
    console.log("📩 Received:", message.toString());

    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (err) {
      console.error("❌ Invalid JSON:", message.toString());
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

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});