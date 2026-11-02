const API = '/api';
const token = () => localStorage.getItem('token');

// Variable global para saber si estamos editando un item del inventario
let itemEditandoId = null; 

// ---------- LOGIN ----------
async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('rol', data.rol);
    localStorage.setItem('nombre', data.nombre);
    window.location.href = '/dashboard.html';
  } else {
    document.getElementById('msg').textContent = data.error || 'Error';
  }
}

async function registrarAdmin() {
  const email = prompt('Email admin:');
  const password = prompt('Contraseña:');
  if (!email || !password) return;
  const res = await fetch(`${API}/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Admin', email, password, rol: 'admin' })
  });
  const data = await res.json();
  alert(data.error ? data.error : 'Admin creado. Ahora inicia sesión.');
}

function logout() {
  localStorage.clear();
  window.location.href = '/';
}

// ---------- DASHBOARD ----------
if (window.location.pathname.includes('dashboard')) {
  const rol = localStorage.getItem('rol');
  if (!token()) window.location.href = '/';
  
  document.getElementById('user-info').textContent =
    `${localStorage.getItem('nombre')} (${rol})`;

  if (rol === 'admin') {
    document.getElementById('btn-usuarios').classList.remove('oculto');
    cargarUsuarios();
  }

  cargarPagos();
  cargarInventario();
  cargarClases();
}

function mostrar(id) {
  if (id === 'usuarios' && localStorage.getItem('rol') !== 'admin') {
    alert('No tienes permisos para ver esta sección');
    return;
  }
  document.querySelectorAll('.seccion').forEach(s => s.classList.add('oculto'));
  document.getElementById(id).classList.remove('oculto');
  
  if (id === 'pagos') {
    cargarPagos();
    cargarSelectJugadores();
    cargarSelectConceptos();
  }
  if (id === 'inventario') cargarInventario();
 
  if (id === 'clases') {
    cargarClases();
    
    Promise.all([
      fetch(`${API}/usuarios/jugadores`, { headers: headers() }).then(r => r.json()),
      fetch(`${API}/pagos`, { headers: headers() }).then(r => r.json())
    ]).then(([jugadores, pagos]) => {
      
      let opcionesHTML = '<option value="">Seleccione Alumno y Clase</option>';

      pagos.forEach(pago => {
        const jugador = jugadores.find(j => j.id === pago.jugador_id);
        if (!jugador) return;

        let horario = "";
        if (pago.concepto && pago.concepto.includes('(')) {
          horario = pago.concepto.substring(pago.concepto.indexOf('('));
        }

        opcionesHTML += `<option value="${jugador.id}">${jugador.nombre} ${horario}</option>`;
      });

      document.getElementById('eval_jugador').innerHTML = opcionesHTML;
    });
  }

  if (id === 'usuarios') cargarUsuarios();
  
  if (id === 'asistencias') {
    cargarSelectClasesAsistencia();
    // ELIMINAMOS ESTA LÍNEA QUE CAUSABA EL ERROR:
    // cargarSelectJugadoresAsistencia(); 
    cargarAsistencias();
    
    // Poner fecha de hoy por defecto
    const hoy = new Date().toISOString().split('T')[0];
    if (document.getElementById('asis_fecha_rapida')) {
      document.getElementById('asis_fecha_rapida').value = hoy;
    }
  }

  if (id === 'expediente') {
    cargarSelectJugadoresExpediente();
    cargarSelectClasesExpediente();
  }

  if (id === 'familias') {
    cargarSelectFamilias(); 
  }
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token()}`
  };
}

// ---------- PAGOS ----------
let chartInstance = null;

async function cargarPagos() {
  const res = await fetch(`${API}/pagos`, { headers: headers() });
  const data = await res.json();
  
  const textoBusqueda = document.getElementById('buscar_pago').value.toLowerCase();
  const filtroEstado = document.getElementById('filtro_estado').value;
  const filtroMes = document.getElementById('filtro_mes').value;
  const filtroAnio = document.getElementById('filtro_anio').value;

  const datosFiltrados = data.filter(p => {
    const coincideTexto = p.nombre_jugador.toLowerCase().includes(textoBusqueda) || (p.concepto && p.concepto.toLowerCase().includes(textoBusqueda));
    const coincideEstado = filtroEstado === 'todos' || p.estado === filtroEstado;

    let coincideTiempo = true;
    if (p.fecha_inicio) {
      const fechaP = new Date(p.fecha_inicio);
      if (filtroMes !== 'todos' && fechaP.getMonth() !== parseInt(filtroMes)) coincideTiempo = false;
      if (filtroAnio !== 'todos' && fechaP.getFullYear() !== parseInt(filtroAnio)) coincideTiempo = false;
    } else if (filtroMes !== 'todos' || filtroAnio !== 'todos') {
      coincideTiempo = false; 
    }

    return coincideTexto && coincideEstado && coincideTiempo;
  });

  document.getElementById('lista-pagos').innerHTML = datosFiltrados.map(p => {
    const fInicio = p.fecha_inicio ? p.fecha_inicio.split('T')[0] : 'N/A';
    const fFin = p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : 'N/A';
    return `
    <div class="row">
      <div>
        <strong>#${p.id} - ${p.nombre_jugador}</strong> <br>
        <span style="font-size: 0.9em; color: #555;">
          <!-- AQUÍ SE MUESTRA EL CONCEPTO CON EL HORARIO -->
          <strong>${p.concepto}</strong> - S/ ${p.monto} <br>
          <strong>Del:</strong> ${fInicio} | <strong>Al:</strong> ${fFin}
        </span>
      </div>
      <div style="display:flex; gap: 8px; align-items:center;">
        <span class="estado ${p.estado}">${p.estado}</span>
        
        <button onclick="editarPago(${p.id})" style="background: #3498db; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✏️</button>

        ${p.estado === 'pendiente' ? `<button onclick="pagar(${p.id})" style="background: #2ecc71; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Pagar</button><button onclick="eliminarPago(${p.id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">❌</button>` : ''}
        ${p.estado === 'pagado' ? `<button onclick="anularPago(${p.id})" style="background: #f39c12; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Anular</button>` : ''}
      </div>
    </div>`;
  }).join('');

  if (datosFiltrados.length === 0) {
    document.getElementById('lista-pagos').innerHTML = '<p style="text-align:center; color:#777; padding: 20px;">No hay pagos registrados en este periodo.</p>';
  }

  const r = await fetch(`${API}/pagos/resumen`, { headers: headers() });
  const s = await r.json();
  document.getElementById('resumen-pagos').innerHTML = `
    <div>Pagados Totales: ${s.pagados} (S/ ${s.total_pagado})</div>
    <div>Pendientes Totales: ${s.pendientes} (S/ ${s.total_pendiente})</div>
  `;

  actualizarGrafico(s);
}

function actualizarGrafico(stats) {
  const ctx = document.getElementById('miGrafico');
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Total Pagado (S/)', 'Total Pendiente (S/)'],
      datasets: [{
        label: 'Balance de Caja',
        data: [stats.total_pagado, stats.total_pendiente],
        backgroundColor: ['#2ecc71', '#f39c12'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Ingresos vs Pendientes', font: { size: 16 } }
      }
    }
  });
}

function mostrarGraficos() {
  const contenedor = document.getElementById('contenedor-graficos');
  contenedor.classList.toggle('oculto');
  if (!contenedor.classList.contains('oculto')) {
    cargarPagos(); 
  }
}

async function eliminarPago(id) {
  if (!confirm('⚠️ ¿Estás seguro de eliminar este pago para siempre? Esta acción no se puede deshacer.')) return;
  
  const res = await fetch(`${API}/pagos/${id}`, {
    method: 'DELETE',
    headers: headers()
  });
  
  if (res.ok) {
    cargarPagos();
  } else {
    alert('Error al eliminar el pago');
  }
}

async function editarPago(id) {
  const res = await fetch(`${API}/pagos`, { headers: headers() });
  const data = await res.json();
  const p = data.find(pago => pago.id === id);

  if (!p) return;

  const concepto = prompt('Nuevo concepto:', p.concepto);
  const monto = prompt('Nuevo monto:', p.monto);
  const fechaInicio = prompt('Nueva Fecha de Inicio (YYYY-MM-DD):', p.fecha_inicio ? p.fecha_inicio.split('T')[0] : '');
  const fechaFin = prompt('Nueva Fecha de Fin (YYYY-MM-DD):', p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : '');

  if (concepto === null || monto === null) return;

  const updateRes = await fetch(`${API}/pagos/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({
      concepto: concepto,
      monto: monto,
      fecha_inicio: fechaInicio,
      fecha_vencimiento: fechaFin
    })
  });

  if (updateRes.ok) {
    cargarPagos();
  } else {
    alert('Error al editar el pago');
  }
}

async function crearPago() {
  const jugador_id = document.getElementById('pago_jugador').value;
  const conceptoInput = document.getElementById('pago_concepto');
  
  // Si el usuario seleccionó una sugerencia del datalist, tomamos el texto exacto
  const concepto = conceptoInput.value; 
  
  const monto = document.getElementById('pago_monto').value;
  const fechaInicioVal = document.getElementById('pago_fecha_inicio').value;
  const duracion = parseInt(document.getElementById('pago_duracion').value);
  const tipo = document.getElementById('pago_tipo_duracion').value;

  if (!jugador_id || !concepto || !monto || !fechaInicioVal || !duracion) {
    alert('Por favor, llena todos los campos, incluyendo la fecha de inicio y la duración.');
    return;
  }

  const fechaInicio = new Date(fechaInicioVal + 'T00:00:00');
  const fechaFin = new Date(fechaInicio); 
  
  if (tipo === 'dias') {
    fechaFin.setDate(fechaFin.getDate() + duracion);
  } else if (tipo === 'meses') {
    fechaFin.setMonth(fechaFin.getMonth() + duracion);
  } else if (tipo === 'anios') {
    fechaFin.setFullYear(fechaFin.getFullYear() + duracion);
  }

  const fechaFinString = fechaFin.toISOString().split('T')[0];

  await fetch(`${API}/pagos`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      jugador_id: jugador_id,
      concepto: concepto, // Se guarda el texto completo (incluyendo el horario si lo elegiste)
      monto: monto,
      fecha_inicio: fechaInicioVal,
      fecha_vencimiento: fechaFinString
    })
  });
  
  document.getElementById('pago_concepto').value = '';
  document.getElementById('pago_monto').value = '';
  document.getElementById('pago_fecha_inicio').value = '';
  document.getElementById('pago_duracion').value = '';
  
  cargarPagos();
}

