// Frontend/auth.js (MÓDULO ES6 COMPLETO)

import { API_BASE_URL } from './config.js'; // Importa da configuração

// Exporta a URL da API
export { API_BASE_URL };

// Função para exibir mensagens na UI (genérica)
export function showPageMessage(elementId, msg, className = 'text-red-600') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = msg;
        element.className = `mt-4 text-center font-medium ${className}`;
        element.style.display = 'block';
    }
}

// Função de Logout
export function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    alert('Você foi desconectado.');
    window.location.href = window.location.origin + '/';
}

// Função para fazer requisições autenticadas
export async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        handleLogout();
        throw new Error('Não autenticado');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 || response.status === 403) {
        handleLogout();
        throw new Error('Acesso não autorizado ou token inválido');
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.errors && errorData.errors.length > 0) {
            throw new Error(errorData.errors[0].msg);
        }
        throw new Error(errorData.error || 'Erro na requisição');
    }

    return response.json();
}

// Função para inicializar o display do usuário e o botão de logout
export function initializeAuthAndUserDisplay() {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    const name = localStorage.getItem('userName');
    const id = localStorage.getItem('userId');

    if (!token || !role) {
        handleLogout();
        return { isAuthenticated: false };
    }

    const userDisplayName = document.getElementById('user-display-name');
    const logoutButton = document.getElementById('logout-button');

    if (userDisplayName && name) {
        userDisplayName.textContent = `Olá, ${name}`;
    } else if (userDisplayName && role) {
        userDisplayName.textContent = `Olá, ${role}`;
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    return { isAuthenticated: true, userRole: role, userId: id, userName: name };
}