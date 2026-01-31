import { io } from 'socket.io-client';

// REPLACE WITH YOUR ACTUAL LOCAL IP ADDRESS
const BACKEND_URL = `http://${import.meta.env.VITE_DEVICE_IP}:3001`; 

export const socket = io(BACKEND_URL);
export const API_URL = BACKEND_URL;