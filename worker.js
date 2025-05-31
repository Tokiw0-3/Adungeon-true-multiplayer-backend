export class Lobby {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Set();
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const [client, server] = new WebSocketPair();
    server.accept();

    this.clients.add(server);

    server.addEventListener('close', () => {
      this.clients.delete(server);
    });

    server.addEventListener('message', (event) => {
      for (const client of this.clients) {
        if (client !== server) {
          client.send(event.data);
        }
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session');

    if (!sessionId) {
      return new Response('Missing session ID', { status: 400 });
    }

    const id = env.LOBBY.idFromName(sessionId);
    const obj = env.LOBBY.get(id);
    return obj.fetch(request);
  }
};
