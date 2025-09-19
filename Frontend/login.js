// Frontend/login.js (ARQUIVO COMPLETO)

// Importa a URL base da API do auth.js
import { API_BASE_URL } from './auth.js';

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Impede o recarregamento padrão da página
    errorMessage.textContent = ''; // Limpa mensagens de erro anteriores
    errorMessage.style.display = 'none'; // Esconde a mensagem de erro

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json(); // Tenta parsear a resposta como JSON

        if (response.ok) { // Se a resposta HTTP for 2xx (sucesso)
            // Salva as informações do usuário no localStorage
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('userName', data.userName);
            localStorage.setItem('userId', data.userId);
            localStorage.setItem('userEmail', data.userEmail); // <<< Aqui o email do usuário logado é salvo

            // Redireciona para o dashboard
            window.location.href = window.location.origin + '/Frontend/dashboard.html';
        } else {
            // Se houver um erro na resposta da API
            errorMessage.textContent = data.error || data.msg || 'Ocorreu um erro desconhecido.';
            errorMessage.style.display = 'block'; // Mostra a mensagem de erro
        }
    } catch (error) {
        // Captura erros de rede ou outros erros durante a requisição
        console.error('Erro ao tentar fazer login:', error);
        errorMessage.textContent = 'Não foi possível conectar ao servidor. Verifique sua conexão ou tente mais tarde.';
        errorMessage.style.display = 'block';
    }
});