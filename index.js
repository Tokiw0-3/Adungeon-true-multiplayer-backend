export class Lobby {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Set();
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(webSocket) {
    this.clients.add(webSocket);
    webSocket.accept();

    webSocket.addEventListener('message', (event) => {
      // Broadcast message to all other clients in this lobby
      for (const client of this.clients) {
        if (client !== webSocket && client.readyState === 1) {
          client.send(event.data);
        }
      }
    });

    webSocket.addEventListener('close', () => {
      this.clients.delete(webSocket);
    });
  }
}

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Dungeon Collab</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f4f6f8;
      margin: 0;
      padding: 2em 1em;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      box-sizing: border-box;
    }
    .container {
      background: #fff;
      padding: 2.5em 3em;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.12);
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    h1 {
      color: #2c3e50;
      margin-bottom: 1.2em;
      font-weight: 700;
      font-size: 1.8rem;
    }
    input[type="text"] {
      padding: 12px 15px;
      font-size: 1rem;
      width: 100%;
      border: 2px solid #ddd;
      border-radius: 6px;
      box-sizing: border-box;
      transition: border-color 0.3s ease;
    }
    input[type="text"]:focus {
      border-color: #3498db;
      outline: none;
    }
    .buttons {
      margin-top: 1.5em;
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    button {
      flex: 1;
      padding: 12px 0;
      font-size: 1rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.3s ease;
      color: white;
      font-weight: 600;
    }
    button#create {
      background-color: #27ae60;
    }
    button#create:hover {
      background-color: #1e8449;
    }
    button#join {
      background-color: #3498db;
    }
    button#join:hover {
      background-color: #2980b9;
    }
    #info {
      margin-top: 1.5em;
      font-weight: 600;
      font-size: 1.1rem;
      color: #555;
      min-height: 1.5em;
      word-break: break-word;
    }
    #info.success {
      color: #27ae60;
    }
    #info.error {
      color: #e74c3c;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>AI Dungeon Collab</h1>
    <input type="text" id="code" placeholder="Enter a session code" autocomplete="off" spellcheck="false" />
    <div class="buttons">
      <button id="create">Create New Session</button>
      <button id="join">Join Session</button>
    </div>
    <p id="info"></p>

    <textarea id="input1" rows="4" placeholder="Your input here..."></textarea>
    <textarea id="input2" rows="4" placeholder="Collaborator's input..." readonly></textarea>
  </div>

  <script>
    const codeInput = document.getElementById('code');
    const info = document.getElementById('info');
    const createBtn = document.getElementById('create');
    const joinBtn = document.getElementById('join');

    const input1 = document.getElementById('input1');
    const input2 = document.getElementById('input2');

    let ws = null;

    function generateCode() {
      return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    function connectWebSocket(sessionCode) {
      if (ws) {
        ws.close();
        ws = null;
      }
      ws = new WebSocket(\`wss://aidungeon-multiplayer-fix.bagrat0209.workers.dev/ws?session=\${sessionCode}\`);

      ws.onopen = () => {
        info.textContent = 'Connected to session ' + sessionCode;
        info.className = 'success';
      };

      ws.onmessage = (event) => {
        input2.value = event.data;
      };

      ws.onclose = () => {
        info.textContent = 'Disconnected from session.';
        info.className = '';
      };

      ws.onerror = (err) => {
        info.textContent = 'WebSocket error: ' + err.message;
        info.className = 'error';
      };
    }

    createBtn.addEventListener('click', () => {
      let code = codeInput.value.trim();
      if (!code) {
        code = generateCode();
        codeInput.value = code;
      }
      info.textContent = 'New session created with code: ' + code;
      info.className = 'success';
      connectWebSocket(code);
    });

    joinBtn.addEventListener('click', () => {
      const code = codeInput.value.trim();
      if (!code) {
        info.textContent = 'Please enter a valid session code to join.';
        info.className = 'error';
        return;
      }
      info.textContent = 'Joining session: ' + code;
      info.className = 'success';
      connectWebSocket(code);
    });

    input1.addEventListener('input', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(input1.value);
      }
    });
  </script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      // WebSocket upgrade request, route to Durable Object
      const session = url.searchParams.get("session") || "default";
      const id = env.LOBBY.idFromName(session);
      const obj = env.LOBBY.get(id);
      return obj.fetch(request);
    }

    // Serve the collaboration page
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(INDEX_HTML, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
