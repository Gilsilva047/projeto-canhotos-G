import { API_BASE_URL, authenticatedFetch, initializeAuthAndUserDisplay } from './auth.js';

const ITEMS_PER_PAGE = 30;
let currentPage = 1;
let totalPages = 1;
let currentUser = { role: '', id: '', isMasterAdmin: false };

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
const lightbox = document.getElementById('imageLightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.getElementById('lightboxClose');

function openLightbox(imageUrl) {
    if (lightbox && lightboxImage) {
        lightboxImage.src = imageUrl;
        lightbox.style.display = 'flex';
    }
}

function closeLightbox() {
    if (lightbox) {
        lightbox.style.display = 'none';
    }
}

if(lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
}
if(lightbox) {
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
}

function formatDate(isoString) {
    if (!isoString) return 'Não informada';
    const date = new Date(isoString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
}

function downloadFile(event, fileUrl) {
    event.stopPropagation();
    const fileName = `canhoto-${Date.now()}`;
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

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
    canhotosGrid.innerHTML = '';

    uploads.forEach(canhoto => {
        const card = document.createElement('div');
        card.className = 'canhoto-card';
        
        const fileUrl = canhoto.image_url; 
        const isImage = fileUrl && fileUrl.match(/\.(jpeg|jpg|png|gif)$/i);

        let imageContent = '';
        if (isImage) {
            imageContent = `<img src="${fileUrl}" alt="Canhoto NF ${canhoto.nf}">`;
        } else {
            imageContent = `<div class="pdf-icon"><i class="fas fa-file-pdf"></i></div>`;
        }

        card.innerHTML = `
            <div class="card-image-wrapper">
                ${imageContent}
            </div>
            <div class="card-info">
                <div>
                    <h3>NF: ${canhoto.nf}</h3>
                    <p><strong>Enviado por:</strong> ${canhoto.usuario_nome}</p>
                    <p><strong>Data:</strong> ${formatDate(canhoto.data_entrega)}</p>
                </div>
                <div class="card-footer">
                    <button class="action-btn primary download-btn">
                        <i class="fas fa-download"></i> Baixar
                    </button>
                </div>
            </div>
        `;

        const imageWrapper = card.querySelector('.card-image-wrapper');
        const downloadBtn = card.querySelector('.download-btn');
        
        if (isImage) {
            imageWrapper.addEventListener('click', () => openLightbox(fileUrl));
        } else {
            imageWrapper.addEventListener('click', () => window.open(fileUrl, '_blank'));
        }
        
        if(downloadBtn) {
            downloadBtn.addEventListener('click', (e) => downloadFile(e, fileUrl));
        }

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