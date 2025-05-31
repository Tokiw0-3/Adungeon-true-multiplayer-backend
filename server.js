const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const sessions = {};

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);

      if (data.type === 'join' && data.sessionId) {
        ws.sessionId = data.sessionId;
        sessions[data.sessionId] = sessions[data.sessionId] || [];
        sessions[data.sessionId].push(ws);
        console.log(`Client joined session: ${data.sessionId}`);
        return;
      }

      if (data.type === 'update' && ws.sessionId) {
        const peers = sessions[ws.sessionId] || [];
        for (const peer of peers) {
          if (peer !== ws && peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify(data));
          }
        }
      }
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    if (ws.sessionId && sessions[ws.sessionId]) {
      sessions[ws.sessionId] = sessions[ws.sessionId].filter(client => client !== ws);
      if (sessions[ws.sessionId].length === 0) {
        delete sessions[ws.sessionId];
      }
      console.log(`Client disconnected from session: ${ws.sessionId}`);
    }
  });
});

// Serve static files from current directory (index.html etc.)
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Collab server listening on http://localhost:${PORT}`);
});