async function pagar(id) {
  await fetch(`${API}/pagos/${id}/pagar`, { method: 'PUT', headers: headers() });
  cargarPagos();
}

async function anularPago(id) {
  if (!confirm('¿Estás seguro de anular este pago? Volverá a estado pendiente.')) return;
  await fetch(`${API}/pagos/${id}/anular`, { method: 'PUT', headers: headers() });
  cargarPagos();
}

// ---------- INVENTARIO ----------
async function cargarInventario() {
  const res = await fetch(`${API}/inventario`, { headers: headers() });
  const data = await res.json();
  
  const buscar = document.getElementById('buscar_inv').value.toLowerCase();
  const cat = document.getElementById('filtro_cat').value;
  const mesFiltro = document.getElementById('filtro_mes_inv').value;

  const filtrados = data.filter(i => {
    const coincideTexto = i.item.toLowerCase().includes(buscar);
    const coincideCat = cat === 'todos' || i.categoria === cat;
    
    let coincideMes = true;
    if (mesFiltro && i.fecha_ingreso) {
      coincideMes = i.fecha_ingreso.startsWith(mesFiltro);
    } else if (mesFiltro && !i.fecha_ingreso) {
      coincideMes = false;
    }

    return coincideTexto && coincideCat && coincideMes;
  });

  document.getElementById('lista-inventario').innerHTML = filtrados.map(i => {
    const fIngreso = i.fecha_ingreso ? i.fecha_ingreso.split('T')[0] : 'N/A';

    return `
    <div class="row">
      <div>
        <strong>${i.item} (${i.categoria}) x${i.cantidad}</strong> <br>
        <span style="font-size: 0.9em; color: #555;">
          Vida útil: ${i.vida_util_meses} meses | Prov: ${i.proveedor || 'N/A'} | Ingreso: ${fIngreso}
        </span>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <span class="estado">${i.estado}</span>
        <button onclick="editarItem(${i.id})" style="background: #3498db; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✏️</button>
        <button onclick="eliminarItem(${i.id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">❌</button>
      </div>
    </div>
  `}).join('');
}

async function eliminarItem(id) {
  if (!confirm('¿Estás seguro de eliminar este item del inventario?')) return;
  
  const res = await fetch(`${API}/inventario/${id}`, {
    method: 'DELETE',
    headers: headers()
  });
  
  if (res.ok) {
    cargarInventario();
  } else {
    alert('Error al eliminar el item');
  }
}

async function guardarItem() {
  const datos = {
    item: document.getElementById('inv_item').value,
    categoria: document.getElementById('inv_cat').value,
    cantidad: document.getElementById('inv_cant').value,
    proveedor: document.getElementById('inv_proveedor').value,
    fecha_ingreso: document.getElementById('inv_fecha_ingreso').value,
    estado: document.getElementById('inv_estado').value,
    vida_util_meses: document.getElementById('inv_vida').value
  };

  if (!datos.item || !datos.cantidad) {
    alert('Por favor, llena al menos el Item y la Cantidad.');
    return;
  }

  let url = `${API}/inventario`;
  let method = 'POST';

  if (itemEditandoId) {
    url = `${API}/inventario/${itemEditandoId}`;
    method = 'PUT';
  }

  const res = await fetch(url, {
    method: method, headers: headers(),
    body: JSON.stringify(datos)
  });

  if (res.ok) {
    cancelarEdicionItem(); 
  } else {
    alert('Error al guardar. Verifica la consola.');
  }
}

