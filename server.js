const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// This line correctly points the server to your 'public' folder.
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let connectedClients = [];

wss.on("connection", (ws) => {
  console.log("✅ New client connected.");
  connectedClients.push(ws);
  
  if (connectedClients.length === 2) {
    connectedClients[0].send(JSON.stringify({ type: 'peer_connected' }));
  }

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (err) {
      console.error("❌ Invalid JSON:", message.toString());
      return;
    }

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