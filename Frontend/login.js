// Frontend/login.js

import { API_BASE_URL } from './config.js';

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (response.ok) {
            // Salva os dados no sessionStorage
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('userRole', data.role);
            sessionStorage.setItem('userName', data.userName);
            sessionStorage.setItem('userId', data.userId);
            sessionStorage.setItem('userEmail', data.userEmail);
            // Salva a flag de permissão
            sessionStorage.setItem('isMasterAdmin', data.isMasterAdmin);

            window.location.href = 'dashboard.html';
        } else {
            errorMessage.textContent = data.error || data.msg || 'Ocorreu um erro desconhecido.';
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro ao tentar fazer login:', error);
        errorMessage.textContent = 'Não foi possível conectar ao servidor. Tente mais tarde.';
        errorMessage.style.display = 'block';
    }
});