import { io } from 'socket.io-client';

// Dynamically determine backend URL based on the browser's current location
// This assumes backend runs on port 3001 on the same host
const protocol = window.location.protocol;
const hostname = window.location.hostname;
const BACKEND_URL = `${protocol}//${hostname}:3001`;

console.log('Connecting to backend at:', BACKEND_URL);

export const socket = io(BACKEND_URL);
export const API_URL = BACKEND_URL;