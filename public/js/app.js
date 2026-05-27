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
  let currentVehicleData = null;

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

  // --- BOTÓN IMPRIMIR FICHA ---
  const profilePrintBtn = document.getElementById('profile-print-btn');
  if (profilePrintBtn) {
    profilePrintBtn.addEventListener('click', () => {
      if (!currentVehicleData) {
        alert("No hay datos de vehículo cargados para imprimir.");
        return;
      }
      
      const { vehiculo, inventario, fotografias } = currentVehicleData;
      
      // Mapear cabecera y fechas
      const dateFormatted = new Date(inventario.fecha_ingreso).toLocaleString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      document.getElementById('print-fecha').innerText = dateFormatted;
      document.getElementById('print-recepcion-id').innerText = inventario.id || 'N/A';
      
      // Mapear datos dueño y auto
      document.getElementById('print-dueno').innerText = vehiculo.dueno || '-';
      document.getElementById('print-telefono').innerText = vehiculo.telefono || '-';
      document.getElementById('print-vehiculo').innerText = `${vehiculo.marca} ${vehiculo.modelo}` || '-';
      document.getElementById('print-placa').innerText = vehiculo.placa || '-';
      document.getElementById('print-ano').innerText = vehiculo.ano || '-';
      document.getElementById('print-color').innerText = vehiculo.color || '-';
      document.getElementById('print-cilindrada').innerText = vehiculo.cilindrada || '-';
      document.getElementById('print-vin').innerText = vehiculo.numero_serie_motor || '-';
      
      // Mapear Combustible
      const fuelText = inventario.nivel_combustible || '1/2 (Tanque Medio)';
      document.getElementById('print-combustible').innerText = fuelText;
      
      // Posicionar marcador de combustible
      let markerPos = "50%";
      if (fuelText.includes('Vacío') || fuelText.includes('0')) markerPos = "10%";
      else if (fuelText.includes('1/4') || fuelText.includes('1')) markerPos = "30%";
      else if (fuelText.includes('1/2') || fuelText.includes('Medio') || fuelText.includes('2')) markerPos = "50%";
      else if (fuelText.includes('3/4') || fuelText.includes('3')) markerPos = "70%";
      else if (fuelText.includes('Lleno') || fuelText.includes('1/1') || fuelText.includes('4')) markerPos = "90%";
      
      document.getElementById('print-fuel-marker').style.left = markerPos;
      
      // Mapear tabla de componentes
      document.getElementById('print-espejos').innerText = inventario.estado_espejos || 'Buen Estado';
      document.getElementById('print-antena').innerText = inventario.estado_antena || 'Buen Estado';
      document.getElementById('print-stereo').innerText = inventario.estado_stereo || 'Buen Estado';
      document.getElementById('print-cristal').innerText = inventario.estado_cristal || 'Buen Estado';
      document.getElementById('print-copas').innerText = inventario.estado_copas || 'Buen Estado';
      
      // Mapear Notas
      document.getElementById('print-notas').innerText = inventario.notas_estado_general || 'Sin notas adicionales.';
      
      // Mapear fotos
      const printPhotosGrid = document.getElementById('print-photos-grid');
      printPhotosGrid.innerHTML = '';
      if (fotografias && fotografias.length > 0) {
        fotografias.forEach(foto => {
          const photoDiv = document.createElement('div');
          photoDiv.className = 'print-photo-item';
          photoDiv.innerHTML = `<img src="${foto.ruta_archivo}" alt="Foto de ingreso">`;
          printPhotosGrid.appendChild(photoDiv);
        });
      } else {
        printPhotosGrid.innerHTML = '<p style="font-size: 9pt; color: #777; font-style: italic; grid-column: span 3; margin: 0;">No se adjuntaron fotos al ingresar el vehículo.</p>';
      }
      
      // Lanzar la impresión del navegador
      window.print();
    });
  }

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
    currentVehicleData = data;
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

    // 2.5. Formato de Recepción Firmado
    const formatStatusDiv = document.getElementById('profile-signed-format-status');
    if (formatStatusDiv) {
      formatStatusDiv.innerHTML = '';
      
      if (inventario.formato_firmado) {
        const isPdf = inventario.formato_firmado.toLowerCase().endsWith('.pdf');
        const iconClass = isPdf ? 'bi-filetype-pdf text-danger' : 'bi-file-earmark-image text-success';
        
        formatStatusDiv.innerHTML = `
          <div class="d-flex align-items-center justify-content-between p-2 bg-dark rounded border border-secondary">
            <div class="d-flex align-items-center gap-2">
              <i class="bi ${iconClass}" style="font-size: 1.5rem;"></i>
              <span class="text-light small text-truncate" style="max-width: 150px;" title="${inventario.formato_firmado.split('/').pop()}">
                ${inventario.formato_firmado.split('/').pop()}
              </span>
            </div>
            <a href="${inventario.formato_firmado}" target="_blank" class="btn btn-secondary-custom btn-sm py-0.5 px-2">
              <i class="bi bi-eye me-1"></i> Ver
            </a>
          </div>
          <button class="btn btn-link btn-sm text-secondary p-0 mt-2 d-block small" id="profile-reupload-btn" style="text-decoration: none; font-size: 0.75rem;">
            <i class="bi bi-arrow-repeat me-1"></i> Cambiar documento
          </button>
          
          <div id="profile-upload-form-container" class="mt-2 d-none">
            <form id="profile-upload-form" novalidate>
              <div class="input-group">
                <input type="file" id="profile-format-input" class="form-control form-control-custom form-control-sm" accept="image/jpeg,image/png,image/webp,application/pdf" required>
                <button type="submit" class="btn btn-primary-custom btn-sm">Subir</button>
              </div>
              <div id="profile-upload-error" class="alert alert-danger p-1 mt-1 text-center small" style="display: none; font-size: 0.75rem;"></div>
            </form>
          </div>
        `;
        
        const reuploadBtn = document.getElementById('profile-reupload-btn');
        const uploadFormContainer = document.getElementById('profile-upload-form-container');
        if (reuploadBtn && uploadFormContainer) {
          reuploadBtn.addEventListener('click', () => {
            uploadFormContainer.classList.toggle('d-none');
            reuploadBtn.innerHTML = uploadFormContainer.classList.contains('d-none')
              ? '<i class="bi bi-arrow-repeat me-1"></i> Cambiar documento'
              : '<i class="bi bi-x-lg me-1"></i> Cancelar cambio';
          });
        }
        
        registerProfileUploadSubmit(vehiculo.id);
        
      } else {
        formatStatusDiv.innerHTML = `
          <p class="text-secondary small mb-2 text-center" style="font-style: italic;">No se ha cargado el formato firmado.</p>
          <form id="profile-upload-form" novalidate>
            <div class="input-group">
              <input type="file" id="profile-format-input" class="form-control form-control-custom form-control-sm" accept="image/jpeg,image/png,image/webp,application/pdf" required>
              <button type="submit" class="btn btn-primary-custom btn-sm"><i class="bi bi-upload"></i> Subir</button>
            </div>
            <div id="profile-upload-error" class="alert alert-danger p-1 mt-1 text-center small" style="display: none; font-size: 0.75rem;"></div>
          </form>
        `;
        
        registerProfileUploadSubmit(vehiculo.id);
      }
    }

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
        ? `<button class="btn btn-outline-success btn-sm mt-2" data-diagnostico="${o.diagnostico ? o.diagnostico.replace(/"/g, '&quot;') : ''}" onclick="toggleOrderStatus(this, ${o.id}, 'Finalizada')"><i class="bi bi-check-lg me-1"></i>Finalizar</button>`
        : `<button class="btn btn-outline-warning btn-sm mt-2" onclick="toggleOrderStatus(this, ${o.id}, 'Abierta')"><i class="bi bi-arrow-counterclockwise me-1"></i>Reabrir</button>`;

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
          ${o.diagnostico ? `<p class="mt-1 mb-0 text-light small"><strong>Diagnóstico:</strong> ${o.diagnostico}</p>` : ''}
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
  window.toggleOrderStatus = async (buttonElem, ordenId, nuevoEstado) => {
    try {
      // Si se intenta finalizar, preguntar por diagnóstico
      let body = { estado_orden: nuevoEstado };
      if (nuevoEstado === 'Finalizada') {
        const wantsEdit = confirm('¿Desea agregar o modificar el diagnóstico antes de finalizar la reparación?');
        if (wantsEdit) {
          const currentDiag = buttonElem.dataset.diagnostico || '';
          const nuevoDiag = prompt('Ingrese el diagnóstico (déjelo vacío para no cambiar):', currentDiag);
          if (nuevoDiag !== null) {
            body.diagnostico = nuevoDiag.trim() || null;
          }
        }
      }

      const res = await fetch(`/api/ordenes/${ordenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
        // Capturar diagnóstico (campo opcional)
        const diagnostico = document.getElementById('order-diagnostico')?.value.trim();
        // Construir FormData para envío multipart, incluyendo inventario y archivos
        const formData = new FormData();
        formData.append('descripcion_reparacion', descripcion_reparacion);
        if (diagnostico) formData.append('diagnostico', diagnostico);
        formData.append('costo', costo);
        formData.append('mecanico_asignado', mecanico_asignado);
        formData.append('estado_orden', estado_orden);
        formData.append('fecha_entrega', fecha_entrega);
        // Inventario opcional
        const nivelCombustible = document.getElementById('order-nivel_combustible')?.value;
        if (nivelCombustible !== undefined) formData.append('nivel_combustible', nivelCombustible);
        const fields = ['estado_espejos', 'estado_antena', 'estado_stereo', 'estado_cristal', 'estado_copas', 'notas_estado_general'];
        fields.forEach(f => {
          const val = document.getElementById(`order-${f}`)?.value;
          if (val !== undefined) formData.append(f, val);
        });
        // Archivos de fotos
        const fotosInput = document.getElementById('order-fotos');
        if (fotosInput && fotosInput.files) {
          for (let i = 0; i < fotosInput.files.length; i++) {
            formData.append('fotos', fotosInput.files[i]);
          }
        }
        // Formato firmado
        const firmadoInput = document.getElementById('order-formato_firmado');
        if (firmadoInput && firmadoInput.files && firmadoInput.files[0]) {
          formData.append('formato_firmado', firmadoInput.files[0]);
        }
        const res = await fetch(`/api/vehiculos/${currentVehicleId}/ordenes`, {
          method: 'POST',
          body: formData
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

  // --- REGISTRAR EL SUBMIT DE CARGA DE FORMATO ---
  function registerProfileUploadSubmit(vehiculoId) {
    const uploadForm = document.getElementById('profile-upload-form');
    if (uploadForm) {
      uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('profile-format-input');
        const uploadError = document.getElementById('profile-upload-error');
        
        if (uploadError) uploadError.style.display = 'none';
        
        if (!fileInput || fileInput.files.length === 0) {
          showUploadError("Selecciona un archivo primero.");
          return;
        }
        
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('formato_firmado', file);
        
        const submitBtn = uploadForm.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;
        
        try {
          const res = await fetch(`/api/vehiculos/${vehiculoId}/formato-firmado`, {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          
          if (res.ok && data.success) {
            verPerfilVehiculo(vehiculoId);
          } else {
            showUploadError(data.error || "Error al subir el archivo.");
          }
        } catch (err) {
          showUploadError("Error de conexión con el servidor.");
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHTML;
        }
        
        function showUploadError(msg) {
          if (uploadError) {
            uploadError.innerText = msg;
            uploadError.style.display = 'block';
          } else {
            alert(msg);
          }
        }
      });
    }
  }

});
