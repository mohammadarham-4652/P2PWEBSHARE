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

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeKey(key: PeerKey): string {
  const json = JSON.stringify(key);
  return toBase64Url(json);
}

export function decodeKey(encoded: string): PeerKey | null {
  try {
    const bytes = fromBase64Url(encoded);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}
