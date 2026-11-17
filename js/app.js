const API_URL = '/api';
const CARDS_PER_PAGE = 12;

let allCardsData = [];
let filteredCardsData = [];
let currentPage = 1;
let quizQuestions = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  const savedUser = localStorage.getItem('petthinks_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    checkUserSession();
  }

  await loadCardsJSONL();
  await loadQuizJSONL();

  const savedTheme = localStorage.getItem('petthinks_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    updateThemeButton(true);
  }
});


function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('petthinks_theme', isDark ? 'dark' : 'light');
  updateThemeButton(isDark);
}

function updateThemeButton(isDark) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.innerHTML = isDark
    ? '☀️ <span class="theme-text">Claro</span>'
    : '🌙 <span class="theme-text">Oscuro</span>';
}


async function loadCardsJSONL() {
  allCardsData = [];
  await fetchJSONL('assets/data/perros.jsonl');
  await fetchJSONL('assets/data/gatos.jsonl');
  filteredCardsData = [...allCardsData];
  currentPage = 1;
  renderPaginatedCards();
}

async function fetchJSONL(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return;
    const text = await res.text();
    text.split('\n').filter(l => l.trim() !== '').forEach(line => {
      try { allCardsData.push(JSON.parse(line)); } catch (e) {}
    });
  } catch (e) {
    console.error('Error al cargar JSONL:', e);
  }
}

