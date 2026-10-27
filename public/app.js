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
  cargarPagos();
  cargarInventario();
  cargarClases();
  if (rol === 'admin') cargarUsuarios();
}

function mostrar(id) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.add('oculto'));
  document.getElementById(id).classList.remove('oculto');
  if (id === 'pagos') cargarPagos();
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
      <span class="estado ${p.estado}">${p.estado}</span>
      ${p.estado === 'pendiente'
        ? `<button onclick="pagar(${p.id})">Pagar</button>` : ''}
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
  cargarPagos();
}

async function pagar(id) {
  await fetch(`${API}/pagos/${id}/pagar`, { method: 'PUT', headers: headers() });
  cargarPagos();
}

// ---------- INVENTARIO ----------
async function cargarInventario() {
  const res = await fetch(`${API}/inventario`, { headers: headers() });
  const data = await res.json();
  document.getElementById('lista-inventario').innerHTML = data.map(i => `
    <div class="row">
      <span>${i.item} (${i.categoria}) x${i.cantidad}</span>
      <span class="estado">${i.estado}</span>
      ${i.prestado_a ? `<span>Prestado a user ${i.prestado_a}</span>` : ''}
    </div>
  `).join('');
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
  cargarClases();
}

// ---------- USUARIOS ----------
async function cargarUsuarios() {
  const res = await fetch(`${API}/usuarios`, { headers: headers() });
  if (!res.ok) return;
  const data = await res.json();
  document.getElementById('lista-usuarios').innerHTML = data.map(u => `
    <div class="row">
      <span>${u.nombre} - ${u.email}</span>
      <span class="estado">${u.rol}</span>
    </div>
  `).join('');
}