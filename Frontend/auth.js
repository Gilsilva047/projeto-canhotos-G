// Frontend/auth.js

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
    sessionStorage.clear();
    alert('Você foi desconectado.');
    window.location.href = '/';
}

export async function authenticatedFetch(url, options = {}) {
    const token = sessionStorage.getItem('authToken');
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
    } else if (options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 || response.status === 403) {
        handleLogout();
        throw new Error('Acesso não autorizado ou token inválido');
    }

    const responseData = await response.json().catch(() => ({}));
    
    if (!response.ok) {
        if (responseData.errors && responseData.errors.length > 0) {
            throw new Error(responseData.errors[0].msg);
        }
        throw new Error(responseData.error || 'Erro na requisição');
    }

    return responseData;
}

export function initializeAuthAndUserDisplay() {
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
    const userIcon = document.getElementById('user-icon'); // Pega o elemento do ícone

    if (userDisplayName && name) {
        userDisplayName.textContent = `Olá, ${name}`;
    }

    // LÓGICA PARA AS INICIAIS
    if (userIcon && name) {
        const nameParts = name.trim().split(' ');
        let initials = '';
        if (nameParts.length > 1) {
            initials = nameParts[0][0] + nameParts[nameParts.length - 1][0];
        } else if (nameParts[0] && nameParts[0].length > 1) {
            initials = nameParts[0].substring(0, 2);
        } else if (nameParts[0]) {
            initials = nameParts[0][0];
        }
        userIcon.textContent = initials.toUpperCase();
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    return { isAuthenticated: true, userRole: role, userId: id, userName: name };
}