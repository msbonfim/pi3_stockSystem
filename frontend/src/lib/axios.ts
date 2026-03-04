import axios from "axios";

// Detecta automaticamente a URL do backend
const getBaseURL = () => {
  // Prioridade: VITE_API_URL > VITE_API_BASE_URL > auto-detect
  const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  
  if (apiUrl) {
    return apiUrl;
  }
  
  // Auto-detect: se estiver em localhost, usa localhost:8000, senão usa produção
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  
  return 'https://pi2-stocksystem-backend.onrender.com';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: { "Content-Type": "application/json" },
});

export default api;
export { api };
