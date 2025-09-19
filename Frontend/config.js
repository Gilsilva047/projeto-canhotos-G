// Frontend/config.js - Configuração de ambiente

// Detecta automaticamente se está em desenvolvimento ou produção
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_BASE_URL = isDevelopment 
    ? 'http://localhost:4000'  // Desenvolvimento local
    : window.location.origin;  // Produção (Render)