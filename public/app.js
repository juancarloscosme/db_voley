const API = '/api';
const token = () => localStorage.getItem('token');

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
  }
  if (id === 'inventario') cargarInventario();
  if (id === 'clases') cargarClases();
  if (id === 'usuarios') cargarUsuarios();
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
          ${p.concepto} - S/ ${p.monto} <br>
          <strong>Del:</strong> ${fInicio} | <strong>Al:</strong> ${fFin}
        </span>
      </div>
      <div style="display:flex; gap: 8px; align-items:center;">
        <span class="estado ${p.estado}">${p.estado}</span>
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

async function crearPago() {
  const jugador_id = document.getElementById('pago_jugador').value;
  const concepto = document.getElementById('pago_concepto').value;
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
      concepto: concepto,
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

async function crearItem() {
  await fetch(`${API}/inventario`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      item: document.getElementById('inv_item').value,
      categoria: document.getElementById('inv_cat').value,
      cantidad: document.getElementById('inv_cant').value,
      proveedor: document.getElementById('inv_proveedor').value,
      fecha_ingreso: document.getElementById('inv_fecha_ingreso').value,
      estado: document.getElementById('inv_estado').value,
      vida_util_meses: document.getElementById('inv_vida').value
    })
  });
  
  document.getElementById('inv_item').value = '';
  document.getElementById('inv_cat').value = '';
  document.getElementById('inv_cant').value = '';
  document.getElementById('inv_proveedor').value = '';
  document.getElementById('inv_fecha_ingreso').value = '';
  document.getElementById('inv_vida').value = '';
  
  cargarInventario();
}

// ---------- CLASES ----------
async function cargarClases() {
  const res = await fetch(`${API}/clases`, { headers: headers() });
  const data = await res.json();
  document.getElementById('lista-clases').innerHTML = data.map(c => `
    <div class="row">
      <span>${c.nombre} - ${c.categoria} - ${c.dia_semana} ${c.hora_inicio}-${c.hora_fin}</span>
      <span>${c.cancha || ''}</span>
    </div>
  `).join('');
}

async function crearClase() {
  await fetch(`${API}/clases`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      nombre: document.getElementById('cl_nombre').value,
      categoria: document.getElementById('cl_cat').value,
      dia_semana: document.getElementById('cl_dia').value,
      hora_inicio: document.getElementById('cl_ini').value,
      hora_fin: document.getElementById('cl_fin').value,
      cancha: document.getElementById('cl_cancha').value
    })
  });

  document.getElementById('cl_nombre').value = '';
  document.getElementById('cl_cat').value = '';
  document.getElementById('cl_dia').value = '';
  document.getElementById('cl_ini').value = '';
  document.getElementById('cl_fin').value = '';
  document.getElementById('cl_cancha').value = '';

  cargarClases();
}

// ---------- USUARIOS ----------
async function cargarUsuarios() {
  const res = await fetch(`${API}/usuarios`, { headers: headers() });
  if (!res.ok) return;
  const data = await res.json();
  
  document.getElementById('lista-usuarios').innerHTML = data.map(u => `
    <div class="row">
      <span>${u.nombre} - ${u.email} ${u.activo === 0 ? '<strong style="color:red">(Dado de baja)</strong>' : ''}</span>
      <div style="display:flex; gap: 8px; align-items:center;">
        <span class="estado">${u.rol}</span>
        
        ${u.rol !== 'admin' ? `
          <button onclick="cambiarEstadoUsuario(${u.id}, ${u.activo})" 
            style="background: ${u.activo === 1 ? '#f39c12' : '#2ecc71'}; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
            ${u.activo === 1 ? 'Dar de baja' : 'Reactivar'}
          </button>

          <button onclick="eliminarUsuario(${u.id})" 
            style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
            ❌
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function crearUsuario() {
  const nombre = document.getElementById('usr_nombre').value;
  const email = document.getElementById('usr_email').value;
  const password = document.getElementById('usr_pass').value;
  const rol = document.getElementById('usr_rol').value;

  if (!nombre || !email || !password) {
    alert('Por favor, llena todos los campos');
    return;
  }

  const res = await fetch(`${API}/auth/registro`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ nombre, email, password, rol })
  });

  const data = await res.json();

  if (data.error) {
    alert('Error: ' + data.error);
  } else {
    alert('Usuario creado exitosamente');
    document.getElementById('usr_nombre').value = '';
    document.getElementById('usr_email').value = '';
    document.getElementById('usr_pass').value = '';
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
    cargarUsuarios();
  } else {
    alert('No se puede eliminar');
  }
}

// ---------- SELECT DE JUGADORES PARA PAGOS ----------
async function cargarSelectJugadores() {
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