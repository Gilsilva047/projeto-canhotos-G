// Frontend/upload.js
import { API_BASE_URL, authenticatedFetch, initializeAuthAndUserDisplay, showPageMessage } from './auth.js';

// --- ELEMENTOS DA UI ---
const uploadForm = document.getElementById('uploadForm');
const messageDiv = document.getElementById('message');
const backToDashboardButton = document.getElementById('back-to-dashboard-button');
const submitButton = document.getElementById('submit-button');

// --- CHAVE DA API ---
const IMGBB_API_KEY = 'dae2afc5f13fa9475055a1b3627ea483'; 

// --- FUNÇÃO PARA ENVIAR IMAGEM AO IMGBB ---
async function uploadImageToImgBB(imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(`Erro no upload para o ImgBB: ${data.error.message}`);
    }
    return data.data.url; // Retorna a URL da imagem
}

// --- EVENT LISTENERS ---
backToDashboardButton.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showPageMessage('message', '', '');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enviando...';

    const arquivoInput = document.getElementById('arquivo');
    const nfInput = document.getElementById('nf');
    const dataEntregaInput = document.getElementById('data_entrega');

    const arquivo = arquivoInput.files ? arquivoInput.files[0] : null;
    const nf = nfInput.value.trim();
    const dataEntrega = dataEntregaInput.value;

    if (!arquivo || !nf) {
        showPageMessage('message', 'Número da NF e arquivo são obrigatórios.', 'text-red-600');
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-upload mr-2"></i> Enviar';
        return;
    }

    try {
        showPageMessage('message', 'Enviando imagem para o servidor externo...', 'text-blue-600');
        const imageUrl = await uploadImageToImgBB(arquivo);

        const canhotoData = {
            nf: nf,
            data_entrega: data_entrega || null,
            imageUrl: imageUrl
        };
        
        showPageMessage('message', 'Salvando informações no banco de dados...', 'text-blue-600');
        await authenticatedFetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: canhotoData
        });

        showPageMessage('message', 'Canhoto enviado com sucesso!', 'text-green-600');
        uploadForm.reset();

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);

    } catch (error) {
        console.error('Erro no upload:', error);
        showPageMessage('message', error.message || 'Erro ao enviar o canhoto.', 'text-red-600');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-upload mr-2"></i> Enviar';
    }
});

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    initializeAuthAndUserDisplay();
});