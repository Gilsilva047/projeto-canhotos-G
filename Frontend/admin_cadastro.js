// Frontend/admin_cadastro.js

import { API_BASE_URL, authenticatedFetch, initializeAuthAndUserDisplay } from './auth.js';

const cadastroForm = document.getElementById('cadastroForm');
const messageDiv = document.getElementById('message');
const authErrorDiv = document.getElementById('auth-error');
const loadingMessageDiv = document.getElementById('loading-message');
const backToDashboardButton = document.getElementById('backToDashboard');

function showMessage(text, isError = false) {
    messageDiv.innerText = text;
    messageDiv.className = `mt-4 text-center ${isError ? 'text-red-500' : 'text-green-500'}`;
}

function verifyAdminAccess() {
    loadingMessageDiv.classList.remove('hidden');
    cadastroForm.classList.add('hidden');

    const authResult = initializeAuthAndUserDisplay();
    if (!authResult.isAuthenticated) return;

    // **AJUSTE DE SEGURANÇA**
    const isMasterAdmin = sessionStorage.getItem('isMasterAdmin') === 'true';

    if (!isMasterAdmin) {
        loadingMessageDiv.classList.add('hidden');
        authErrorDiv.innerText = "Acesso negado. Apenas o administrador principal pode criar usuários.";
        authErrorDiv.classList.remove('hidden');
        backToDashboardButton.classList.remove('hidden');
    } else {
        loadingMessageDiv.classList.add('hidden');
        cadastroForm.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', verifyAdminAccess);

backToDashboardButton.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

cadastroForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('');

    const formData = {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        senha: document.getElementById('senha').value,
        role: document.getElementById('role').value
    };

    try {
        const data = await authenticatedFetch(`${API_BASE_URL}/cadastrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        showMessage(data.msg || 'Usuário cadastrado com sucesso!', false);
        cadastroForm.reset();
    } catch (error) {
        showMessage(error.message || 'Erro ao cadastrar. Verifique suas permissões ou tente novamente.', true);
        console.error('Erro no cadastro:', error);
    }
});