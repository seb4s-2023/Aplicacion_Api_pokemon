// ============================================================
// PokéBuscador - Consumo de la PokeAPI (https://pokeapi.co)
// ============================================================

const API_BASE = 'https://pokeapi.co/api/v2';
const PAGE_SIZE = 20;

// Referencias al DOM
const searchInput = document.getElementById('search');
const typeFilter = document.getElementById('type-filter');
const sortOrder = document.getElementById('sort-order');
const statusMsg = document.getElementById('status-msg');
const cardGrid = document.getElementById('card-grid');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pageInfo = document.getElementById('page-info');

// Estado de la aplicación
let allPokemon = [];        // Lista completa {name, url, id}
let typeFilteredNames = null; // Set de nombres cuando hay filtro de tipo activo
let currentPage = 1;
const detailCache = new Map();

// Colores aproximados por tipo, solo para dar contexto visual a los badges
const TYPE_COLORS = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD'
};

function idFromUrl(url) {
  const parts = url.split('/').filter(Boolean);
  return parseInt(parts[parts.length - 1], 10);
}

// Obtiene la lista aplicando búsqueda, filtro de tipo y orden
function getFilteredList() {
  let list = allPokemon;

  if (typeFilteredNames) {
    list = list.filter(p => typeFilteredNames.has(p.name));
  }

  const term = searchInput.value.trim().toLowerCase();
  if (term) {
    list = list.filter(p => p.name.includes(term));
  }

  list = [...list];
  switch (sortOrder.value) {
    case 'id-asc': list.sort((a, b) => a.id - b.id); break;
    case 'id-desc': list.sort((a, b) => b.id - a.id); break;
    case 'name-asc': list.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name-desc': list.sort((a, b) => b.name.localeCompare(a.name)); break;
  }
  return list;
}

async function fetchDetail(pokemon) {
  if (detailCache.has(pokemon.name)) return detailCache.get(pokemon.name);
  try {
    const res = await fetch(pokemon.url);
    const data = await res.json();
    const detail = {
      id: data.id,
      name: data.name,
      image: data.sprites.front_default,
      types: data.types.map(t => t.type.name)
    };
    detailCache.set(pokemon.name, detail);
    return detail;
  } catch (err) {
    console.error('Error obteniendo detalle de', pokemon.name, err);
    return null;
  }
}

function buildCard(detail) {
  const card = document.createElement('div');
  card.className = 'poke-card';

  const img = document.createElement('img');
  img.src = detail.image || '';
  img.alt = detail.name;

  const name = document.createElement('h3');
  name.textContent = detail.name;

  const id = document.createElement('p');
  id.className = 'poke-id';
  id.textContent = '#' + String(detail.id).padStart(3, '0');

  card.appendChild(img);
  card.appendChild(name);
  card.appendChild(id);

  detail.types.forEach(type => {
    const badge = document.createElement('span');
    badge.className = 'type-badge';
    badge.textContent = type;
    badge.style.backgroundColor = TYPE_COLORS[type] || '#777';
    card.appendChild(badge);
  });

  return card;
}

async function renderPage() {
  const list = getFilteredList();
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  statusMsg.textContent = list.length === 0
    ? 'No se encontraron resultados con esos criterios.'
    : `Mostrando ${pageItems.length} de ${list.length} resultados`;

  pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  cardGrid.innerHTML = '<p>Cargando...</p>';
  const details = await Promise.all(pageItems.map(fetchDetail));
  cardGrid.innerHTML = '';
  details.filter(Boolean).forEach(d => cardGrid.appendChild(buildCard(d)));
}

// ---- Eventos ----

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentPage = 1;
    renderPage();
  }, 300);
});

typeFilter.addEventListener('change', async () => {
  const value = typeFilter.value;
  if (!value) {
    typeFilteredNames = null;
    currentPage = 1;
    renderPage();
    return;
  }
  statusMsg.textContent = 'Aplicando filtro de tipo...';
  try {
    const res = await fetch(`${API_BASE}/type/${value}`);
    const data = await res.json();
    typeFilteredNames = new Set(data.pokemon.map(p => p.pokemon.name));
  } catch (err) {
    console.error(err);
    typeFilteredNames = null;
  }
  currentPage = 1;
  renderPage();
});

sortOrder.addEventListener('change', () => {
  currentPage = 1;
  renderPage();
});

prevBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

nextBtn.addEventListener('click', () => {
  currentPage++;
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---- Inicialización ----

async function init() {
  statusMsg.textContent = 'Cargando lista de Pokémon desde la API...';
  try {
    const res = await fetch(`${API_BASE}/pokemon?limit=2000`);
    const data = await res.json();
    allPokemon = data.results.map(p => ({ name: p.name, url: p.url, id: idFromUrl(p.url) }));
  } catch (err) {
    statusMsg.textContent = 'No se pudo conectar con la API. Verifica tu conexión a internet.';
    console.error(err);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/type`);
    const data = await res.json();
    data.results
      .filter(t => t.name !== 'unknown' && t.name !== 'shadow')
      .forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name.charAt(0).toUpperCase() + t.name.slice(1);
        typeFilter.appendChild(opt);
      });
  } catch (err) {
    console.error('No se pudieron cargar los tipos', err);
  }

  renderPage();
}

init();
