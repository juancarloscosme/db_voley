const API = '/api';
const token = () => localStorage.getItem('token');

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
    
    // Solo muestra alumnos que tengan pagos registrados
    Promise.all([
      fetch(`${API}/usuarios/jugadores`, { headers: headers() }).then(r => r.json()),
      fetch(`${API}/pagos`, { headers: headers() }).then(r => r.json()),
      fetch(`${API}/clases`, { headers: headers() }).then(r => r.json())
    ]).then(([jugadores, pagos, clases]) => {
      let opcionesHTML = '<option value="">Seleccione Alumno y Clase</option>';
      pagos.forEach(pago => {
        const jugador = jugadores.find(j => j.id === pago.jugador_id);
        if (!jugador) return;
        const clase = clases.find(c => pago.concepto && pago.concepto.includes(c.nombre));
        let textoOpcion = jugador.nombre;
        if (clase) {
          textoOpcion += ` (${clase.dia_semana} ${clase.hora_inicio.slice(0, 5)})`;
        }
        opcionesHTML += `<option value="${jugador.id}">${textoOpcion}</option>`;
      });
      document.getElementById('eval_jugador').innerHTML = opcionesHTML;
    });
  }

  if (id === 'usuarios') cargarUsuarios();
  
  if (id === 'asistencias') {
    cargarSelectClasesAsistencia();
    cargarSelectJugadoresAsistencia();
    cargarAsistencias();
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
  if (chartInstance) chartInstance.destroy();
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
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

function mostrarGraficos() {
  const contenedor = document.getElementById('contenedor-graficos');
  contenedor.classList.toggle('oculto');
  if (!contenedor.classList.contains('oculto')) cargarPagos(); 
}

async function eliminarPago(id) {
  if (!confirm('⚠️ ¿Estás seguro de eliminar este pago para siempre?')) return;
  await fetch(`${API}/pagos/${id}`, { method: 'DELETE', headers: headers() });
  cargarPagos();
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

  await fetch(`${API}/pagos/${id}`, {
    method: 'PUT', headers: headers(),
    body: JSON.stringify({ concepto, monto, fecha_inicio: fechaInicio, fecha_vencimiento: fechaFin })
  });
  cargarPagos();
}

async function crearPago() {
  const jugador_id = document.getElementById('pago_jugador').value;
  const concepto = document.getElementById('pago_concepto').value; 
  const monto = document.getElementById('pago_monto').value;
  const fechaInicioVal = document.getElementById('pago_fecha_inicio').value;
  const duracion = parseInt(document.getElementById('pago_duracion').value);
  const tipo = document.getElementById('pago_tipo_duracion').value;

  if (!jugador_id || !concepto || !monto || !fechaInicioVal || !duracion) {
    alert('Por favor, llena todos los campos.');
    return;
  }

  const fechaInicio = new Date(fechaInicioVal + 'T00:00:00');
  const fechaFin = new Date(fechaInicio); 
  
  if (tipo === 'dias') fechaFin.setDate(fechaFin.getDate() + duracion);
  else if (tipo === 'meses') fechaFin.setMonth(fechaFin.getMonth() + duracion);
  else if (tipo === 'anios') fechaFin.setFullYear(fechaFin.getFullYear() + duracion);

  const fechaFinString = fechaFin.toISOString().split('T')[0];

  await fetch(`${API}/pagos`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ jugador_id, concepto, monto, fecha_inicio: fechaInicioVal, fecha_vencimiento: fechaFinString })
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
  if (!confirm('¿Estás seguro de anular este pago?')) return;
  await fetch(`${API}/pagos/${id}/anular`, { method: 'PUT', headers: headers() });
  cargarPagos();
}

// ---------- SELECTORES PAGOS ----------
async function cargarSelectJugadores() {
  try {
    const res = await fetch(`${API}/usuarios/jugadores`, { headers: headers() });
    if (res.ok) {
      const jugadores = await res.json();
      const select = document.getElementById('pago_jugador');
      select.innerHTML = '<option value="">Seleccione un jugador</option>' + 
        jugadores.map(j => `<option value="${j.id}">${j.nombre}</option>`).join('');
    }
  } catch (e) { console.error(e); }
}

async function cargarSelectConceptos() {
  try {
    const res = await fetch(`${API}/clases`, { headers: headers() });
    if (res.ok) {
      const clases = await res.json();
      const datalist = document.getElementById('lista-clases-concepto');
      // AQUÍ SE AGREGA EL HORARIO AL CONCEPTO
      datalist.innerHTML = clases.map(c => {
        const hora = c.hora_inicio ? c.hora_inicio.slice(0, 5) : '';
        return `<option value="${c.nombre} (${c.dia_semana} ${hora})">${c.nombre} (${c.dia_semana} ${hora})</option>`;
      }).join('');
    }
  } catch (error) { console.error(error); }
}

// ---------- REPORTES EXCEL Y PDF ----------
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

async function descargarExcel() {
  const data = await obtenerDatosFiltrados();
  if (data.length === 0) return alert('No hay pagos para exportar.');
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
  csvContent += "ID,Jugador,Concepto,Monto,Fecha Inicio,Fecha Fin,Estado\n";
  data.forEach(p => {
    const fInicio = p.fecha_inicio ? p.fecha_inicio.split('T')[0] : '';
    const fFin = p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : '';
    csvContent += `${p.id},${p.nombre_jugador},${p.concepto},${p.monto},${fInicio},${fFin},${p.estado}\n`;
  });
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", "Reporte_Pagos.csv");
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

async function descargarPDF() {
  const data = await obtenerDatosFiltrados();
  if (data.length === 0) return alert('No hay pagos para exportar.');

  let totalPagado = 0, totalPendiente = 0, countPagados = 0, countPendientes = 0;
  data.forEach(p => {
    if (p.estado === 'pagado') { totalPagado += parseFloat(p.monto); countPagados++; }
    else if (p.estado === 'pendiente') { totalPendiente += parseFloat(p.monto); countPendientes++; }
  });

  const ventana = window.open('', '_blank');
  let html = `
    <html><head><title>Reporte</title><style>
      body { font-family: Arial; padding: 20px; } h1 { color: #1f4e79; text-align: center; }
      .resumen { display: flex; justify-content: space-around; background: #eaf2fb; padding: 15px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
      th { background: #1f4e79; color: white; }
    </style></head><body>
      <h1>🏐 Reporte de Ingresos</h1>
      <div class="resumen">
        <div style="color: #27ae60;">Pagados: S/ ${totalPagado.toFixed(2)} (${countPagados})</div>
        <div style="color: #f39c12;">Pendientes: S/ ${totalPendiente.toFixed(2)} (${countPendientes})</div>
      </div>
      <table><thead><tr><th>ID</th><th>Jugador</th><th>Concepto</th><th>Monto</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead><tbody>
  `;
  data.forEach(p => {
    html += `<tr><td>${p.id}</td><td>${p.nombre_jugador}</td><td>${p.concepto}</td><td>S/ ${p.monto}</td><td>${p.fecha_inicio?.split('T')[0] || 'N/A'}</td><td>${p.fecha_vencimiento?.split('T')[0] || 'N/A'}</td><td>${p.estado.toUpperCase()}</td></tr>`;
  });
  html += `</tbody></table><script>window.onload = function() { window.print(); }</script></body></html>`;
  ventana.document.write(html); ventana.document.close();
}