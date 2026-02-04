import Peer, { DataConnection } from 'peerjs';

export class PeerService {
  peer: Peer | null = null;
  connections: DataConnection[] = [];
  hostConnection: DataConnection | null = null; // If we are client
  
  // Callbacks
  onData: (data: any, senderId: string) => void = () => {};
  onConnect: (peerId: string) => void = () => {};
  onDisconnect: (peerId: string) => void = () => {};

  constructor() {}

  async initialize(id?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use standard public PeerServer
      this.peer = new Peer(id, {
        debug: 1
      });

      this.peer.on('open', (id) => {
        console.log('My Peer ID:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });
    });
  }

  connectToHost(hostId: string) {
    if (!this.peer) return;
    const conn = this.peer.connect(hostId);
    this.hostConnection = conn;
    
    conn.on('open', () => {
      console.log('Connected to host');
      this.onConnect(hostId);
    });

    conn.on('data', (data) => {
      this.onData(data, hostId);
    });
    
    conn.on('close', () => this.onDisconnect(hostId));
    conn.on('error', (e) => console.error("Conn Error", e));
  }

  private handleConnection(conn: DataConnection) {
    this.connections.push(conn);
    
    conn.on('open', () => {
      console.log('Incoming connection from', conn.peer);
      this.onConnect(conn.peer);
    });

    conn.on('data', (data) => {
      this.onData(data, conn.peer);
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c.peer !== conn.peer);
      this.onDisconnect(conn.peer);
    });
  }

  broadcast(data: any) {
    this.connections.forEach(conn => {
      if(conn.open) conn.send(data);
    });
  }

  sendToHost(data: any) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(data);
    }
  }

  cleanup() {
    this.peer?.destroy();
    this.connections = [];
    this.hostConnection = null;
  }
}

export const peerService = new PeerService();
