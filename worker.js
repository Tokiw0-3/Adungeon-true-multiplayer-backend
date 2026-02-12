// Cloudflare Worker for AI Dungeon Multiplayer with Story Cards
// Deploy this to Cloudflare Workers

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (url.pathname === '/ws') {
      return handleWebSocket(request);
    }
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    // Basic info endpoint
    return new Response('AI Dungeon Multiplayer Server with Story Cards', {
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

// Session management
const sessions = new Map();

function handleWebSocket(request) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const url = new URL(request.url);
  const sessionCode = url.searchParams.get('session');
  
  if (!sessionCode) {
    return new Response('Session code required', { status: 400 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  // Get or create session
  if (!sessions.has(sessionCode)) {
    sessions.set(sessionCode, {
      clients: new Set(),
      state: {
        text: '',
        column: '',
        cards: new Map(), // cardId -> cardData
      },
    });
  }

  const session = sessions.get(sessionCode);
  session.clients.add(server);

  // Send current state to new client
  if (session.state.text) {
    server.send(JSON.stringify({ 
      type: 'text-update', 
      content: session.state.text 
    }));
  }
  
  if (session.state.column) {
    server.send(JSON.stringify({ 
      type: 'column-update', 
      content: session.state.column 
    }));
  }

  // Send all existing cards
  session.state.cards.forEach((cardData, cardId) => {
    server.send(JSON.stringify({
      type: 'card-update',
      cardId: cardData.cardId,
      cardIndex: cardData.cardIndex,
      data: cardData.data,
    }));
  });

  server.accept();

  server.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Update session state
      if (data.type === 'text-update') {
        session.state.text = data.content;
      } else if (data.type === 'column-update') {
        session.state.column = data.content;
      } else if (data.type === 'card-update') {
        // Store card state
        session.state.cards.set(data.cardId, {
          cardId: data.cardId,
          cardIndex: data.cardIndex,
          data: data.data,
        });
      } else if (data.type === 'card-delete') {
        // Remove card from state
        session.state.cards.delete(data.cardId);
      }

      // Broadcast to all other clients in the session
      session.clients.forEach((otherClient) => {
        if (otherClient !== server && otherClient.readyState === WebSocket.OPEN) {
          otherClient.send(event.data);
        }
      });
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  server.addEventListener('close', () => {
    session.clients.delete(server);
    
    // Clean up empty sessions
    if (session.clients.size === 0) {
      sessions.delete(sessionCode);
    }
  });

  server.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
    session.clients.delete(server);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
