// Frontend/upload.js (CÓDIGO COMPLETO E FINAL - OTIMIZADO PARA MENSAGENS)

// Importa funções e variáveis do módulo auth.js
import { API_BASE_URL, handleLogout, authenticatedFetch, initializeAuthAndUserDisplay, showPageMessage } from './auth.js';

// Elementos da UI
const uploadForm = document.getElementById('uploadForm');
const messageDiv = document.getElementById('message'); // Elemento onde as mensagens serão exibidas
const backToDashboardButton = document.getElementById('back-to-dashboard-button');
const submitButton = document.getElementById('submit-button');

// --- Event Listeners ---

// Botão "Voltar para o Dashboard"
backToDashboardButton.addEventListener('click', () => {
    window.location.href = window.location.origin + '/Frontend/dashboard.html';
});

// Envio do formulário de upload
uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showPageMessage('message', '', ''); // Limpa mensagens anteriores
    submitButton.disabled = true; // Desabilita o botão para evitar múltiplos envios

    // Obtém os elementos dos inputs
    const arquivoInput = document.getElementById('arquivo');
    const nfInput = document.getElementById('nf');
    const dataEntregaInput = document.getElementById('data_entrega');

    // Extrai os valores (usando 'instanceof HTMLInputElement' para segurança)
    const arquivo = arquivoInput instanceof HTMLInputElement && arquivoInput.files ? arquivoInput.files[0] : null;
    const nf = nfInput instanceof HTMLInputElement ? nfInput.value.trim() : '';
    const dataEntrega = dataEntregaInput instanceof HTMLInputElement ? dataEntregaInput.value : '';

    // Validação básica do formulário no frontend
    if (!arquivo) {
        showPageMessage('message', 'Por favor, selecione um arquivo.', 'text-red-600');
        submitButton.disabled = false;
        return;
    }
    if (!nf) {
        showPageMessage('message', 'O número da NF é obrigatório.', 'text-red-600');
        submitButton.disabled = false;
        return;
    }

    // Cria um objeto FormData para enviar os dados e o arquivo
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('nf', nf);
    if (dataEntrega) { // Apenas adiciona a data de entrega se ela foi informada
        formData.append('data_entrega', dataEntrega);
    }

    try {
        // Envia a requisição de upload autenticada
        const data = await authenticatedFetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
            // A fetch API não tem um callback de progresso nativo para uploads.
            // Para progresso real, seria necessário usar XMLHttpRequest.
        });

        // Exibe a mensagem de sucesso
        const successMessage = data.msg || data.message || data.success || 'Canhoto enviado com sucesso!';
        showPageMessage('message', successMessage, 'text-green-600');
        
        uploadForm.reset(); // Limpa o formulário após o envio bem-sucedido
        
        // Redireciona para o dashboard após um breve atraso para a mensagem ser lida
        setTimeout(() => {
            window.location.href = window.location.origin + '/Frontend/dashboard.html';
        }, 4000); // Aumentado para 4 segundos para melhor visibilidade da mensagem

    } catch (error) {
        console.error('Erro no upload:', error);
        // Exibe a mensagem de erro que veio do backend ou uma genérica
        showPageMessage('message', error.message || 'Erro ao enviar o canhoto. Tente novamente.', 'text-red-600');
    } finally {
        submitButton.disabled = false; // Habilita o botão de envio novamente
    }
});

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o display do usuário e o botão de logout ao carregar a página
    initializeAuthAndUserDisplay();
});