// Frontend/admin_cadastro.js (NOVO ARQUIVO)

import { API_BASE_URL, authenticatedFetch, initializeAuthAndUserDisplay } from './auth.js';

// Elementos da UI
const cadastroForm = document.getElementById('cadastroForm');
const messageDiv = document.getElementById('message');
const authErrorDiv = document.getElementById('auth-error');
const loadingMessageDiv = document.getElementById('loading-message');
const backToDashboardButton = document.getElementById('backToDashboard');

// Função para exibir mensagem
function showMessage(text, isError = false) {
    messageDiv.innerText = text;
    messageDiv.className = `mt-4 text-center ${isError ? 'text-red-500' : 'text-green-500'}`;
}

// Verifica se o usuário tem permissão para estar nesta página
function verifyAdminAccess() {
    loadingMessageDiv.classList.remove('hidden');
    cadastroForm.classList.add('hidden');

    const authResult = initializeAuthAndUserDisplay();

    if (!authResult.isAuthenticated) {
        // A função initializeAuth já redireciona se não estiver logado
        return;
    }

    // Verifica se o usuário logado é o MASTER ADMIN
    if (authResult.userRole !== 'admin' || localStorage.getItem('userEmail') !== 'givanildo.jose@kikos.com.br') {
        loadingMessageDiv.classList.add('hidden');
        authErrorDiv.innerText = "Acesso negado. Apenas o administrador principal pode criar usuários.";
        authErrorDiv.classList.remove('hidden');
        backToDashboardButton.classList.remove('hidden');
    } else {
        // Se for o admin correto, mostra o formulário
        loadingMessageDiv.classList.add('hidden');
        cadastroForm.classList.remove('hidden');
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', verifyAdminAccess);

backToDashboardButton.addEventListener('click', () => {
    window.location.href = window.location.origin + '/Frontend/dashboard.html';
});

cadastroForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage(''); // Limpa mensagens anteriores

    const formData = {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        senha: document.getElementById('senha').value,
        role: document.getElementById('role').value
    };

    try {
        const data = await authenticatedFetch(`${API_BASE_URL}/cadastrar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        showMessage(data.msg || 'Usuário cadastrado com sucesso!', false);
        cadastroForm.reset(); // Limpa o formulário após o sucesso

    } catch (error) {
        showMessage(error.message || 'Erro ao cadastrar. Verifique suas permissões ou tente novamente.', true);
        console.error('Erro no cadastro:', error);
    }
});