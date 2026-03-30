import { Peer, DataConnection } from 'peerjs';

export type TransferState = 'idle' | 'connecting' | 'connected' | 'transferring' | 'completed' | 'error';

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

export interface PeerKey {
  peerId: string;
  senderName: string;
  timestamp: number;
}

export function encodeKey(key: PeerKey): string {
  const json = JSON.stringify(key);
  return btoa(json);
}

export function decodeKey(encoded: string): PeerKey | null {
  try {
    const json = atob(encoded);
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}
