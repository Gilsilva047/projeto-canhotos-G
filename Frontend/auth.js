// Frontend/auth.js (CÓDIGO COMPLETO E SEGURO)

import { API_BASE_URL } from './config.js';

export { API_BASE_URL };

export function showPageMessage(elementId, msg, className = 'text-red-600') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = msg;
        element.className = `mt-4 text-center font-medium ${className}`;
        element.style.display = 'block';
    }
}

export function handleLogout() {
    // Limpa o sessionStorage em vez do localStorage
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('userEmail');
    alert('Você foi desconectado.');
    window.location.href = '/';
}

export async function authenticatedFetch(url, options = {}) {
    // Pega o token do sessionStorage
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        handleLogout();
        throw new Error('Não autenticado');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    // FormData lida com o Content-Type automaticamente
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

    // Retorna a resposta JSON apenas se houver conteúdo
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    } else {
        return {}; // Retorna um objeto vazio se não for JSON
    }
}

export function initializeAuthAndUserDisplay() {
    // Lê os dados do sessionStorage
    const token = sessionStorage.getItem('authToken');
    const role = sessionStorage.getItem('userRole');
    const name = sessionStorage.getItem('userName');
    const id = sessionStorage.getItem('userId');

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