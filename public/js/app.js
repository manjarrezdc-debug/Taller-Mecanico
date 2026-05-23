// Lógica Cliente Single Page Application (SPA) para Taller Beltrán

document.addEventListener('DOMContentLoaded', () => {
  // --- INSTANCIAS DE MODALES BOOTSTRAP ---
  let orderModal = null;
  let imageModal = null;
  try {
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const orderEl = document.getElementById('orderModal');
      const imageEl = document.getElementById('imageModal');
      if (orderEl) orderModal = new bootstrap.Modal(orderEl);
      if (imageEl) imageModal = new bootstrap.Modal(imageEl);
    } else {
      console.warn("Bootstrap JS no está cargado o definido. Los modales no funcionarán.");
    }
  } catch (err) {
    console.error("Error al inicializar los modales de Bootstrap:", err);
  }

  // --- VARIABLES DE ESTADO LOCAL ---
  let currentVehicleId = null;
  let activeSession = false;

  // --- ELEMENTOS DEL DOM ---
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');

  // Navegación
  const tabSearchBtn = document.getElementById('tab-search-btn');
  const tabReceptionBtn = document.getElementById('tab-reception-btn');
  const paneSearch = document.getElementById('pane-search');
  const paneReception = document.getElementById('pane-reception');
  const paneProfile = document.getElementById('pane-profile');
  const profileBackBtn = document.getElementById('profile-back-btn');

  // Buscador
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  // Formulario Recepción
  const receptionForm = document.getElementById('reception-form');
  const fuelRange = document.getElementById('nivel_combustible');
  const fuelValText = document.getElementById('combustible-val');
  const fotosInput = document.getElementById('fotos');
  const previewsContainer = document.getElementById('previews-container');
  const receptionError = document.getElementById('reception-error');
  const receptionSuccess = document.getElementById('reception-success');

  // Ficha Detalle / Perfil de Vehículo
  const profileTitle = document.getElementById('profile-title');
  const profilePlaca = document.getElementById('profile-placa');
  const profileAno = document.getElementById('profile-ano');
  const profileColor = document.getElementById('profile-color');
  const profileCilindrada = document.getElementById('profile-cilindrada');
  const profileVin = document.getElementById('profile-vin');
  const profileDueno = document.getElementById('profile-dueno');
  const profileTelefono = document.getElementById('profile-telefono');
  
  const profileCombustibleBar = document.getElementById('profile-combustible-bar');
  const profileCombustibleTxt = document.getElementById('profile-combustible-txt');
  const profileEspejos = document.getElementById('profile-espejos');
  const profileAntena = document.getElementById('profile-antena');
  const profileStereo = document.getElementById('profile-stereo');
  const profileCristal = document.getElementById('profile-cristal');
  const profileCopas = document.getElementById('profile-copas');
  const profileNotas = document.getElementById('profile-notes') || document.getElementById('profile-notas');
  const profileFecha = document.getElementById('profile-fecha');

  const profileGallery = document.getElementById('profile-gallery');
  const profileTimeline = document.getElementById('profile-timeline');
  const emptyTimelineMsg = document.getElementById('empty-timeline-msg');
  const addOrderBtn = document.getElementById('add-order-btn');

  // Formulario de Órdenes
  const orderForm = document.getElementById('order-form');
  const orderError = document.getElementById('order-error');

  // Modal Zoom de Imagen
  const modalExpandedImg = document.getElementById('modal-expanded-img');

  // --- TRADUCCIÓN DE COMBUSTIBLE ---
  const combustibleNiveles = {
    "0": "Vacío (Reserva)",
    "1": "1/4 de Tanque",
    "2": "1/2 (Tanque Medio)",
    "3": "3/4 de Tanque",
    "4": "Lleno (1/1)"
  };

  // --- COMPROBACIÓN DE SESIÓN INICIAL ---
  checkAuthStatus();

  async function checkAuthStatus() {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (data.loggedIn) {
        showApp();
      } else {
        showLogin();
      }
    } catch (err) {
      console.error('Error al comprobar sesión:', err);
      showLogin();
    }
  }

  function showLogin() {
    activeSession = false;
    loginView.style.display = 'flex';
    appView.style.display = 'none';
  }

  function showApp() {
    activeSession = true;
    loginView.style.display = 'none';
    appView.style.display = 'block';
    // Por defecto al entrar cargar la lista general
    buscarVehiculos('');
  }

  // --- INICIO Y CIERRE DE SESIÓN ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      showLoginError('Por favor complete todos los campos.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        loginForm.reset();
        showApp();
      } else {
        showLoginError(data.error || 'Credenciales incorrectas.');
      }
    } catch (err) {
      showLoginError('Error de red al intentar conectar.');
    }
  });

  function showLoginError(msg) {
    loginError.innerText = msg;
    loginError.style.display = 'block';
  }

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      showLogin();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  });

  // --- NAVEGACIÓN ENTRE VISTAS DEL DASHBOARD ---
  tabSearchBtn.addEventListener('click', () => {
    paneSearch.classList.remove('d-none');
    paneReception.classList.add('d-none');
    paneProfile.classList.add('d-none');
    tabSearchBtn.classList.add('active');
    tabReceptionBtn.classList.remove('active');
    buscarVehiculos(searchInput.value);
  });

  tabReceptionBtn.addEventListener('click', () => {
    paneSearch.classList.add('d-none');
    paneReception.classList.remove('d-none');
    paneProfile.classList.add('d-none');
    tabReceptionBtn.classList.add('active');
    tabSearchBtn.classList.remove('active');
    receptionForm.reset();
    receptionForm.classList.remove('was-validated');
    previewsContainer.innerHTML = '';
    receptionError.style.display = 'none';
    receptionSuccess.style.display = 'none';
    // Resetear slider label
    fuelValText.innerText = combustibleNiveles["2"];
  });

  profileBackBtn.addEventListener('click', () => {
    paneSearch.classList.remove('d-none');
    paneProfile.classList.add('d-none');
    buscarVehiculos(searchInput.value);
  });

  // --- SECCIÓN BUSCADOR ---
  searchInput.addEventListener('input', () => {
    buscarVehiculos(searchInput.value.trim());
  });

  async function buscarVehiculos(query) {
    try {
      const res = await fetch(`/api/vehiculos?search=${encodeURIComponent(query)}`);
      if (res.status === 401) return showLogin();
      const vehiculos = await res.json();
      renderSearchResults(vehiculos);
    } catch (err) {
      console.error('Error al buscar vehículos:', err);
    }
  }

  function renderSearchResults(vehiculos) {
    searchResults.innerHTML = '';
    if (vehiculos.length === 0) {
      searchResults.innerHTML = `
        <div class="col-12 text-center py-5 text-secondary">
          <i class="bi bi-car-front-fill" style="font-size: 3rem;"></i>
          <p class="mt-2">No se encontraron vehículos registrados.</p>
        </div>
      `;
      return;
    }

    vehiculos.forEach(v => {
      const card = document.createElement('div');
      card.className = 'col-lg-4 col-md-6';
      card.innerHTML = `
        <div class="glass-card search-card h-100 fade-in-section" data-id="${v.id}">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h5 class="fw-bold text-light mb-0">${v.marca} ${v.modelo}</h5>
            <span class="badge bg-info text-dark fw-bold">${v.placa}</span>
          </div>
          <div class="small text-secondary mb-3">
            <div><i class="bi bi-person-fill text-info me-1"></i> Dueño: <span class="text-light">${v.dueno}</span></div>
            <div><i class="bi bi-hash text-info me-1"></i> VIN: <span class="text-light fw-semibold">${v.numero_serie_motor}</span></div>
          </div>
          <div class="text-end">
            <button class="btn btn-secondary-custom btn-sm py-1">
              Ver Detalles <i class="bi bi-arrow-right-short"></i>
            </button>
          </div>
        </div>
      `;
      
      card.querySelector('.search-card').addEventListener('click', () => {
        verPerfilVehiculo(v.id);
      });
      
      searchResults.appendChild(card);
    });
  }

  // --- SECCIÓN COMPORTAMIENTOS DEL FORMULARIO DE RECEPCIÓN ---
  fuelRange.addEventListener('input', (e) => {
    fuelValText.innerText = combustibleNiveles[e.target.value];
  });

  // Previsualización de imágenes seleccionadas
  fotosInput.addEventListener('change', (e) => {
    previewsContainer.innerHTML = '';
    const files = e.target.files;
    
    if (files.length > 0) {
      Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const item = document.createElement('div');
          item.className = 'upload-preview-item';
          item.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
          previewsContainer.appendChild(item);
        };
        reader.readAsDataURL(file);
      });
    }
  });

  // Envío del formulario de recepción
  receptionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    receptionError.style.display = 'none';
    receptionSuccess.style.display = 'none';

    // Validación nativa HTML5 (incluyendo la regex del VIN)
    if (!receptionForm.checkValidity()) {
      e.stopPropagation();
      receptionForm.classList.add('was-validated');
      
      // Abrir la primera sección del acordeón en caso de que falten campos
      const firstSection = document.getElementById('collapseOne');
      if (firstSection && !firstSection.classList.contains('show')) {
        const accordionBtn = document.querySelector('[data-bs-target="#collapseOne"]');
        if (accordionBtn) accordionBtn.click();
      }
      return;
    }

    const submitBtn = document.getElementById('submit-reception-btn');
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Guardando...`;

    // Recolectar datos con FormData (necesario para subida de múltiples archivos)
    const formData = new FormData(receptionForm);
    
    // Mapear el número de range del combustible al texto correspondiente
    const rawFuelVal = fuelRange.value;
    formData.set('nivel_combustible', combustibleNiveles[rawFuelVal]);

    try {
      const res = await fetch('/api/vehiculos', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        receptionSuccess.innerText = 'Vehículo e inventario registrados con éxito.';
        receptionSuccess.style.display = 'block';
        receptionForm.reset();
        previewsContainer.innerHTML = '';
        receptionForm.classList.remove('was-validated');
        
        // Redirigir al perfil del auto recién creado
        setTimeout(() => {
          verPerfilVehiculo(data.vehiculoId);
        }, 1200);
      } else {
        receptionError.innerText = data.error || 'Ocurrió un error al registrar el vehículo.';
        receptionError.style.display = 'block';
      }
    } catch (err) {
      receptionError.innerText = 'Error de conexión con el servidor.';
      receptionError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });

  // --- FICHA DE DETALLES Y PERFIL DEL AUTO ---
  async function verPerfilVehiculo(id) {
    currentVehicleId = id;
    
    // Ocultar buscador e ir a la vista de perfil
    paneSearch.classList.add('d-none');
    paneReception.classList.add('d-none');
    paneProfile.classList.remove('d-none');

    try {
      const res = await fetch(`/api/vehiculos/${id}`);
      if (res.status === 401) return showLogin();
      const data = await res.json();
      
      renderVehicleProfile(data);
    } catch (err) {
      console.error('Error al obtener perfil:', err);
    }
  }

  function renderVehicleProfile(data) {
    const { vehiculo, inventario, fotografias, ordenes } = data;

    // 1. Datos Generales
    profileTitle.innerText = `${vehiculo.marca} ${vehiculo.modelo}`;
    profilePlaca.innerText = vehiculo.placa;
    profileAno.innerText = vehiculo.ano || '-';
    profileColor.innerText = vehiculo.color || '-';
    profileCilindrada.innerText = vehiculo.cilindrada || '-';
    profileVin.innerText = vehiculo.numero_serie_motor;
    profileDueno.innerText = vehiculo.dueno;
    profileTelefono.innerText = vehiculo.telefono;

    // 2. Inventario de Entrada
    const fuelText = inventario.nivel_combustible || '1/2 (Tanque Medio)';
    profileCombustibleTxt.innerText = fuelText;
    
    // Calcular porcentaje de barra
    let fuelPercent = 50;
    if (fuelText.includes('Vacío')) fuelPercent = 10;
    else if (fuelText.includes('1/4')) fuelPercent = 25;
    else if (fuelText.includes('1/2') || fuelText.includes('Medio')) fuelPercent = 50;
    else if (fuelText.includes('3/4')) fuelPercent = 75;
    else if (fuelText.includes('Lleno') || fuelText.includes('1/1')) fuelPercent = 100;
    
    profileCombustibleBar.style.width = fuelPercent + '%';

    setBadgeState(profileEspejos, inventario.estado_espejos);
    setBadgeState(profileAntena, inventario.estado_antena);
    setBadgeState(profileStereo, inventario.estado_stereo);
    setBadgeState(profileCristal, inventario.estado_cristal);
    setBadgeState(profileCopas, inventario.estado_copas);

    profileNotas.innerText = inventario.notas_estado_general || 'Sin notas adicionales.';
    
    const dateFormatted = new Date(inventario.fecha_ingreso).toLocaleString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    profileFecha.innerText = dateFormatted;

    // 3. Galería de Fotos
    profileGallery.innerHTML = '';
    if (fotografias.length === 0) {
      profileGallery.innerHTML = '<p class="text-secondary small col-12 mb-0">No se adjuntaron fotografías al ingresar.</p>';
    } else {
      fotografias.forEach(foto => {
        const thumbCol = document.createElement('div');
        thumbCol.className = 'col-4 col-sm-3';
        thumbCol.innerHTML = `
          <div class="gallery-thumbnail">
            <img src="${foto.ruta_archivo}" alt="Foto inicial">
          </div>
        `;
        thumbCol.querySelector('img').addEventListener('click', () => {
          modalExpandedImg.src = foto.ruta_archivo;
          imageModal.show();
        });
        profileGallery.appendChild(thumbCol);
      });
    }

    // 4. Historial de Órdenes (Línea de Tiempo)
    renderTimeline(ordenes);
  }

  function setBadgeState(element, state) {
    element.innerText = state || 'Buen Estado';
    element.className = 'state-badge';
    
    const normState = (state || 'Buen Estado').toLowerCase();
    if (normState.includes('buen')) {
      element.classList.add('state-good');
    } else if (normState.includes('rayado') || normState.includes('medio')) {
      element.classList.add('state-scratched');
    } else if (normState.includes('roto') || normState.includes('dañado')) {
      element.classList.add('state-broken');
    } else {
      element.classList.add('state-missing');
    }
  }

  function renderTimeline(ordenes) {
    profileTimeline.innerHTML = '';
    if (ordenes.length === 0) {
      emptyTimelineMsg.style.display = 'block';
      profileTimeline.style.display = 'none';
      return;
    }

    emptyTimelineMsg.style.display = 'none';
    profileTimeline.style.display = 'block';

    ordenes.forEach(o => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      
      const normState = o.estado_orden.toLowerCase();
      const badgeClass = normState === 'abierta' ? 'bg-warning text-dark' : 'bg-success text-white';
      const actionBtnHTML = normState === 'abierta' 
        ? `<button class="btn btn-success btn-sm py-0.5 px-2 mt-2" onclick="toggleOrderStatus(${o.id}, 'Finalizada')"><i class="bi bi-check-lg me-1"></i>Finalizar Reparación</button>`
        : `<button class="btn btn-warning btn-sm py-0.5 px-2 mt-2 text-dark" onclick="toggleOrderStatus(${o.id}, 'Abierta')"><i class="bi bi-arrow-counterclockwise me-1"></i>Reabrir Orden</button>`;

      const costoFormatted = o.costo ? `$${parseFloat(o.costo).toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '$0.00';
      const fechaEntregada = o.fecha_entrega ? new Date(o.fecha_entrega).toLocaleDateString('es-ES') : 'Pendiente';

      item.innerHTML = `
        <div class="timeline-marker ${normState}"></div>
        <div class="timeline-content fade-in-section">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="badge ${badgeClass} fw-bold" style="font-size: 0.75rem;">Orden #${o.id} - ${o.estado_orden}</span>
            <span class="text-secondary small font-monospace">${costoFormatted}</span>
          </div>
          <p class="text-light mb-2" style="font-size: 0.9rem; line-height: 1.4;">${o.descripcion_reparacion}</p>
          <div class="row g-1 small text-secondary border-top border-secondary pt-2" style="font-size: 0.8rem;">
            <div class="col-sm-6"><strong>Mecánico:</strong> <span class="text-light">${o.mecanico_asignado || 'Sin asignar'}</span></div>
            <div class="col-sm-6"><strong>Fecha Entrega:</strong> <span class="text-light">${fechaEntregada}</span></div>
          </div>
          ${actionBtnHTML}
        </div>
      `;
      profileTimeline.appendChild(item);
    });
  }

  // --- CONFIGURACIÓN GLOBAL PARA HACER EL TOGGLE ACCESIBLE DESDE EL ONCLICK DEL TIMELINE ---
  window.toggleOrderStatus = async (ordenId, nuevoEstado) => {
    try {
      const res = await fetch(`/api/ordenes/${ordenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_orden: nuevoEstado })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Recargar el perfil del vehículo actual para actualizar el timeline
        verPerfilVehiculo(currentVehicleId);
      } else {
        alert(data.error || 'No se pudo actualizar el estado de la orden.');
      }
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      alert('Error de red al actualizar estado de la orden.');
    }
  };

  // --- MODAL: AGREGAR NUEVA ORDEN ---
  addOrderBtn.addEventListener('click', () => {
    orderForm.reset();
    orderError.style.display = 'none';
    orderForm.classList.remove('was-validated');
    
    // Setear fecha de entrega por defecto para hoy
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('order-fecha').value = today;
    
    orderModal.show();
  });

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    orderError.style.display = 'none';

    if (!orderForm.checkValidity()) {
      e.stopPropagation();
      orderForm.classList.add('was-validated');
      return;
    }

    const descripcion_reparacion = document.getElementById('order-desc').value.trim();
    const costo = document.getElementById('order-cost').value;
    const mecanico_asignado = document.getElementById('order-mecanico').value.trim();
    const estado_orden = document.getElementById('order-estado').value;
    const fecha_entrega = document.getElementById('order-fecha').value;

    try {
      const res = await fetch(`/api/vehiculos/${currentVehicleId}/ordenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion_reparacion,
          costo,
          mecanico_asignado,
          estado_orden,
          fecha_entrega
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        orderModal.hide();
        // Recargar perfil para ver la nueva orden
        verPerfilVehiculo(currentVehicleId);
      } else {
        orderError.innerText = data.error || 'Error al guardar la orden de reparación.';
        orderError.style.display = 'block';
      }
    } catch (err) {
      orderError.innerText = 'Error de conexión con el servidor.';
      orderError.style.display = 'block';
    }
  });

});
