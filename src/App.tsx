/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Peer, DataConnection } from 'peerjs';
import { 
  Share2, 
  Download, 
  Upload, 
  File, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Copy, 
  Check,
  Shield,
  Zap,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { TransferState, FileMetadata, PeerKey, encodeKey, decodeKey } from './types';

export default function App() {
  const [mode, setMode] = useState<'initial' | 'send' | 'receive'>('initial');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [receiverKey, setReceiverKey] = useState<string>('');
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [transferState, setTransferState] = useState<TransferState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [receivedFile, setReceivedFile] = useState<{ blob: Blob; metadata: FileMetadata } | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [remotePeerName, setRemotePeerName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileMeta = useRef<{ name: string; type: string } | null>(null);

  // Initialize Peer
  useEffect(() => {
    const newPeer = new Peer(undefined, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
        iceTransportPolicy: 'all',
        sdpSemantics: 'unified-plan',
      },
    });
    
    newPeer.on('open', (id) => {
      setPeerId(id);
      setPeer(newPeer);
    });

    newPeer.on('connection', (conn) => {
      setConnection(conn);
      setupConnection(conn);
    });

    newPeer.on('error', (err) => {
      console.error('Peer error:', err);
      setError('Connection error. Please try again.');
      setTransferState('error');
    });

    return () => {
      newPeer.destroy();
    };
  }, []);

  const setupConnection = (conn: DataConnection) => {
    setTransferState('connecting');
    
    conn.on('open', () => {
      setTransferState('connected');
      // Send our name if we are the sender
      if (mode === 'send') {
        conn.send({ type: 'name', name: senderName });
      }
    });

    conn.on('data', (data: any) => {
      if (data.type === 'name') {
        setRemotePeerName(data.name);
      } else if (data.type === 'file-start') {
        // Store incoming file metadata so we can label the blob correctly
        pendingFileMeta.current = { name: data.name, type: data.fileType };
        setTransferState('transferring');
        setProgress(0);
      } else if (data instanceof Blob || data instanceof ArrayBuffer) {
        // Received the actual file — attach stored metadata
        const meta = pendingFileMeta.current;
        const mimeType = meta?.type || '';
        const blob = data instanceof Blob
          ? new Blob([data], { type: mimeType })
          : new Blob([data], { type: mimeType });
        setReceivedFile({
          blob,
          metadata: {
            name: meta?.name || 'received-file',
            size: blob.size,
            type: mimeType
          }
        });
        pendingFileMeta.current = null;
        setTransferState('completed');
        setProgress(100);
      }
    });

    conn.on('close', () => {
      setTransferState('idle');
      setConnection(null);
    });

    conn.on('error', (err) => {
      setError('Connection lost.');
      setTransferState('error');
    });
  };

  const handleConnect = () => {
    if (!peer || !receiverKey) return;
    
    const decoded = decodeKey(receiverKey);
    if (!decoded) {
      setError('Invalid share key.');
      return;
    }

    setRemotePeerName(decoded.senderName);
    const conn = peer.connect(decoded.peerId, {
      metadata: { name: 'receiver' }
    });
    setConnection(conn);
    setupConnection(conn);
    setMode('receive');
  };

  const handleSendFile = () => {
    if (!connection || !selectedFile) return;

    setTransferState('transferring');
    setProgress(10);

    // First send file metadata so the receiver knows the name and type
    connection.send({
      type: 'file-start',
      name: selectedFile.name,
      fileType: selectedFile.type,
      size: selectedFile.size,
    });

    // Then send the actual file blob
    connection.send(selectedFile);

    // Simulate progress (PeerJS doesn't expose per-chunk progress for simple sends)
    let p = 10;
    const interval = setInterval(() => {
      p += Math.random() * 20;
      if (p >= 95) {
        clearInterval(interval);
        setProgress(100);
        setTransferState('completed');
      } else {
        setProgress(p);
      }
    }, 200);
  };

  const copyKey = () => {
    const key = encodeKey({
      peerId,
      senderName,
      timestamp: Date.now()
    });
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = () => {
    if (!receivedFile) return;
    const url = URL.createObjectURL(receivedFile.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = receivedFile.metadata.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const reset = () => {
    setMode('initial');
    setTransferState('idle');
    setSelectedFile(null);
    setReceivedFile(null);
    setProgress(0);
    setError(null);
    if (connection) connection.close();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-500 mb-4"
          >
            <Share2 size={32} />
          </motion.div>
          <h1 className="text-4xl font-bold tracking-tight">PeerShare</h1>
          <p className="text-zinc-400">Secure P2P file sharing. No servers, no logs.</p>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'initial' && (
            <motion.div 
              key="initial"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setMode('send')}
                  className="glass-card p-6 flex flex-col items-center gap-3 hover:border-blue-500/50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-600/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={24} />
                  </div>
                  <span className="font-semibold">Send Files</span>
                </button>
                <button 
                  onClick={() => setMode('receive')}
                  className="glass-card p-6 flex flex-col items-center gap-3 hover:border-emerald-500/50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-600/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Download size={24} />
                  </div>
                  <span className="font-semibold">Receive Files</span>
                </button>
              </div>
              
              <div className="glass-card p-4 flex items-start gap-3 text-sm text-zinc-400">
                <Shield size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <p>Files are transferred directly between browsers. Your data never touches our servers.</p>
              </div>
            </motion.div>
          )}

          {mode === 'send' && (
            <motion.div 
              key="send"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-card p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Upload size={20} className="text-blue-500" />
                  Send File
                </h2>
                <button onClick={reset} className="text-sm text-zinc-500 hover:text-zinc-300">Cancel</button>
              </div>

              {!connection ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                      <User size={14} /> Your Name
                    </label>
                    <input 
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {senderName && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                      <p className="text-sm text-zinc-400">Share this key with the receiver:</p>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 font-mono text-xs truncate flex items-center">
                          {encodeKey({ peerId, senderName, timestamp: Date.now() })}
                        </div>
                        <button 
                          onClick={copyKey}
                          className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                        >
                          {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Loader2 size={12} className="animate-spin" />
                        Waiting for connection...
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Connected to</p>
                      <p className="font-semibold">{remotePeerName || 'Peer'}</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                      selectedFile ? "border-blue-500 bg-blue-500/5" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50"
                    )}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                    {selectedFile ? (
                      <div className="space-y-2">
                        <File size={32} className="mx-auto text-blue-500" />
                        <p className="font-medium truncate">{selectedFile.name}</p>
                        <p className="text-xs text-zinc-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload size={32} className="mx-auto text-zinc-600" />
                        <p className="text-zinc-400">Click to select a file</p>
                        <p className="text-xs text-zinc-600">Any file type up to 100MB</p>
                      </div>
                    )}
                  </div>

                  {transferState === 'transferring' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Sending...</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-blue-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {transferState === 'completed' && (
                    <div className="flex items-center gap-2 text-emerald-500 justify-center py-2">
                      <CheckCircle2 size={18} />
                      <span className="font-medium">Transfer Complete!</span>
                    </div>
                  )}

                  <button 
                    disabled={!selectedFile || transferState === 'transferring' || transferState === 'completed'}
                    onClick={handleSendFile}
                    className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                  >
                    <Zap size={18} />
                    Send File
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {mode === 'receive' && (
            <motion.div 
              key="receive"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-card p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Download size={20} className="text-emerald-500" />
                  Receive File
                </h2>
                <button onClick={reset} className="text-sm text-zinc-500 hover:text-zinc-300">Cancel</button>
              </div>

              {!connection ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Enter Share Key</label>
                    <textarea 
                      value={receiverKey}
                      onChange={(e) => setReceiverKey(e.target.value)}
                      placeholder="Paste the key from the sender"
                      rows={3}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 transition-colors font-mono text-xs resize-none"
                    />
                  </div>
                  <button 
                    disabled={!receiverKey}
                    onClick={handleConnect}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50"
                  >
                    Connect to Sender
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Connected to</p>
                      <p className="font-semibold">{remotePeerName || 'Peer'}</p>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-8 text-center bg-zinc-900/50">
                    {transferState === 'completed' && receivedFile ? (
                      <div className="space-y-4 animate-in zoom-in-95 duration-300">
                        <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
                        <div className="space-y-1">
                          <p className="font-semibold truncate">{receivedFile.metadata.name}</p>
                          <p className="text-xs text-zinc-500">{(receivedFile.metadata.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button 
                          onClick={downloadFile}
                          className="w-full btn-primary bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-2"
                        >
                          <Download size={18} />
                          Download File
                        </button>
                      </div>
                    ) : transferState === 'transferring' ? (
                      <div className="space-y-4">
                        <Loader2 size={32} className="mx-auto text-emerald-500 animate-spin" />
                        <p className="text-zinc-400">Receiving file...</p>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Loader2 size={32} className="mx-auto text-zinc-600 animate-spin" />
                        <p className="text-zinc-400">Waiting for sender to select file...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm"
          >
            <XCircle size={18} className="shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        {/* Footer info */}
        <div className="text-center text-xs text-zinc-600 space-y-1">
          <p>Powered by WebRTC • Direct Peer-to-Peer</p>
          <p>Your IP address is used only for signaling the initial connection.</p>
        </div>
      </div>
    </div>
  );
}
