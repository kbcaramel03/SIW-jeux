// Connexion Socket.IO unique, authentifiée avec le jeton.
import { io } from 'socket.io-client';
import { getToken } from './api.js';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({ auth: { token: getToken() }, autoConnect: true });
  }
  return socket;
}

export function reconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  return getSocket();
}

export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
