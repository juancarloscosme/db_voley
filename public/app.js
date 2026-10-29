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
async function cargarPagos() {
  const res = await fetch(`${API}/pagos`, { headers: headers() });
  const data = await res.json();
  
  document.getElementById('lista-pagos').innerHTML = data.map(p => `
    <div class="row">
      <span>#${p.id} - ${p.concepto} - S/ ${p.monto}</span>
      <div style="display:flex; gap: 10px; align-items:center;">
        <span class="estado ${p.estado}">${p.estado}</span>
        
        ${p.estado === 'pendiente' 
          ? `<button onclick="pagar(${p.id})" style="background: #2ecc71; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Pagar</button>` 
          : ''}

        ${p.estado === 'pagado' 
          ? `<button onclick="anularPago(${p.id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Anular</button>` 
          : ''}
      </div>
    </div>
  `).join('');

  const r = await fetch(`${API}/pagos/resumen`, { headers: headers() });
  const s = await r.json();
  document.getElementById('resumen-pagos').innerHTML = `
    <div>Pagados: ${s.pagados} (S/ ${s.total_pagado})</div>
    <div>Pendientes: ${s.pendientes} (S/ ${s.total_pendiente})</div>
  `;
}

async function crearPago() {
  await fetch(`${API}/pagos`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      jugador_id: document.getElementById('pago_jugador').value,
      concepto: document.getElementById('pago_concepto').value,
      monto: document.getElementById('pago_monto').value,
      fecha_vencimiento: document.getElementById('pago_venc').value
    })
  });
  
  // Limpiar cajas
  document.getElementById('pago_concepto').value = '';
  document.getElementById('pago_monto').value = '';
  document.getElementById('pago_venc').value = '';
  
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
  document.getElementById('lista-inventario').innerHTML = data.map(i => `
    <div class="row">
      <span>${i.item} (${i.categoria}) x${i.cantidad} - Vida útil: ${i.vida_util_meses} meses</span>
      <div style="display: flex; gap: 10px; align-items: center;">
        <span class="estado">${i.estado}</span>
        ${i.prestado_a ? `<span>Prestado a user ${i.prestado_a}</span>` : ''}
        <button onclick="eliminarItem(${i.id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">❌</button>
      </div>
    </div>
  `).join('');
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
      estado: document.getElementById('inv_estado').value,
      vida_util_meses: document.getElementById('inv_vida').value
    })
  });
  
  document.getElementById('inv_item').value = '';
  document.getElementById('inv_cat').value = '';
  document.getElementById('inv_cant').value = '';
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
      jugadores.map(j => `<option value="${j.id}">${j.nombre} (ID: ${j.id})</option>`).join('');
  }
}