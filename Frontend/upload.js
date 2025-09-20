// Frontend/upload.js (CÓDIGO COMPLETO E CORRIGIDO)

import { API_BASE_URL, handleLogout, authenticatedFetch, initializeAuthAndUserDisplay, showPageMessage } from './auth.js';

// Elementos da UI
const uploadForm = document.getElementById('uploadForm');
const messageDiv = document.getElementById('message');
const backToDashboardButton = document.getElementById('back-to-dashboard-button');
const submitButton = document.getElementById('submit-button');

// --- Event Listeners ---

backToDashboardButton.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showPageMessage('message', '', '');
    submitButton.disabled = true;

    const arquivoInput = document.getElementById('arquivo');
    const nfInput = document.getElementById('nf');
    const dataEntregaInput = document.getElementById('data_entrega');

    const arquivo = arquivoInput instanceof HTMLInputElement && arquivoInput.files ? arquivoInput.files[0] : null;
    const nf = nfInput instanceof HTMLInputElement ? nfInput.value.trim() : '';
    const dataEntrega = dataEntregaInput instanceof HTMLInputElement ? dataEntregaInput.value : '';

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

    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('nf', nf);
    if (dataEntrega) {
        formData.append('data_entrega', dataEntrega);
    }

    try {
        const data = await authenticatedFetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
        });

        const successMessage = data.msg || data.message || data.success || 'Canhoto enviado com sucesso!';
        showPageMessage('message', successMessage, 'text-green-600');
        
        uploadForm.reset();
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 4000);

    } catch (error) {
        console.error('Erro no upload:', error);
        showPageMessage('message', error.message || 'Erro ao enviar o canhoto. Tente novamente.', 'text-red-600');
    } finally {
        submitButton.disabled = false;
    }
});

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    initializeAuthAndUserDisplay();
});