async function editarItem(id) {
  const res = await fetch(`${API}/inventario`, { headers: headers() });
  const data = await res.json();
  const i = data.find(item => item.id === id);

  if (!i) return;

  document.getElementById('inv_item').value = i.item;
  document.getElementById('inv_cat').value = i.categoria;
  document.getElementById('inv_cant').value = i.cantidad;
  document.getElementById('inv_proveedor').value = i.proveedor || '';
  document.getElementById('inv_fecha_ingreso').value = i.fecha_ingreso ? i.fecha_ingreso.split('T')[0] : '';
  document.getElementById('inv_estado').value = i.estado;
  document.getElementById('inv_vida').value = i.vida_util_meses;

  itemEditandoId = id;
  const btnGuardar = document.getElementById('btn-guardar-item');
  btnGuardar.textContent = 'Actualizar';
  btnGuardar.style.background = '#f39c12'; 
  btnGuardar.style.color = 'white';
  btnGuardar.style.border = 'none';
  btnGuardar.style.padding = '8px';
  btnGuardar.style.borderRadius = '6px';

  document.getElementById('btn-cancelar-item').classList.remove('oculto');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicionItem() {
  itemEditandoId = null;
  
  document.getElementById('inv_item').value = '';
  document.getElementById('inv_cat').value = '';
  document.getElementById('inv_cant').value = '';
  document.getElementById('inv_proveedor').value = '';
  document.getElementById('inv_fecha_ingreso').value = '';
  document.getElementById('inv_vida').value = '';
  
  const btnGuardar = document.getElementById('btn-guardar-item');
  btnGuardar.textContent = 'Agregar';
  btnGuardar.style.background = '';
  btnGuardar.style.color = '';
  btnGuardar.style.border = '';
  btnGuardar.style.padding = '';
  btnGuardar.style.borderRadius = '';

  document.getElementById('btn-cancelar-item').classList.add('oculto');
  
  cargarInventario();
}

// ---------- CLASES ----------
async function cargarClases() {
  const res = await fetch(`${API}/clases`, { headers: headers() });
  const data = await res.json();
  
  // Si no hay clases, mostramos un mensaje
  if (data.length === 0) {
    document.getElementById('lista-clases').innerHTML = '<p style="text-align:center; color:#777;">No hay clases registradas aún.</p>';
    return;
  }

  document.getElementById('lista-clases').innerHTML = data.map(c => {
    // Recortamos los segundos de la hora (HH:MM)
    const inicioLimpio = c.hora_inicio ? c.hora_inicio.slice(0, 5) : '';
    const finLimpio = c.hora_fin ? c.hora_fin.slice(0, 5) : '';

    return `
    <div class="row">
      <span><strong>${c.nombre}</strong> - ${c.categoria} - ${c.dia_semana} ${inicioLimpio} a ${finLimpio}</span>
      <div style="display:flex; gap: 10px; align-items:center;">
        <span>${c.cancha || ''}</span>
        <button onclick="editarClase(${c.id})" style="background: #3498db; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✏️</button>
        <button onclick="eliminarClase(${c.id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">❌</button>
      </div>
    </div>`;
  }).join('');
}

async function eliminarClase(id) {
  if (!confirm('¿Estás seguro de eliminar esta clase?')) return;
  const res = await fetch(`${API}/clases/${id}`, { method: 'DELETE', headers: headers() });
  if (res.ok) cargarClases();
}

async function editarClase(id) {
  const res = await fetch(`${API}/clases`, { headers: headers() });
  const data = await res.json();
  const c = data.find(clase => clase.id === id);
  if (!c) return;

  const nombre = prompt('Nombre de la clase:', c.nombre);
  const categoria = prompt('Categoría:', c.categoria);
  const dia = prompt('Días (L=Lunes, M=Martes, X=Miércoles, J=Jueves, V=Viernes, S=Sábado, D=Domingo):', c.dia_semana);
  const inicio = prompt('Hora Inicio (HH:MM):', c.hora_inicio ? c.hora_inicio.slice(0, 5) : '');
  const fin = prompt('Hora Fin (HH:MM):', c.hora_fin ? c.hora_fin.slice(0, 5) : '');
  const cancha = prompt('Cancha:', c.cancha);

  if (nombre === null || dia === null) return;

  await fetch(`${API}/clases/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({
      nombre, categoria, dia_semana: dia, hora_inicio: inicio, hora_fin: fin, cancha
    })
  });

  cargarClases();
}

async function crearClase() {
  const checkboxes = document.querySelectorAll('.chk-dia:checked');
  const diasSeleccionados = Array.from(checkboxes).map(cb => cb.value);
  
  if (diasSeleccionados.length === 0) {
    alert('Por favor, selecciona al menos un día para la clase.');
    return;
  }

  // Se unen las iniciales: "L, X, V"
  const dia_semana = diasSeleccionados.join(', ');

  const nombre = document.getElementById('cl_nombre').value;
  const categoria = document.getElementById('cl_cat').value;
  const hora_inicio = document.getElementById('cl_ini').value;
  const hora_fin = document.getElementById('cl_fin').value;
  const cancha = document.getElementById('cl_cancha').value;

  if (!nombre || !hora_inicio || !hora_fin) {
    alert('Por favor, llena el nombre de la clase y los horarios.');
    return;
  }

  const res = await fetch(`${API}/clases`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ nombre, categoria, dia_semana, hora_inicio, hora_fin, cancha })
  });

  if (res.ok) {
    document.getElementById('cl_nombre').value = '';
    document.getElementById('cl_cat').value = '';
    document.getElementById('cl_ini').value = '';
    document.getElementById('cl_fin').value = '';
    document.getElementById('cl_cancha').value = '';
    document.querySelectorAll('.chk-dia:checked').forEach(cb => cb.checked = false);
    cargarClases();
  } else {
    alert('Error al guardar la clase. Revisa la consola.');
  }
}

// ---------- USUARIOS ----------
async function cargarUsuarios() {
  const res = await fetch(`${API}/usuarios`, { headers: headers() });
  if (!res.ok) return;
  let data = await res.json();

  const busqueda = document.getElementById('buscar_usuario').value.toLowerCase();
  const mostrarBajas = document.getElementById('chk_bajas').checked;

  if (busqueda) {
    data = data.filter(u => 
      u.nombre.toLowerCase().includes(busqueda) || 
      u.email.toLowerCase().includes(busqueda)
    );
  }

  if (!mostrarBajas) {
    data = data.filter(u => u.activo === 1 || u.rol === 'admin'); 
  }

  document.getElementById('lista-usuarios').innerHTML = data.map(u => `
    <div class="row" style="flex-direction: column; align-items: flex-start; padding: 10px; border-bottom: 1px solid #eee; opacity: ${u.activo === 0 ? '0.6' : '1'};">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <strong>${u.nombre} ${u.dni ? `(Doc: ${u.dni})` : ''} ${u.activo === 0 ? '<span style="color:red; font-size:0.8em;">[DE BAJA]</span>' : ''}</strong>
        <span class="estado">${u.rol}</span>
      </div>
      <span style="font-size: 0.9em; color: #555;">
        📧 ${u.email} | 📱 ${u.telefono || 'Sin teléfono'} | 📍 ${u.direccion || 'Sin dirección'}
      </span>
      <div style="margin-top: 5px;">
        ${u.rol !== 'admin' ? `
          <button onclick="editarUsuario(${u.id})" style="background: #3498db; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✏️</button>
          
          ${u.activo === 1 
            ? `<button onclick="cambiarEstadoUsuario(${u.id}, 1)" style="background: #f39c12; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Dar de baja">Baja</button>` 
            : `<button onclick="cambiarEstadoUsuario(${u.id}, 0)" style="background: #2ecc71; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Reactivar">Reactivar</button>`
          }
          
          <button onclick="eliminarUsuario(${u.id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">❌</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function crearUsuario() {
  const nombre = document.getElementById('usr_nombre').value;
  const dni = document.getElementById('usr_dni').value;
  const email = document.getElementById('usr_email').value;
  const password = document.getElementById('usr_pass').value;
  const rol = document.getElementById('usr_rol').value;
  const telefono = document.getElementById('usr_tel').value;
  const direccion = document.getElementById('usr_dir').value;

  if (!nombre || !email || !password || !direccion || !dni) {
    alert('Por favor, llena todos los campos obligatorios.');
    return;
  }

  // Validación estricta del teléfono
  if (telefono.length !== 9) {
    alert('⚠️ El número móvil debe tener exactamente 9 dígitos.');
    return;
  }

  const res = await fetch(`${API}/auth/registro`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ nombre, email, password, rol, telefono, direccion, dni })
  });

  const data = await res.json();

  if (data.error) {
    alert('Error: ' + data.error);
  } else {
    alert('Usuario creado exitosamente');
    
    document.getElementById('usr_nombre').value = '';
    document.getElementById('usr_dni').value = '';
    document.getElementById('usr_email').value = '';
    document.getElementById('usr_pass').value = '';
    document.getElementById('usr_tel').value = '';
    document.getElementById('usr_dir').value = '';
    
    document.getElementById('usr_rol').value = 'padre'; // Vuelve a apoderado por defecto
    cargarUsuarios();
  }
}

async function cambiarEstadoUsuario(id, activoActual) {
  const nuevoEstado = activoActual === 1 ? 0 : 1; 
  const accion = activoActual === 1 ? 'dar de baja' : 'reactivar';
  
  if (!confirm(`¿Estás seguro de ${accion} a este usuario?`)) return;

  const res = await fetch(`${API}/usuarios/${id}/estado`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ activo: nuevoEstado })
  });
  
  if (res.ok) cargarUsuarios();
}

async function eliminarUsuario(id) {
  if (!confirm('⚠️ ¿Estás SEGURO de eliminar a este usuario para siempre? Se borrarán sus pagos y datos.')) return;

  const res = await fetch(`${API}/usuarios/${id}`, {
    method: 'DELETE',
    headers: headers()
  });
  
  if (res.ok) {
    alert('Usuario eliminado');
    cargarUsuarios(); // Recarga la lista y quita al usuario borrado
  } else {
    alert('No se puede eliminar. Puede tener registros asociados.');
  }
}

// ---------- SELECT DE JUGADORES PARA PAGOS ----------
async function cargarSelectJugadores() {
  try {
    const res = await fetch(`${API}/usuarios/jugadores`, { headers: headers() });
    if (res.ok) {
      const jugadores = await res.json();
      const select = document.getElementById('pago_jugador');
      
      if (jugadores.length === 0) {
        select.innerHTML = '<option value="">No hay jugadores registrados</option>';
        return;
      }
      
      select.innerHTML = '<option value="">Seleccione un jugador</option>' + 
        jugadores.map(j => `<option value="${j.id}">${j.nombre}</option>`).join('');
    } else {
      document.getElementById('pago_jugador').innerHTML = '<option value="">Error al cargar</option>';
    }
  } catch (error) {
    console.error("Error cargando jugadores:", error);
  }
}

async function cargarSelectConceptos() {
  try {
    const res = await fetch(`${API}/clases`, { headers: headers() });
    if (res.ok) {
      const clases = await res.json();
      const datalist = document.getElementById('lista-clases-concepto');
      
      // Agregamos el día y la hora al valor que se guardará
      datalist.innerHTML = clases.map(c => {
        const hora = c.hora_inicio ? c.hora_inicio.slice(0, 5) : '';
        return `<option value="${c.nombre} (${c.dia_semana} ${hora})">${c.nombre} (${c.dia_semana} ${hora})</option>`;
      }).join('');
    }
  } catch (error) {
    console.error('Error al cargar clases para conceptos:', error);
  }
}

// ---------- FILTROS PARA REPORTES (PAGOS) ----------
async function obtenerDatosFiltrados() {
  const res = await fetch(`${API}/pagos`, { headers: headers() });
  const data = await res.json();
  
  const textoBusqueda = document.getElementById('buscar_pago').value.toLowerCase();
  const filtroEstado = document.getElementById('filtro_estado').value;
  const filtroMes = document.getElementById('filtro_mes').value;
  const filtroAnio = document.getElementById('filtro_anio').value;

  return data.filter(p => {
    const coincideTexto = p.nombre_jugador.toLowerCase().includes(textoBusqueda) || (p.concepto && p.concepto.toLowerCase().includes(textoBusqueda));
    const coincideEstado = filtroEstado === 'todos' || p.estado === filtroEstado;

    let coincideTiempo = true;
    if (p.fecha_inicio) {
      const fechaP = new Date(p.fecha_inicio);
      if (filtroMes !== 'todos' && fechaP.getMonth() !== parseInt(filtroMes)) coincideTiempo = false;
      if (filtroAnio !== 'todos' && fechaP.getFullYear() !== parseInt(filtroAnio)) coincideTiempo = false;
    } else if (filtroMes !== 'todos' || filtroAnio !== 'todos') {
      coincideTiempo = false; 
    }

    return coincideTexto && coincideEstado && coincideTiempo;
  });
}

// ---------- REPORTE EXCEL (PAGOS) ----------
async function descargarExcel() {
  const data = await obtenerDatosFiltrados();

  if (data.length === 0) {
    alert('No hay pagos para exportar con los filtros actuales.');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
  csvContent += "ID,Jugador,Concepto,Monto,Fecha Inicio,Fecha Fin,Estado\n";

  data.forEach(p => {
    const fInicio = p.fecha_inicio ? p.fecha_inicio.split('T')[0] : '';
    const fFin = p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : '';
    csvContent += `${p.id},${p.nombre_jugador},${p.concepto},${p.monto},${fInicio},${fFin},${p.estado}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "Reporte_Pagos_Voley.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------- REPORTE PDF (PAGOS) ----------
async function descargarPDF() {
  const data = await obtenerDatosFiltrados();

  if (data.length === 0) {
    alert('No hay pagos para exportar con los filtros actuales.');
    return;
  }

  let totalPagado = 0;
  let totalPendiente = 0;
  let countPagados = 0;
  let countPendientes = 0;

  data.forEach(p => {
    if (p.estado === 'pagado') {
      totalPagado += parseFloat(p.monto);
      countPagados++;
    } else if (p.estado === 'pendiente') {
      totalPendiente += parseFloat(p.monto);
      countPendientes++;
    }
  });

  const ventana = window.open('', '_blank');
  
  let html = `
    <html>
    <head>
      <title>Reporte de Ingresos - Club Vóley</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1f4e79; text-align: center; }
        .fecha { text-align: right; font-size: 12px; color: #666; margin-bottom: 20px; }
        .resumen { background: #eaf2fb; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
        .resumen div { font-weight: bold; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #1f4e79; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .pagado { color: #27ae60; font-weight: bold; }
        .pendiente { color: #f39c12; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>🏐 Reporte de Control de Ingresos</h1>
      <div class="fecha">Generado el: ${new Date().toLocaleDateString('es-PE')}</div>
      
      <div class="resumen">
        <div style="color: #27ae60;">Total Pagados: S/ ${totalPagado.toFixed(2)} (${countPagados} registros)</div>
        <div style="color: #f39c12;">Total Pendientes: S/ ${totalPendiente.toFixed(2)} (${countPendientes} registros)</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Jugador</th>
            <th>Concepto</th>
            <th>Monto</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach(p => {
    const fInicio = p.fecha_inicio ? p.fecha_inicio.split('T')[0] : 'N/A';
    const fFin = p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : 'N/A';
    html += `
      <tr>
        <td>${p.id}</td>
        <td>${p.nombre_jugador}</td>
        <td>${p.concepto}</td>
        <td>S/ ${p.monto}</td>
        <td>${fInicio}</td>
        <td>${fFin}</td>
        <td class="${p.estado}">${p.estado.toUpperCase()}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  ventana.document.write(html);
  ventana.document.close();
}

// ---------- FILTROS PARA REPORTES (INVENTARIO) ----------
async function obtenerInventarioFiltrado() {
  const res = await fetch(`${API}/inventario`, { headers: headers() });
  const data = await res.json();
  
  const buscar = document.getElementById('buscar_inv').value.toLowerCase();
  const cat = document.getElementById('filtro_cat').value;
  const mesFiltro = document.getElementById('filtro_mes_inv').value;

  return data.filter(i => {
    const coincideTexto = i.item.toLowerCase().includes(buscar);
    const coincideCat = cat === 'todos' || i.categoria === cat;
    
    let coincideMes = true;
    if (mesFiltro && i.fecha_ingreso) {
      coincideMes = i.fecha_ingreso.startsWith(mesFiltro);
    } else if (mesFiltro && !i.fecha_ingreso) {
      coincideMes = false;
    }

    return coincideTexto && coincideCat && coincideMes;
  });
}

// ---------- REPORTE EXCEL (INVENTARIO) ----------
async function descargarExcelInventario() {
  const data = await obtenerInventarioFiltrado();

  if (data.length === 0) {
    alert('No hay items para exportar con los filtros actuales.');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
  csvContent += "ID,Item,Categoria,Cantidad,Proveedor,Fecha Ingreso,Estado,Vida Util\n";

  data.forEach(i => {
    const fIngreso = i.fecha_ingreso ? i.fecha_ingreso.split('T')[0] : '';
    csvContent += `${i.id},${i.item},${i.categoria},${i.cantidad},${i.proveedor || ''},${fIngreso},${i.estado},${i.vida_util_meses}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "Reporte_Inventario.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------- REPORTE PDF (INVENTARIO) ----------
async function descargarPDFInventario() {
  const data = await obtenerInventarioFiltrado();

  if (data.length === 0) {
    alert('No hay items para exportar con los filtros actuales.');
    return;
  }

  const ventana = window.open('', '_blank');
  
  let html = `
    <html>
    <head>
      <title>Reporte de Inventario - Club Vóley</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1f4e79; text-align: center; }
        .fecha { text-align: right; font-size: 12px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #1f4e79; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <h1>📦 Reporte de Inventario</h1>
      <div class="fecha">Generado el: ${new Date().toLocaleDateString('es-PE')}</div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Item</th>
            <th>Categoría</th>
            <th>Cant.</th>
            <th>Proveedor</th>
            <th>Ingreso</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach(i => {
    const fIngreso = i.fecha_ingreso ? i.fecha_ingreso.split('T')[0] : 'N/A';
    html += `
      <tr>
        <td>${i.id}</td>
        <td>${i.item}</td>
        <td>${i.categoria}</td>
        <td>${i.cantidad}</td>
        <td>${i.proveedor || 'N/A'}</td>
        <td>${fIngreso}</td>
        <td>${i.estado.toUpperCase()}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  ventana.document.write(html);
  ventana.document.close();
}

// ---------- CAMBIAR CONTRASEÑA ----------
async function cambiarPassword(id) {
  const nuevaPass = prompt('Ingresa la nueva contraseña para este usuario:');
  
  if (!nuevaPass) return;
  
  if (nuevaPass.length < 4) {
    alert('La contraseña debe tener al menos 4 caracteres.');
    return;
  }

  const res = await fetch(`${API}/usuarios/${id}/password`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ password: nuevaPass })
  });

  if (res.ok) {
    alert('✅ Contraseña actualizada correctamente.');
  } else {
    const data = await res.json();
    alert('Error al cambiar la contraseña: ' + (data.error || 'Intenta de nuevo'));
  }
}

// ---------- ASISTENCIAS ----------
async function cargarSelectClasesAsistencia() {
  const res = await fetch(`${API}/clases`, { headers: headers() });
  if (res.ok) {
    const clases = await res.json();
    const select = document.getElementById('asis_clase');
    select.innerHTML = '<option value="">Seleccione una clase</option>' + 
      clases.map(c => `<option value="${c.id}">${c.nombre} (${c.dia_semana})</option>`).join('');
  }
}



async function cargarAsistencias() {
  const claseId = document.getElementById('asis_clase').value;
  const mes = document.getElementById('asis_mes').value;
  const estadoFiltro = document.getElementById('asis_filtro_estado').value;

  if (!claseId) {
    document.getElementById('lista-asistencias').innerHTML = '<p style="text-align:center; color:#777;">Selecciona una clase para ver la asistencia.</p>';
    document.getElementById('resumen-asistencias').innerHTML = '';
    return;
  }

  const res = await fetch(`${API}/clases/${claseId}/asistencia`, { headers: headers() });
  let data = await res.json();

  // 1. Filtramos por mes y estado
  const filtrados = data.filter(a => {
    let coincideMes = true;
    
    if (mes !== 'todos') {
      // Extraemos solo el mes de la fecha (formato YYYY-MM-DD)
      const fechaCorta = a.fecha.split('T')[0]; 
      const partes = fechaCorta.split('-');
      const mesAsistencia = parseInt(partes[1]) - 1; 
      coincideMes = mesAsistencia === parseInt(mes);
    }

    let coincideEstado = true;
    if (estadoFiltro !== 'todos') {
      coincideEstado = (a.presente === parseInt(estadoFiltro));
    }

    return coincideMes && coincideEstado;
  });

  // 2. Calcular Resumen (Totales)
  let presentes = 0;
  let faltas = 0;
  filtrados.forEach(a => a.presente ? presentes++ : faltas++);
  
  document.getElementById('resumen-asistencias').innerHTML = `
    Mostrando: <span style="color: #2ecc71;">${presentes} Presentes</span> | 
    <span style="color: #e74c3c;">${faltas} Faltas</span> (Total: ${filtrados.length} registros)
  `;

  // 3. Dibujar la lista del historial
  if (filtrados.length === 0) {
    document.getElementById('lista-asistencias').innerHTML = '<p style="text-align:center; color:#777;">No hay registros en este periodo.</p>';
    return;
  }

  document.getElementById('lista-asistencias').innerHTML = filtrados.map(a => {
    const estadoHtml = a.presente 
      ? '<span style="color: #2ecc71; font-weight:bold;">✅ Presente</span>' 
      : '<span style="color: #e74c3c; font-weight:bold;">❌ Falta</span>';
      
    const fechaLimpia = a.fecha.split('T')[0];

    return `
    <div class="row">
      <span><strong>${fechaLimpia}</strong> - ${a.jugador}</span>
      <div style="display:flex; gap: 10px; align-items:center;">
        ${estadoHtml}
        <button onclick="editarAsistencia(${a.id}, ${a.presente})" style="background: #3498db; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Cambiar estado">✏️</button>
        <button onclick="eliminarAsistencia(${a.id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Eliminar registro">❌</button>
      </div>
    </div>`;
  }).join('');
}

async function marcarAsistencia() {
  const claseId = document.getElementById('asis_clase').value;
  const jugadorId = document.getElementById('asis_jugador').value;
  const fecha = document.getElementById('asis_fecha').value;
  const presente = parseInt(document.getElementById('asis_estado').value);

  if (!claseId || !jugadorId || !fecha) {
    alert('Por favor, selecciona la clase, el jugador y la fecha.');
    return;
  }

  const res = await fetch(`${API}/clases/${claseId}/asistencia`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      jugador_id: jugadorId,
      presente: presente,
      observacion: 'Registrado desde el panel'
    })
  });

  if (res.ok) {
    alert('Asistencia guardada correctamente');
    document.getElementById('asis_fecha').value = '';
    cargarAsistencias(); // Recargar la lista
  } else {
    alert('Error al guardar la asistencia');
  }
}

async function descargarPDFAsistencias() {
  const claseId = document.getElementById('asis_clase').value;
  const mes = document.getElementById('asis_mes').value;
  const estadoFiltro = document.getElementById('asis_filtro_estado').value;

  if (!claseId) {
    alert('Por favor, selecciona una clase primero.');
    return;
  }

  const res = await fetch(`${API}/clases/${claseId}/asistencia`, { headers: headers() });
  const data = await res.json();

  // Filtramos los datos igual que en la pantalla
  const filtrados = data.filter(a => {
    let coincideMes = true;
    if (mes !== 'todos') {
      const fechaA = new Date(a.fecha);
      coincideMes = fechaA.getMonth() === parseInt(mes);
    }
    let coincideEstado = true;
    if (estadoFiltro !== 'todos') {
      coincideEstado = (a.presente === parseInt(estadoFiltro));
    }
    return coincideMes && coincideEstado;
  });

  if (filtrados.length === 0) {
    alert('No hay registros para exportar con estos filtros.');
    return;
  }

  // Nombre de la clase para el título
  const selectClase = document.getElementById('asis_clase');
  const nombreClase = selectClase.options[selectClase.selectedIndex].text;

  const ventana = window.open('', '_blank');
  
  let html = `
    <html>
    <head>
      <title>Reporte de Asistencias - Club Vóley</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1f4e79; text-align: center; }
        .info { text-align: center; margin-bottom: 20px; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #1f4e79; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .presente { color: #27ae60; font-weight: bold; }
        .falta { color: #e74c3c; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>✅ Reporte de Asistencias</h1>
      <div class="info">
        <strong>Clase:</strong> ${nombreClase} <br>
        <strong>Generado el:</strong> ${new Date().toLocaleDateString('es-PE')}
      </div>

      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Jugador</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
  `;

  filtrados.forEach(a => {
    html += `
      <tr>
        <td>${a.fecha.split('T')[0]}</td>
        <td>${a.jugador}</td>
        <td class="${a.presente ? 'presente' : 'falta'}">
          ${a.presente ? 'PRESENTE' : 'FALTA'}
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  ventana.document.write(html);
  ventana.document.close();
}

// ---------- EXPEDIENTE DEL ALUMNO ----------
async function cargarSelectJugadoresExpediente() {
  const res = await fetch(`${API}/usuarios/jugadores`, { headers: headers() });
  if (res.ok) {
    const jugadores = await res.json();
    const select = document.getElementById('exp_jugador');
    select.innerHTML = '<option value="">Seleccione un alumno</option>' + 
      jugadores.map(j => `<option value="${j.id}">${j.nombre}</option>`).join('');
  }
}

async function cargarExpediente() {
  const jugadorId = document.getElementById('exp_jugador').value;
  const claseId = document.getElementById('exp_clase').value;
  const mesFiltro = document.getElementById('exp_mes').value;
  const anioFiltro = document.getElementById('exp_anio').value;

  if (!jugadorId) {
    document.getElementById('contenido-expediente').classList.add('oculto');
    return;
  }
  document.getElementById('contenido-expediente').classList.remove('oculto');

  // 1. Cargar Pagos (Filtrados por Mes y Año)
  const resPagos = await fetch(`${API}/pagos`, { headers: headers() });
  const pagos = await resPagos.json();
  
  let pagosJugador = pagos.filter(p => p.jugador_id == jugadorId);
  
  // Filtro de tiempo para pagos (Comparación por texto YYYY-MM-DD)
  if (mesFiltro !== 'todos' || anioFiltro !== 'todos') {
    pagosJugador = pagosJugador.filter(p => {
      if (!p.fecha_inicio) return false;
      const fechaStr = p.fecha_inicio.split('T')[0]; 
      const partes = fechaStr.split('-');
      const anio = parseInt(partes[0]);
      const mes = parseInt(partes[1]) - 1; 

      const coincideMes = mesFiltro === 'todos' || mes === parseInt(mesFiltro);
      const coincideAnio = anioFiltro === 'todos' || anio === parseInt(anioFiltro);
      return coincideMes && coincideAnio;
    });
  }

  let htmlPagos = '';
  let deudaTotal = 0;
  let hoy = new Date();

  if (pagosJugador.length === 0) {
    htmlPagos = '<p>No hay pagos en este periodo.</p>';
  } else {
    htmlPagos = '<ul style="list-style: none; padding: 0;">';
    pagosJugador.forEach(p => {
      let estadoHtml = '';
      if (p.estado === 'pendiente') {
        deudaTotal += parseFloat(p.monto);
        const fechaVencStr = p.fecha_vencimiento.split('T')[0];
        const fechaVenc = new Date(fechaVencStr + 'T00:00:00'); // Forzamos hora cero
        
        if (fechaVenc < hoy) {
          const diasMora = Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24));
          estadoHtml = `<span style="color: #e74c3c; font-weight: bold;">⚠️ Vencido hace ${diasMora} días</span>`;
        } else {
          estadoHtml = `<span style="color: #f39c12; font-weight: bold;">⏳ Pendiente (Vence: ${fechaVencStr})</span>`;
        }
      } else if (p.estado === 'pagado') {
        estadoHtml = `<span style="color: #2ecc71; font-weight: bold;">✅ Pagado</span>`;
      }
      htmlPagos += `<li style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;"><strong>${p.concepto}</strong> - S/ ${p.monto} <br>${estadoHtml}</li>`;
    });
    htmlPagos += '</ul>';
  }
  
  if (deudaTotal > 0) {
    htmlPagos = `<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; margin-bottom: 15px;"><strong>Deuda Total en este periodo: S/ ${deudaTotal.toFixed(2)}</strong></div>` + htmlPagos;
  }
  document.getElementById('exp_pagos').innerHTML = htmlPagos;

  // 2. Cargar Asistencias (Filtradas por Clase, Mes y Año)
  const resClases = await fetch(`${API}/clases`, { headers: headers() });
  let clases = await resClases.json();
  
  if (claseId !== 'todas') {
    clases = clases.filter(c => c.id == claseId);
  }

  let totalAsistencias = 0;
  let totalFaltas = 0;
  const nombreJugador = document.getElementById('exp_jugador').options[document.getElementById('exp_jugador').selectedIndex].text.split(' (')[0]; // Limpiamos el nombre

  for (const c of clases) {
    const resAsis = await fetch(`${API}/clases/${c.id}/asistencia`, { headers: headers() });
    if (resAsis.ok) {
      let asis = await resAsis.json();
      
      // Filtro de fecha para asistencias (Comparación por texto)
      asis = asis.filter(a => {
        if (!a.fecha) return false;
        const fechaStr = a.fecha.split('T')[0];
        const partes = fechaStr.split('-');
        const anio = parseInt(partes[0]);
        const mes = parseInt(partes[1]) - 1;

        const coincideMes = mesFiltro === 'todos' || mes === parseInt(mesFiltro);
        const coincideAnio = anioFiltro === 'todos' || anio === parseInt(anioFiltro);
        return coincideMes && coincideAnio;
      });

      asis.forEach(a => {
        if (a.jugador === nombreJugador) {
          if (a.presente === 1) totalAsistencias++;
          else totalFaltas++;
        }
      });
    }
  }

  document.getElementById('exp_asistencia').innerHTML = `
    <div style="display: flex; gap: 15px;">
      <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 8px; text-align: center; flex: 1;">
        <h4 style="margin: 0;">Presente</h4>
        <h2 style="margin: 10px 0 0 0;">${totalAsistencias}</h2>
      </div>
      <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 8px; text-align: center; flex: 1;">
        <h4 style="margin: 0;">Faltas</h4>
        <h2 style="margin: 10px 0 0 0;">${totalFaltas}</h2>
      </div>
    </div>
  `;

  // 3. Cargar Evaluaciones Técnicas (Filtradas por Mes y Año)
  const resEval = await fetch(`${API}/evaluaciones/jugador/${jugadorId}`, { headers: headers() });
  if (resEval.ok) {
    let evaluaciones = await resEval.json();
    
    // Filtro de fecha para evaluaciones (Comparación por texto)
    evaluaciones = evaluaciones.filter(ev => {
      if (!ev.fecha) return false;
      const fechaStr = ev.fecha.split('T')[0];
      const partes = fechaStr.split('-');
      const anio = parseInt(partes[0]);
      const mes = parseInt(partes[1]) - 1;

      const coincideMes = mesFiltro === 'todos' || mes === parseInt(mesFiltro);
      const coincideAnio = anioFiltro === 'todos' || anio === parseInt(anioFiltro);
      return coincideMes && coincideAnio;
    });

    if (evaluaciones.length === 0) {
      document.getElementById('exp_evaluaciones').innerHTML = '<p>No hay evaluaciones en este periodo.</p>';
    } else {
      let htmlEval = '<ul style="list-style: none; padding: 0;">';
      evaluaciones.forEach(ev => {
        htmlEval += `
          <li style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>Fecha: ${ev.fecha.split('T')[0]}</strong>
              <button onclick="eliminarEvaluacion(${ev.id})" style="background: #e74c3c; color: white; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer;" title="Eliminar evaluación">❌</button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 5px;">
              <span>Saque: ${ev.saque || '-'}/10</span>
              <span>Recepción: ${ev.recepcion || '-'}/10</span>
              <span>Ataque: ${ev.ataque || '-'}/10</span>
              <span>Bloqueo: ${ev.bloqueo || '-'}/10</span>
              <span>Defensa: ${ev.defensa || '-'}/10</span>
            </div>
            <span style="font-size: 0.9em; color: #666;"><em>${ev.comentario || ''}</em></span>
          </li>
        `;
      });
      htmlEval += '</ul>';
      document.getElementById('exp_evaluaciones').innerHTML = htmlEval;
    }
  }
}

async function crearEvaluacion() {
  const jugador_id = document.getElementById('eval_jugador').value;
  const fecha = document.getElementById('eval_fecha').value;
  const saque = document.getElementById('eval_saque').value;
  const recepcion = document.getElementById('eval_recepcion').value;
  const ataque = document.getElementById('eval_ataque').value;
  const bloqueo = document.getElementById('eval_bloqueo').value;
  const defensa = document.getElementById('eval_defensa').value;
  const comentario = document.getElementById('eval_comentario').value;

  if (!jugador_id || !fecha) {
    alert('Selecciona un alumno y una fecha');
    return;
  }

  // --- VALIDACIÓN 1: ¿El día de la fecha coincide con los días de la clase? ---
  const selectJugador = document.getElementById('eval_jugador');
  const textoJugador = selectJugador.options[selectJugador.selectedIndex].text;
  
  // Extraemos los días de la clase del texto (ej. "L, M, J")
  const diasClaseTexto = textoJugador.includes('(') 
    ? textoJugador.split('(')[1].replace(')', '').trim() 
    : '';
    
  const fechaObj = new Date(fecha + 'T00:00:00');
  const diaSemanaNum = fechaObj.getDay(); // 0=Domingo, 1=Lunes...
  const diasMapa = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const letraDia = diasMapa[diaSemanaNum];

  if (!diasClaseTexto.includes(letraDia)) {
    const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    alert(`⚠️ No puedes guardar la evaluación: La fecha ${fecha} cae ${nombresDias[diaSemanaNum]}, pero esta clase solo es los días ${diasClaseTexto}.`);
    return; // Detenemos el guardado
  }

  // --- VALIDACIÓN 2: ¿El alumno tiene una asistencia marcada como Presente ese día? ---
  const resClases = await fetch(`${API}/clases`, { headers: headers() });
  const clases = await resClases.json();
  
  let tieneAsistencia = false;
  const fechaComparar = fecha.split('T')[0];

  for (const c of clases) {
    const resAsis = await fetch(`${API}/clases/${c.id}/asistencia`, { headers: headers() });
    if (resAsis.ok) {
      const asistencias = await resAsis.json();
      // Buscamos si el alumno tiene un registro de "Presente" en esa fecha
      const nombreJugador = textoJugador.split(' (')[0];
      const registro = asistencias.find(a => 
        a.jugador === nombreJugador && 
        a.fecha.startsWith(fechaComparar)
      );
      
      if (registro && registro.presente === 1) {
        tieneAsistencia = true;
        break;
      }
    }
  }

  if (!tieneAsistencia) {
    alert(`⚠️ No puedes evaluar a este alumno el día ${fechaComparar} porque no tiene una asistencia marcada como PRESENTE. Por favor, ve a la pestaña "Asistencias" y regístrala primero.`);
    return; // Detenemos el guardado
  }
  // ---------------------------------------------------------

  // Si pasa ambas validaciones, guardamos la evaluación
  const res = await fetch(`${API}/evaluaciones`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      jugador_id, fecha, saque, recepcion, ataque, bloqueo, defensa, comentario
    })
  });

  if (res.ok) {
    alert('✅ Evaluación guardada correctamente');
    document.getElementById('eval_fecha').value = '';
    document.getElementById('eval_saque').value = '';
    document.getElementById('eval_recepcion').value = '';
    document.getElementById('eval_ataque').value = '';
    document.getElementById('eval_bloqueo').value = '';
    document.getElementById('eval_defensa').value = '';
    document.getElementById('eval_comentario').value = '';
  } else {
    alert('Error al guardar evaluación');
  }
}

// Función para dibujar la lista de todos los alumnos de la clase seleccionada
async function cargarListaAlumnos() {
  const claseId = document.getElementById('asis_clase').value;
  const fechaSeleccionada = document.getElementById('asis_fecha_rapida').value;

  if (!claseId || !fechaSeleccionada) {
    alert('Por favor, selecciona una clase y una fecha primero.');
    return;
  }

  // 1. Obtenemos el texto de la clase seleccionada (ej. "Entrenamiento Sub-15 (L, M, J)")
  const selectClase = document.getElementById('asis_clase');
  const textoClaseCompleto = selectClase.options[selectClase.selectedIndex].text; 

  // 2. Validación de Día de la Semana
  const diasClaseTexto = textoClaseCompleto.includes('(') 
    ? textoClaseCompleto.split('(')[1].replace(')', '').trim() 
    : '';
    
  // Convertimos la fecha seleccionada a un objeto Date
  const fechaObj = new Date(fechaSeleccionada + 'T00:00:00');
  const diaSemanaNum = fechaObj.getDay(); // 0=Domingo, 1=Lunes, 2=Martes, etc.
  
  // Mapeamos los números a las iniciales que usamos (L, M, X, J, V, S, D)
  const diasMapa = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const letraDia = diasMapa[diaSemanaNum];

  // Verificamos si la letra del día está dentro del texto de los días de la clase
  if (!diasClaseTexto.includes(letraDia)) {
    const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    document.getElementById('lista-alumnos-asistencia').innerHTML = `
      <p style="text-align:center; color:#e74c3c; padding: 20px; font-weight:bold;">
        ⚠️ La fecha seleccionada (${fechaSeleccionada}) cae ${nombresDias[diaSemanaNum]}, pero esta clase solo es los días: ${diasClaseTexto}.
      </p>`;
    return; // Detenemos la carga porque no hay clase ese día
  }

  // 3. Si el día coincide, procedemos a cargar a los alumnos
  const diasClase = diasClaseTexto;
  const nombreClase = textoClaseCompleto.split('(')[0].trim();

  const resPagos = await fetch(`${API}/pagos`, { headers: headers() });
  const pagos = await resPagos.json();

  const resJugadores = await fetch(`${API}/usuarios/jugadores`, { headers: headers() });
  const todosJugadores = await resJugadores.json();

  const fechaAsistencia = new Date(fechaSeleccionada + 'T00:00:00');
  const alumnosHabilitadosIds = [];

  pagos.forEach(pago => {
    if (pago.concepto) {
      const coincideNombre = pago.concepto.includes(nombreClase);
      const coincideDias = pago.concepto.includes(diasClase);

      if (coincideNombre && coincideDias) {
        if (pago.fecha_inicio && pago.fecha_vencimiento) {
          const fInicio = pago.fecha_inicio.split('T')[0];
          const fFin = pago.fecha_vencimiento.split('T')[0];
          
          if (fechaSeleccionada >= fInicio && fechaSeleccionada <= fFin) {
            if (!alumnosHabilitadosIds.includes(pago.jugador_id)) {
              alumnosHabilitadosIds.push(pago.jugador_id);
            }
          }
        }
      }
    }
  });

  if (alumnosHabilitadosIds.length === 0) {
    document.getElementById('lista-alumnos-asistencia').innerHTML = `<p style="text-align:center; color:#777; padding: 20px;">No hay alumnos inscritos para esta clase en esta fecha.</p>`;
    return;
  }

  const jugadoresInscritos = todosJugadores.filter(j => alumnosHabilitadosIds.includes(j.id));

  const resAsis = await fetch(`${API}/clases/${claseId}/asistencia`, { headers: headers() });
  const asistenciasGuardadas = await resAsis.json();

  let html = '';
  jugadoresInscritos.forEach(j => {
    const registro = asistenciasGuardadas.find(a => 
      a.jugador === j.nombre && a.fecha.startsWith(fechaSeleccionada)
    );
    
    let estadoActual = registro ? (registro.presente ? '✅ Presente' : '❌ Falta') : '⏳ Sin registrar';

    html += `
      <div class="row" style="padding: 10px; border-bottom: 1px solid #eee;">
        <span><strong>${j.nombre}</strong> - <em>${estadoActual}</em></span>
        <div style="display:flex; gap: 5px;">
          <button onclick="guardarAsistenciaRapida(${claseId}, ${j.id}, '${fechaSeleccionada}', 1)" style="background: #2ecc71; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Presente</button>
          <button onclick="guardarAsistenciaRapida(${claseId}, ${j.id}, '${fechaSeleccionada}', 0)" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Falta</button>
        </div>
      </div>
    `;
  });

  document.getElementById('lista-alumnos-asistencia').innerHTML = html;
}

// Función para guardar un solo clic
// Función para guardar un solo clic
async function guardarAsistenciaRapida(claseId, jugadorId, fecha, presente) {
  try {
    const res = await fetch(`${API}/clases/${claseId}/asistencia`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        jugador_id: jugadorId,
        fecha: fecha,
        presente: presente,
        observacion: 'Asistencia rápida'
      })
    });

    if (res.ok) {
      // 1. En lugar de recargar toda la lista, cambiamos el texto directamente en la pantalla
      // Buscamos el contenedor del alumno y cambiamos el "Sin registrar" por el estado real
      const filas = document.querySelectorAll('#lista-alumnos-asistencia .row');
      filas.forEach(fila => {
        if (fila.innerHTML.includes(jugadorId) || fila.innerHTML.includes('Andre')) {
          const em = fila.querySelector('em');
          if (em) {
            em.innerHTML = presente === 1 ? '✅ Presente' : '❌ Falta';
          }
        }
      });

      // 2. Recargamos el historial de abajo para que aparezca el registro
      cargarAsistencias();
      
    } else {
      const data = await res.json();
      alert('⚠️ Error de base de datos: ' + (data.error || 'Intenta de nuevo.'));
    }
  } catch (error) {
    alert('⚠️ Error de conexión: ' + error.message);
  }
}

async function cargarSelectClasesExpediente() {
  const res = await fetch(`${API}/clases`, { headers: headers() });
  if (res.ok) {
    const clases = await res.json();
    const select = document.getElementById('exp_clase');
    select.innerHTML = '<option value="todas">Todas las clases</option>' + 
      clases.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  }
}

// Función para eliminar la asistencia
async function eliminarAsistencia(id) {
  if (!confirm('¿Estás seguro de eliminar este registro de asistencia?')) return;

  const res = await fetch(`${API}/clases/asistencia/${id}`, {
    method: 'DELETE',
    headers: headers()
  });

  if (res.ok) {
    cargarAsistencias(); // Recargar historial
  } else {
    alert('Error al eliminar la asistencia');
  }
}

// Función para editar (cambiar de presente a falta)
async function editarAsistencia(id, estadoActual) {
  const nuevoEstado = estadoActual === 1 ? 0 : 1; // Si era 1 pasa a 0, si era 0 pasa a 1
  
  const res = await fetch(`${API}/clases/asistencia/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ presente: nuevoEstado })
  });

  if (res.ok) {
    cargarAsistencias(); // Recargar historial
  } else {
    alert('Error al actualizar la asistencia');
  }
}

// Función para eliminar una evaluación técnica
async function eliminarEvaluacion(id) {
  if (!confirm('⚠️ ¿Estás seguro de eliminar esta evaluación? Esta acción no se puede deshacer.')) return;

  const res = await fetch(`${API}/evaluaciones/${id}`, {
    method: 'DELETE',
    headers: headers()
  });

  if (res.ok) {
    // Recargamos el expediente para que desaparezca de la lista
    cargarExpediente(); 
  } else {
    alert('Error al eliminar la evaluación');
  }
}

// ---------- FAMILIAS ----------
async function cargarSelectFamilias() {
  const resPadres = await fetch(`${API}/usuarios`, { headers: headers() });
  if (resPadres.ok) {
    const usuarios = await resPadres.json();
    const padres = usuarios.filter(u => u.rol === 'padre');
    
    const select = document.getElementById('fam_tutor');
    select.innerHTML = '<option value="">Seleccione Apoderado</option>' + 
      padres.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
      
    // Si hay al menos un padre, seleccionamos el primero por defecto y cargamos sus hijos
    if (padres.length > 0) {
      select.value = padres[0].id;
      cargarFamiliaSeleccionada();
    } else {
      document.getElementById('detalle-familia').innerHTML = '<p style="color: #777;">No hay apoderados registrados.</p>';
    }
  }
}

// Función para crear al hijo y vincularlo automáticamente al padre
async function registrarHijo() {
  const tutor_id = document.getElementById('fam_tutor').value;
  const nombre = document.getElementById('fam_hijo_nombre').value;
  const telefono = document.getElementById('fam_hijo_tel').value;
  
  // Capturamos la fecha del calendario
  const fecha_nacimiento = document.getElementById('fam_hijo_nacimiento').value; 

  if (!tutor_id) {
    alert('Por favor, primero selecciona al apoderado en el paso 1.');
    return;
  }

  if (!nombre) {
    alert('Por favor, ingresa el nombre del hijo.');
    return;
  }

  // Enviamos la fecha al servidor
  const res = await fetch(`${API}/usuarios/hijo`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ nombre, telefono, tutor_id, fecha_nacimiento }) 
  });

  const data = await res.json();

  if (data.error) {
    alert('Error al crear al hijo: ' + data.error);
  } else {
    alert('✅ Hijo registrado exitosamente.');
    
    // Limpiamos las cajas de texto
    document.getElementById('fam_hijo_nombre').value = '';
    document.getElementById('fam_hijo_tel').value = '';
    document.getElementById('fam_hijo_nacimiento').value = ''; 
    
    cargarFamiliaSeleccionada(); 
  }
}

// Función para mostrar el padre y sus hijos (Vista 360 de la familia)
async function cargarFamiliaSeleccionada() {
  const tutor_id = document.getElementById('fam_tutor').value;
  if (!tutor_id) {
    document.getElementById('detalle-familia').innerHTML = '<p style="color: #777;">Seleccione un apoderado para ver a sus hijos.</p>';
    return;
  }

  const resUsers = await fetch(`${API}/usuarios`, { headers: headers() });
  const usuarios = await resUsers.json();
  const padre = usuarios.find(u => u.id == tutor_id);

  const resHijos = await fetch(`${API}/usuarios/hijos/${tutor_id}`, { headers: headers() });
  const hijos = await resHijos.json();

  let html = `
    <div style="background: #eaf2fb; padding: 10px; border-radius: 6px; margin-bottom: 15px;">
      <h4 style="margin: 0;">Apoderado: ${padre.nombre}</h4>
      <p style="margin: 5px 0; font-size: 0.9em;">📧 ${padre.email} | 📱 ${padre.telefono || 'Sin teléfono'} | 📄 ${padre.dni || 'Sin doc.'}</p>
    </div>
    <h4>Hijos a cargo (${hijos.length})</h4>
  `;

  if (hijos.length === 0) {
    html += '<p style="color: #777;">Este apoderado aún no tiene hijos registrados.</p>';
  } else {
    html += '<ul style="list-style: none; padding: 0;">';
    hijos.forEach(h => {
      html += `
        <li style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${h.nombre_completo}</strong> <br>
            <span style="font-size: 0.85em; color: #666;">
              🎂 ${h.fecha_nacimiento ? h.fecha_nacimiento.split('T')[0] : 'Sin fecha'} | 📱 ${h.telefono || 'Sin teléfono'}
            </span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 0.8em; color: #3498db; cursor: pointer;" onclick="mostrar('expediente'); document.getElementById('exp_jugador').value=${h.id}; cargarExpediente();">Ver Expediente 👉</span>
            <button onclick="editarHijo(${h.id})" style="background: #3498db; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Editar datos">✏️</button>
            <button onclick="eliminarHijo(${h.id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" title="Eliminar">❌</button>
          </div>
        </li>
      `;
    });
    html += '</ul>';
  }

  document.getElementById('detalle-familia').innerHTML = html;
}

// Función para Editar Usuario (que me pediste en la captura)
async function editarUsuario(id) {
  const res = await fetch(`${API}/usuarios`, { headers: headers() });
  const data = await res.json();
  const u = data.find(user => user.id === id);
  if (!u) return;

  const nombre = prompt('Nuevo nombre:', u.nombre);
  const email = prompt('Nuevo email:', u.email);
  const telefono = prompt('Nuevo teléfono:', u.telefono || '');
  const direccion = prompt('Nueva dirección:', u.direccion || '');

  if (nombre === null) return;

  // Nota: Para que esto funcione, debes crear la ruta PUT /:id/editar en routes/usuarios.js
  const updateRes = await fetch(`${API}/usuarios/${id}/editar`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ nombre, email, telefono, direccion })
  });

  if (updateRes.ok) {
    cargarUsuarios();
  } else {
    alert('Error al editar');
  }
}

async function forzarEliminarCorreo() {
  const correo = prompt("Escribe el correo bloqueado para eliminarlo (ej: juancosme@bcp.com.pe):");
  if (!correo) return;

  const confirmar = confirm(`¿Estás seguro de eliminar a ${correo} de la base de datos?`);
  if (!confirmar) return;

  // Buscamos a TODOS los usuarios (activos e inactivos)
  const res = await fetch(`${API}/usuarios`, { headers: headers() });
  const data = await res.json();

  // Buscamos el usuario que tenga ese correo exacto
  const usuario = data.find(u => u.email.toLowerCase() === correo.toLowerCase());

  if (!usuario) {
    alert('No se encontró ningún usuario con ese correo.');
    return;
  }

  // Lo eliminamos
  const deleteRes = await fetch(`${API}/usuarios/${usuario.id}`, {
    method: 'DELETE',
    headers: headers()
  });

  if (deleteRes.ok) {
    alert(`✅ Usuario ${correo} eliminado correctamente. Ya puedes crearlo de nuevo.`);
    cargarUsuarios(); // Recargar la lista
  } else {
    alert('Error al eliminar. Es posible que el usuario tenga pagos o asistencias registradas (Fallo de clave foránea).');
  }
}

async function descargarPDFFamilia() {
  const tutor_id = document.getElementById('fam_tutor').value;
  if (!tutor_id) {
    alert('Selecciona un apoderado primero.');
    return;
  }

  const resUsers = await fetch(`${API}/usuarios`, { headers: headers() });
  const usuarios = await resUsers.json();
  const padre = usuarios.find(u => u.id == tutor_id);

  const resHijos = await fetch(`${API}/usuarios/hijos/${tutor_id}`, { headers: headers() });
  const hijos = await resHijos.json();

  const ventana = window.open('', '_blank');
  
  let html = `
    <html>
    <head>
      <title>Reporte Familiar - ${padre.nombre}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1f4e79; text-align: center; }
        .info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #1f4e79; color: white; }
      </style>
    </head>
    <body>
      <h1>🏐 Reporte de Familia</h1>
      <div class="info">
        <h2>Apoderado: ${padre.nombre}</h2>
        <p><strong>Email:</strong> ${padre.email} | <strong>Teléfono:</strong> ${padre.telefono || 'N/A'}</p>
        <p><strong>Dirección:</strong> ${padre.direccion || 'N/A'} | <strong>Documento:</strong> ${padre.dni || 'N/A'}</p>
      </div>

      <h3>Hijos registrados en el club (${hijos.length})</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Nombre del Alumno</th>
            <th>F. Nacimiento</th>
            <th>Edad</th>
            <th>Teléfono</th>
          </tr>
        </thead>
        <tbody>
  `;

  hijos.forEach((h, index) => {
    // CALCULAMOS LA EDAD
    let fechaNacStr = 'N/A';
    let edad = 'N/A';
    
    if (h.fecha_nacimiento) {
      // Cortamos por si viene con hora
      fechaNacStr = h.fecha_nacimiento.split('T')[0]; 
      const nacimiento = new Date(fechaNacStr + 'T00:00:00');
      const hoy = new Date();
      let edadCalculada = hoy.getFullYear() - nacimiento.getFullYear();
      const mes = hoy.getMonth() - nacimiento.getMonth();
      // Si aún no ha pasado su cumpleaños este año, restamos 1
      if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edadCalculada--;
      }
      edad = edadCalculada + ' años';
    }

    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${h.nombre_completo}</td>
        <td>${fechaNacStr}</td>
        <td>${edad}</td>
        <td>${h.telefono || 'N/A'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `;

  ventana.document.write(html);
  ventana.document.close();
}


// Función para editar al hijo
async function editarHijo(id) {
  const tutor_id = document.getElementById('fam_tutor').value;
  const res = await fetch(`${API}/usuarios/hijos/${tutor_id}`, { headers: headers() });
  const hijos = await res.json();
  const h = hijos.find(hijo => hijo.id === id);
  
  if (!h) {
    alert('No se encontraron los datos de este alumno.');
    return;
  }

  const nombre = prompt('Nuevo nombre completo:', h.nombre_completo);
  const telefono = prompt('Nuevo teléfono:', h.telefono || '');
  
  // Si ya tiene fecha, la muestra en formato AAAA-MM-DD, si no, deja un ejemplo
  const fechaActual = h.fecha_nacimiento ? h.fecha_nacimiento.split('T')[0] : '';
  const fecha_nacimiento = prompt('Nueva fecha de nacimiento (Escribir con guiones: AAAA-MM-DD, ej: 2010-05-15):', fechaActual);

  if (nombre === null) return; 

  const updateRes = await fetch(`${API}/usuarios/hijos/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ nombre_completo: nombre, telefono, fecha_nacimiento })
  });

  if (updateRes.ok) {
    alert('✅ Datos actualizados correctamente.');
    cargarFamiliaSeleccionada(); 
  } else {
    const data = await updateRes.json();
    alert('Error al editar: ' + (data.error || 'Revisa la consola.'));
  }
}

// Función para eliminar al hijo
async function eliminarHijo(id) {
  if (!confirm('⚠️ ¿Estás seguro de eliminar a este alumno? Se borrarán sus pagos y asistencias.')) return;

  const res = await fetch(`${API}/usuarios/hijos/${id}`, {
    method: 'DELETE',
    headers: headers()
  });

  if (res.ok) {
    alert('✅ Alumno eliminado.');
    cargarFamiliaSeleccionada();
  } else {
    const data = await res.json();
    alert('Error al eliminar: ' + (data.error || 'Revisa la consola.'));
  }
}