// Frontend/auth.js (MÓDULO ES6)

export const API_BASE_URL = 'http://localhost:4000'; // Exporta a URL da API

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
    alert('Você foi desconectado.');
    window.location.href = window.location.origin + '/Frontend/index.html';
}

// Função para fazer requisições autenticadas
export async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        handleLogout(); // Redireciona via handleLogout se o token sumir
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
        handleLogout(); // Chama a função para logout e redirecionamento
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
        handleLogout(); // Redireciona para o login se não autenticado
        return { isAuthenticated: false };
    }

    const userDisplayName = document.getElementById('user-display-name');
    const logoutButton = document.getElementById('logout-button');

    if (userDisplayName && name) {
        userDisplayName.textContent = `Olá, ${name}`;
    } else if (userDisplayName && role) {
        userDisplayName.textContent = `Olá, ${role}`; // Fallback se o nome não for salvo
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    return { isAuthenticated: true, userRole: role, userId: id, userName: name };
}