function renderPaginatedCards() {
  const container = document.getElementById('cardsGrid');
  const paginationEl = document.getElementById('paginationControls');
  container.innerHTML = '';

  if (filteredCardsData.length === 0) {
    container.innerHTML = '<p style="color: #718096;">No se encontraron fichas informativas.</p>';
    paginationEl.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(filteredCardsData.length / CARDS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const pageItems = filteredCardsData.slice(startIndex, endIndex);

  pageItems.forEach(card => {
    const isFav = isCardFavorite(card.id);
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.onclick = () => openDetailModal(card.id);

    const imgSrc = card.imagen_low || card.imagen || 'https://via.placeholder.com/300x160?text=PetThinks';
    cardEl.innerHTML = `
      <button class="btn-fav-card" title="Guardar en favoritos" onclick="toggleFavorite(event, '${card.id}', '${card.raza.replace(/'/g, "\\'")}')">
        ${isFav ? '❤️' : '🤍'}
      </button>
      <img src="${imgSrc}" class="card-img" alt="${card.raza}" loading="lazy">
      <span class="card-badge">${card.especie.toUpperCase()}</span>
      <h3>${card.raza}</h3>
      <p>${card.resumen}</p>
    `;
    container.appendChild(cardEl);
  });

  renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
  const paginationEl = document.getElementById('paginationControls');
  paginationEl.innerHTML = '';

  if (totalPages <= 1) return;

  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerText = '« Anterior';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    currentPage--;
    renderPaginatedCards();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  paginationEl.appendChild(prevBtn);

  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
    pageBtn.innerText = i;
    pageBtn.onclick = () => {
      currentPage = i;
      renderPaginatedCards();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    paginationEl.appendChild(pageBtn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerText = 'Siguiente »';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    currentPage++;
    renderPaginatedCards();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  paginationEl.appendChild(nextBtn);
}

function isCardFavorite(cardId) {
  if (!currentUser || !Array.isArray(currentUser.favoritos)) return false;
  return currentUser.favoritos.some(f => f.Articulo_ID === cardId);
}

async function toggleFavorite(event, cardId, tituloFicha) {
  if (event) event.stopPropagation();

  if (!currentUser) {
    alert('Inicia sesión o regístrate para guardar tus fichas favoritas.');
    switchView('accountView', document.getElementById('accountNavBtn'));
    return;
  }

  if (!Array.isArray(currentUser.favoritos)) currentUser.favoritos = [];

  const idx = currentUser.favoritos.findIndex(f => f.Articulo_ID === cardId);
  if (idx > -1) {
    currentUser.favoritos.splice(idx, 1);
  } else {
    currentUser.favoritos.push({ Articulo_ID: cardId, Titulo_Ficha: tituloFicha });
  }

  try {
    await fetch(`${API_URL}/favorites/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId: currentUser.Usuario_ID,
        articuloId: cardId,
        tituloFicha: tituloFicha
      })
    });
  } catch (e) {
    console.warn('Guardado localmente (servidor SQL no disponible).');
  }

  saveUserLocally();
  renderPaginatedCards();
  updateProfileFavoritesList();
}

async function openDetailModal(id) {
  const item = allCardsData.find(c => c.id === id);
  if (!item) return;

  try {
    fetch(`${API_URL}/reports/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId: currentUser ? currentUser.Usuario_ID : null,
        articuloId: id
      })
    });
  } catch (e) {}

  const highImgSrc = item.imagen_high || item.imagen_low || item.imagen || 'https://via.placeholder.com/600x250?text=PetThinks+HD';
  const isFav = isCardFavorite(item.id);
  let fuentesHTML = '';
  if (Array.isArray(item.fuentes) && item.fuentes.length > 0) {
    fuentesHTML = `<ul class="sources-list">${item.fuentes.map(f => `<li>${f}</li>`).join('')}</ul>`;
  }

  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <img src="${highImgSrc}" class="modal-header-img" alt="${item.raza}">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.8rem;">
        <span class="card-badge">${item.especie.toUpperCase()}</span>
        <button class="btn-filter ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${item.id}', '${item.raza.replace(/'/g, "\\'")}'); openDetailModal('${item.id}');">
          ${isFav ? '❤️ Guardada en Favoritos' : '🤍 Guardar en Favoritos'}
        </button>
      </div>
      <h2 style="color:var(--primary); margin-top:0.3rem;">${item.raza}</h2>
    </div>
    <div class="modal-section">
      <h4>📌 Información General</h4>
      <p>${item.info_general}</p>
    </div>
    <div class="modal-section">
      <h4>🍖 Alimentación</h4>
      <p>${item.alimentacion}</p>
    </div>
    <div class="modal-section">
      <h4>🛁 Cuidados y Bañado</h4>
      <p>${item.banado}</p>
    </div>
    <div class="modal-section">
      <h4>💉 Esquema de Vacunación</h4>
      <p>${item.vacunas}</p>
    </div>
    <div class="modal-section sources-section">
      <h4>📚 Fuentes / Referencias Médicas</h4>
      ${fuentesHTML}
    </div>
  `;
  document.getElementById('detailModal').classList.add('active');
}

function closeModal(event) {
  if (!event || event.target.id === 'detailModal' || event.target.classList.contains('modal-close')) {
    document.getElementById('detailModal').classList.remove('active');
  }
}

async function loadQuizJSONL() {
  try {
    const res = await fetch('assets/data/preguntas.jsonl');
    if (!res.ok) return;
    const text = await res.text();
    quizQuestions = text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
    loadRandomQuestion();
  } catch (e) {
    console.error('Error al cargar preguntas:', e);
  }
}

function loadRandomQuestion() {
  if (quizQuestions.length === 0) return;

  const feedbackEl = document.getElementById('quizFeedback');
  const badgeEl = document.getElementById('quizSpeciesBadge');
  feedbackEl.innerText = '';

  let availableQuestions = [...quizQuestions];
  const petPref = currentUser && currentUser.Mascota_Preferida
    ? currentUser.Mascota_Preferida.toLowerCase()
    : 'ambos';

  if (petPref === 'perro' || petPref === 'gato') {
    const filteredByPet = quizQuestions.filter(
      q => !q.especie || q.especie.toLowerCase() === petPref || q.especie.toLowerCase() === 'ambos'
    );
    if (filteredByPet.length > 0) availableQuestions = filteredByPet;
    badgeEl.innerText = petPref === 'perro'
      ? '🐶 Preguntas personalizadas para: Perros'
      : '🐱 Preguntas personalizadas para: Gatos';
  } else {
    badgeEl.innerText = '🐶🐱 Preguntas para: Ambos (Perros y Gatos)';
  }

  const q = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
  document.getElementById('quizQuestion').innerText = q.pregunta;

  const options = [
    { text: q.correcta, isCorrect: true },
    { text: q.incorrecta1, isCorrect: false },
    { text: q.incorrecta2, isCorrect: false },
    { text: q.incorrecta3, isCorrect: false }
  ].filter(o => o.text).sort(() => Math.random() - 0.5);

  const optionsContainer = document.getElementById('quizOptions');
  optionsContainer.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'btn-option';
    btn.innerText = opt.text;
    btn.onclick = async () => {
      document.querySelectorAll('.btn-option').forEach(b => b.disabled = true);

      if (opt.isCorrect) {
        btn.classList.add('correct');
        feedbackEl.style.color = '#2f855a';
        feedbackEl.innerText = '✅ ¡Correcto! +10 puntos añadidos a tu perfil.';
        await registerQuizAnswer(q.id, true, 10);
      } else {
        btn.classList.add('wrong');
        feedbackEl.style.color = '#c53030';
        feedbackEl.innerText = `❌ Incorrecto. La respuesta correcta es: "${q.correcta}".`;
        await registerQuizAnswer(q.id, false, 0);
      }
    };
    optionsContainer.appendChild(btn);
  });
}

async function registerQuizAnswer(preguntaId, esCorrecta, puntos) {
  if (!currentUser) return;

  currentUser.Puntuacion_Total = (currentUser.Puntuacion_Total || 0) + puntos;
  currentUser.Nivel_Alcanzado = Math.floor(currentUser.Puntuacion_Total / 50) + 1;

  try {
    const res = await fetch(`${API_URL}/quiz/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId: currentUser.Usuario_ID,
        preguntaId,
        esCorrecta,
        puntos
      })
    });
    const data = await res.json();
    if (data.ok && data.stats) {
      currentUser.Puntuacion_Total = data.stats.Puntuacion_Total;
      currentUser.Nivel_Alcanzado = data.stats.Nivel_Alcanzado;
    }
  } catch (e) {}

  saveUserLocally();
  checkUserSession();
}

