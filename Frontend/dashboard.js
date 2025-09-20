// Frontend/dashboard.js (CÓDIGO COMPLETO E FINAL - COM BOTÃO DE CADASTRO DE ADMIN)

// Importa funções e variáveis do módulo auth.js
import { API_BASE_URL, authenticatedFetch, initializeAuthAndUserDisplay } from './auth.js';

const ITEMS_PER_PAGE = 30;

let currentPage = 1;
let totalPages = 1;
let userRole = '';
let userId = '';

// Elementos da UI
const novoCanhotoButton = document.getElementById('novo-canhoto-button');
const cadastrarUsuarioButton = document.getElementById('cadastrar-usuario-button');
const filterNf = document.getElementById('filter-nf');
const filterDataEntrega = document.getElementById('filter-data-entrega');
const filterUsuarioEnvioContainer = document.getElementById('filter-usuario-envio-container');
const filterUsuarioEnvio = document.getElementById('filter-usuario-envio');
const aplicarFiltrosButton = document.getElementById('aplicar-filtros-button');
const limparFiltrosButton = document.getElementById('limpar-filtros-button');
const canhotosGrid = document.getElementById('canhotos-grid');
const loadingMessage = document.getElementById('loading-message');
const errorMessage = document.getElementById('error-message');
const noCanhotosMessage = document.getElementById('no-canhotos-message');
const prevPageButton = document.getElementById('prev-page-button');
const nextPageButton = document.getElementById('next-page-button');
const pageInfo = document.getElementById('page-info');

// --- Funções Auxiliares ---
function formatDate(dateString) {
    if (!dateString) return 'Não informada';
    try {
        const parts = String(dateString).split('-');
        if (parts.length === 3) {
            const date = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
            return date.toLocaleDateString('pt-BR');
        } else {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR');
        }
    } catch (e) {
        return 'Data inválida';
    }
}

function downloadFile(filePath, fileName) {
    const link = document.createElement('a');
    link.href = filePath;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Funções de Carregamento e Renderização ---
async function loadCanhotos() {
    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    noCanhotosMessage.style.display = 'none';
    canhotosGrid.innerHTML = '';

    try {
        let usuarioIdFilter = '';
        if (userRole === 'colaborador' || userRole === 'admin') {
            usuarioIdFilter = filterUsuarioEnvio.value;
        } else if (userRole === 'transportador') {
            usuarioIdFilter = userId;
        }
        
        const nf = filterNf.value;
        const dataEntrega = filterDataEntrega.value;
        let apiUrl = `${API_BASE_URL}/uploads?page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
        if (nf) apiUrl += `&nf=${nf}`;
        if (dataEntrega) apiUrl += `&data_entrega=${dataEntrega}`;
        if (usuarioIdFilter) apiUrl += `&usuario_id=${usuarioIdFilter}`;
        
        const data = await authenticatedFetch(apiUrl);
        const uploads = data.uploads || [];
        const totalItems = data.totalItems || 0;
        
        totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
        updatePaginationButtons();
        
        if (uploads.length === 0) {
            noCanhotosMessage.style.display = 'block';
            return;
        }
        
        uploads.forEach(canhoto => {
            const card = document.createElement('div');
            card.className = 'canhoto-card';
            const formattedDate = formatDate(canhoto.data_entrega);
            const fileUrl = `${API_BASE_URL}/uploads/${canhoto.nome_arquivo}`;
            const isImage = canhoto.nome_arquivo.match(/\.(jpeg|jpg|png|gif)$/i);
            
            card.innerHTML = `
                <div class="canhoto-image-container">
                    ${isImage ? `<img src="${fileUrl}" alt="Canhoto NF ${canhoto.nf}" class="canhoto-image">` : 
                                `<i class="fas fa-file-pdf text-6xl text-red-500"></i>`}
                </div>
                <div class="p-4 flex-1 flex flex-col justify-between">
                    <div>
                        <p class="text-gray-900 font-semibold">NF: ${canhoto.nf}</p>
                        <p class="text-gray-600 text-sm">Data de Entrega: ${formattedDate}</p>
                        ${(userRole === 'colaborador' || userRole === 'admin') && canhoto.usuario_nome ? `<p class="text-gray-600 text-sm">Enviado por: ${canhoto.usuario_nome}</p>` : ''}
                    </div>
                </div>
                <div class="download-button-card" data-filepath="${fileUrl}" data-filename="${canhoto.nome_arquivo}">
                    <i class="fas fa-download"></i>
                </div>
            `;
            canhotosGrid.appendChild(card);
        });
        
        document.querySelectorAll('.download-button-card').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const filePath = button.dataset.filepath;
                const fileName = button.dataset.filename;
                downloadFile(filePath, fileName);
            });
        });
    } catch (error) {
        console.error('Erro ao carregar canhotos:', error);
        errorMessage.textContent = error.message || 'Erro ao carregar canhotos.';
        errorMessage.style.display = 'block';
    } finally {
        loadingMessage.style.display = 'none';
    }
}

async function loadUsersForFilter() {
    try {
        const users = await authenticatedFetch(`${API_BASE_URL}/usuarios`);
        filterUsuarioEnvio.innerHTML = '<option value="">Todos</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.nome;
            filterUsuarioEnvio.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar usuários para o filtro:', error);
    }
}

function updatePaginationButtons() {
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    prevPageButton.disabled = currentPage === 1;
    nextPageButton.disabled = currentPage === totalPages;
}

// --- Event Listeners ---
novoCanhotoButton.addEventListener('click', () => {
    window.location.href = 'upload.html';
});

cadastrarUsuarioButton.addEventListener('click', () => {
    window.location.href = 'admin_cadastro.html';
});

aplicarFiltrosButton.addEventListener('click', () => {
    currentPage = 1;
    loadCanhotos();
});

limparFiltrosButton.addEventListener('click', () => {
    filterNf.value = '';
    filterDataEntrega.value = '';
    filterUsuarioEnvio.value = '';
    currentPage = 1;
    loadCanhotos();
});

prevPageButton.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        loadCanhotos();
    }
});

nextPageButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        loadCanhotos();
    }
});

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    const authResult = initializeAuthAndUserDisplay();
    
    if (!authResult.isAuthenticated) {
        return;
    }
    
    userRole = authResult.userRole;
    userId = authResult.userId;
    
    // Mostra o botão de cadastro apenas para o MASTER ADMIN
    if (userRole === 'admin' && localStorage.getItem('userEmail') === 'givanildo.jose@kikos.com.br') {
        cadastrarUsuarioButton.classList.remove('hidden');
    }

    if (userRole === 'colaborador' || userRole === 'admin') {
        filterUsuarioEnvioContainer.style.display = 'block';
        await loadUsersForFilter();
    } else {
        filterUsuarioEnvioContainer.style.display = 'none';
    }
    
    await loadCanhotos();
});