import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true, // IMPORTANT: Allows sending cookies for JWT auth
});

export default api;
