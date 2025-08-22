const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Serve static files from the current directory
app.use(express.static(__dirname));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let connectedClients = [];

wss.on("connection", (ws) => {
  console.log("✅ New client connected.");
  connectedClients.push(ws);

  // FIX: This section now handles the handshake based on a 'client_ready' message
  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    
    if (data.type === 'client_ready' && connectedClients.length === 2) {
      connectedClients[0].send(JSON.stringify({ type: 'peer_connected' }));
      return;
    }
    
    // Broadcast other signaling messages to the other client
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

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});