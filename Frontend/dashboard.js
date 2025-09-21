import { API_BASE_URL, authenticatedFetch, initializeAuthAndUserDisplay } from './auth.js';

const ITEMS_PER_PAGE = 30;
let currentPage = 1;
let totalPages = 1;
let currentUser = {
    role: '',
    id: '',
    isMasterAdmin: false
};

// --- Elementos da UI ---
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');
const menuToggle = document.getElementById('menuToggle');
const cadastrarNavLink = document.getElementById('cadastrar-nav-link');
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
const paginationControls = document.getElementById('pagination-controls');
const prevPageButton = document.getElementById('prev-page-button');
const nextPageButton = document.getElementById('next-page-button');
const pageInfo = document.getElementById('page-info');

// --- Funções Auxiliares ---
function formatDate(isoString) {
    if (!isoString) return 'Não informada';
    const date = new Date(isoString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
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
    paginationControls.style.display = 'none';

    try {
        const nf = filterNf.value.trim();
        const dataEntrega = filterDataEntrega.value;
        const usuarioId = (currentUser.role === 'colaborador' || currentUser.role === 'admin') ? filterUsuarioEnvio.value : '';

        let apiUrl = `${API_BASE_URL}/uploads?page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
        if (nf) apiUrl += `&nf=${encodeURIComponent(nf)}`;
        if (dataEntrega) apiUrl += `&data_entrega=${dataEntrega}`;
        if (usuarioId) apiUrl += `&usuario_id=${usuarioId}`;
        
        const data = await authenticatedFetch(apiUrl);
        const { uploads = [], totalItems = 0 } = data;

        totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
        updatePaginationButtons();

        if (uploads.length === 0) {
            noCanhotosMessage.style.display = 'block';
        } else {
            renderCanhotos(uploads);
            paginationControls.style.display = 'flex';
        }
    } catch (error) {
        console.error('Erro ao carregar canhotos:', error);
        errorMessage.textContent = error.message || 'Erro ao carregar canhotos.';
        errorMessage.style.display = 'block';
    } finally {
        loadingMessage.style.display = 'none';
    }
}

function renderCanhotos(uploads) {
    uploads.forEach(canhoto => {
        const card = document.createElement('div');
        card.className = 'card';
        
        // --- MUDANÇA PRINCIPAL AQUI ---
        // Agora usamos a 'image_url' diretamente, que vem do banco de dados.
        const fileUrl = canhoto.image_url; 
        const isImage = fileUrl.match(/\.(jpeg|jpg|png|gif)$/i);

        card.innerHTML = `
            <div class="card-image-container">
                ${isImage ? `<img src="${fileUrl}" alt="Canhoto NF ${canhoto.nf}" class="canhoto-image">` : 
                           `<i class="fas fa-file-pdf text-6xl text-red-500"></i>`}
            </div>
            <h3>NF: ${canhoto.nf}</h3>
            <p><strong>Data de Entrega:</strong> ${formatDate(canhoto.data_entrega)}</p>
            ${(currentUser.role === 'colaborador' || currentUser.role === 'admin') ? `<p><strong>Enviado por:</strong> ${canhoto.usuario_nome}</p>` : ''}
            <div class="card-footer">
                <button class="action-btn primary download-btn">
                    <i class="fas fa-download"></i> Baixar
                </button>
            </div>
        `;
        // O botão de download agora usa a URL direta da imagem
        card.querySelector('.download-btn').addEventListener('click', () => downloadFile(fileUrl, `canhoto-NF-${canhoto.nf}`));
        canhotosGrid.appendChild(card);
    });
}

async function loadUsersForFilter() {
    if (currentUser.role !== 'colaborador' && currentUser.role !== 'admin') {
        filterUsuarioEnvioContainer.style.display = 'none';
        return;
    }
    try {
        const users = await authenticatedFetch(`${API_BASE_URL}/usuarios`);
        filterUsuarioEnvio.innerHTML = '<option value="">Todos os Usuários</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.nome;
            filterUsuarioEnvio.appendChild(option);
        });
        filterUsuarioEnvioContainer.style.display = 'block';
    } catch (error) {
        console.error('Erro ao carregar usuários para o filtro:', error);
    }
}

function updatePaginationButtons() {
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    prevPageButton.disabled = currentPage === 1;
    nextPageButton.disabled = currentPage >= totalPages;
}

function setupEventListeners() {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        mainContent.classList.toggle('shifted');
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
}

document.addEventListener('DOMContentLoaded', async () => {
    const authResult = initializeAuthAndUserDisplay();
    if (!authResult.isAuthenticated) return;

    currentUser.role = authResult.userRole;
    currentUser.id = authResult.userId;
    currentUser.isMasterAdmin = sessionStorage.getItem('isMasterAdmin') === 'true';

    if (currentUser.isMasterAdmin) {
        cadastrarNavLink.style.display = 'flex';
    }

    setupEventListeners();
    await loadUsersForFilter();
    await loadCanhotos();
});