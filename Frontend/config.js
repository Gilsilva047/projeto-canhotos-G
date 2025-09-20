// Frontend/config.js - Configuração de ambiente (FINAL)

// Detecta automaticamente se está em desenvolvimento ou produção
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// URL do seu backend no Render.
const productionApiUrl = 'https://projeto-canhotos-g.onrender.com'; 

export const API_BASE_URL = isDevelopment 
    ? 'http://localhost:4000'  // Desenvolvimento local
    : productionApiUrl;        // Produção (Render)