// ============================================================================
// AUTENTICACIÓN, REGISTRO Y GESTIÓN DE PERFIL
// ============================================================================
function switchView(viewId, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (viewId === 'accountView') checkUserSession();
  if (viewId === 'gameView') loadRandomQuestion();
}

function showAccountSubView(subView) {
  document.getElementById('loginBox').style.display = subView === 'login' ? 'block' : 'none';
  document.getElementById('registerBox').style.display = subView === 'register' ? 'block' : 'none';
  document.getElementById('profileBox').style.display = subView === 'profile' ? 'block' : 'none';
}

function saveUserLocally() {
  if (currentUser) {
    localStorage.setItem('petthinks_user', JSON.stringify(currentUser));
  } else {
    localStorage.removeItem('petthinks_user');
  }
}

function checkUserSession() {
  const navBtn = document.getElementById('accountNavBtn');
  if (currentUser) {
    const petLabel = currentUser.Mascota_Preferida === 'Perro'
      ? '🐶 Perro'
      : currentUser.Mascota_Preferida === 'Gato'
        ? '🐱 Gato'
        : '🐶🐱 Ambos';

    navBtn.innerText = `Mi Perfil (${currentUser.Nombre})`;
    document.getElementById('profileName').innerText = currentUser.Nombre;
    document.getElementById('profileEmail').innerText = currentUser.Correo;
    document.getElementById('profilePet').innerText = petLabel;
    document.getElementById('profilePoints').innerText = `⭐ ${currentUser.Puntuacion_Total || 0} pts`;
    document.getElementById('profileLevel').innerText = `🏆 Nivel ${currentUser.Nivel_Alcanzado || 1}`;
    document.getElementById('profileAvatar').innerText = currentUser.Nombre.substring(0, 2).toUpperCase();
    document.getElementById('changeProfilePet').value = currentUser.Mascota_Preferida || 'Ambos';

    updateProfileFavoritesList();
    showAccountSubView('profile');
  } else {
    navBtn.innerText = 'Mi Cuenta / Iniciar Sesión';
    showAccountSubView('login');
  }
}

function updateProfileFavoritesList() {
  const list = document.getElementById('savedCardsList');
  if (!list) return;
  list.innerHTML = '';

  if (!currentUser || !Array.isArray(currentUser.favoritos) || currentUser.favoritos.length === 0) {
    list.innerHTML = '<li style="color:#718096;">Aún no has guardado fichas favoritas. Haz clic en el corazón 🤍 de cualquier ficha.</li>';
    return;
  }

  currentUser.favoritos.forEach(fav => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span style="cursor:pointer; color:var(--primary); font-weight:600;" onclick="openDetailModal('${fav.Articulo_ID}')">
        📌 ${fav.Titulo_Ficha}
      </span>
      <button style="background:none; border:none; color:#e53e3e; cursor:pointer; font-weight:bold;" onclick="toggleFavorite(event, '${fav.Articulo_ID}', '${fav.Titulo_Ficha}')">
        Quitar ✕
      </button>
    `;
    list.appendChild(li);
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const correo = document.getElementById('loginEmail').value.trim();
  const contrasena = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena })
    });
    const data = await res.json();

    if (!data.ok) {
      alert(data.message || 'Credenciales incorrectas');
      return;
    }

    currentUser = data.user;
  } catch (err) {
    const offlineUsers = JSON.parse(localStorage.getItem('petthinks_offline_users') || '[]');
    const found = offlineUsers.find(u => u.Correo === correo && u.Contrasena === contrasena);
    if (!found) {
      alert('Usuario no encontrado o contraseña incorrecta (Modo Offline).');
      return;
    }
    currentUser = found;
  }

  saveUserLocally();
  checkUserSession();
  renderPaginatedCards();
}

async function handleRegister(e) {
  e.preventDefault();
  const nombre = document.getElementById('regName').value.trim();
  const correo = document.getElementById('regEmail').value.trim();
  const mascota = document.getElementById('regPet').value;
  const contrasena = document.getElementById('regPassword').value;

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, correo, contrasena, mascota })
    });
    const data = await res.json();

    if (!data.ok) {
      alert(data.message || 'Error al registrar usuario');
      return;
    }

    currentUser = { ...data.user, favoritos: [] };
  } catch (err) {
    const offlineUsers = JSON.parse(localStorage.getItem('petthinks_offline_users') || '[]');
    if (offlineUsers.some(u => u.Correo === correo)) {
      alert('Este correo ya está registrado.');
      return;
    }
    currentUser = {
      Usuario_ID: Date.now(),
      Nombre: nombre,
      Correo: correo,
      Contrasena: contrasena,
      Mascota_Preferida: mascota,
      Puntuacion_Total: 0,
      Nivel_Alcanzado: 1,
      favoritos: []
    };
    offlineUsers.push(currentUser);
    localStorage.setItem('petthinks_offline_users', JSON.stringify(offlineUsers));
  }

  saveUserLocally();
  checkUserSession();
  renderPaginatedCards();
}

async function updateUserPetPreference(nuevaMascota) {
  if (!currentUser) return;
  currentUser.Mascota_Preferida = nuevaMascota;

  try {
    await fetch(`${API_URL}/user/pet`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId: currentUser.Usuario_ID,
        mascota: nuevaMascota
      })
    });
  } catch (e) {}

  saveUserLocally();
  checkUserSession();
  loadRandomQuestion();
}

function handleLogout() {
  currentUser = null;
  saveUserLocally();
  checkUserSession();
  renderPaginatedCards();
}

// ============================================================================
// FILTROS Y BÚSQUEDA
// ============================================================================
function filterSpecies(species, btn) {
  document.querySelectorAll('.filter-group .btn-filter').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  currentPage = 1;
  if (species === 'all') {
    filteredCardsData = [...allCardsData];
  } else if (species === 'favoritos') {
    if (!currentUser) {
      alert('Inicia sesión para ver tus fichas favoritas.');
      filteredCardsData = [];
    } else {
      const favIds = (currentUser.favoritos || []).map(f => f.Articulo_ID);
      filteredCardsData = allCardsData.filter(c => favIds.includes(c.id));
    }
  } else {
    filteredCardsData = allCardsData.filter(c => c.especie.toLowerCase() === species.toLowerCase());
  }

  renderPaginatedCards();
}

function cleanText(text) {
  if (!text) return '';
  return text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function searchCards() {
  const rawQuery = document.getElementById('globalSearch').value;
  const cleanedQuery = cleanText(rawQuery).trim();

  if (cleanedQuery === '') {
    const activeFilterBtn = document.querySelector('.filter-group .btn-filter.active');
    const txt = activeFilterBtn ? activeFilterBtn.innerText.toLowerCase() : 'todos';
    if (txt.includes('perro')) filterSpecies('perro', activeFilterBtn);
    else if (txt.includes('gato')) filterSpecies('gato', activeFilterBtn);
    else if (txt.includes('favoritos')) filterSpecies('favoritos', activeFilterBtn);
    else filterSpecies('all', activeFilterBtn);
    return;
  }

  const searchTerms = cleanedQuery.split(/\s+/);
  currentPage = 1;
  filteredCardsData = allCardsData.filter(item => {
    const tagsText = Array.isArray(item.etiquetas) ? item.etiquetas.join(' ') : '';
    const fuentesText = Array.isArray(item.fuentes) ? item.fuentes.join(' ') : (item.fuentes || '');
    const fullContent = cleanText(`
      ${item.raza} ${item.especie} ${item.resumen} ${item.info_general}
      ${item.alimentacion} ${item.banado} ${item.vacunas} ${tagsText} ${fuentesText}
    `);
    return searchTerms.some(term => fullContent.includes(term));
  });

  renderPaginatedCards();
}