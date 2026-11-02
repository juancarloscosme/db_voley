-- ============================================
-- SISTEMA DE CONTROL PARA CLUB DE VÓLEY
-- Archivo limpio para GoDaddy (sin CREATE DATABASE ni USE)
-- ============================================

-- 1. USUARIOS
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin','entrenador','jugador','padre','cajero','directivo','voluntario') NOT NULL DEFAULT 'jugador',
  telefono VARCHAR(20) DEFAULT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  direccion VARCHAR(150) DEFAULT NULL,
  dni VARCHAR(15) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. JUGADORES
CREATE TABLE jugadores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  categoria VARCHAR(20) DEFAULT NULL,
  posicion VARCHAR(30) DEFAULT NULL,
  dorsal INT DEFAULT NULL,
  tutor_id INT DEFAULT NULL,
  nombre_completo VARCHAR(100) DEFAULT NULL,
  telefono VARCHAR(20) DEFAULT NULL,
  CONSTRAINT fk_jugador_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_jugador_tutor
    FOREIGN KEY (tutor_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. PAGOS
CREATE TABLE pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  jugador_id INT NOT NULL,
  concepto VARCHAR(50) DEFAULT NULL,
  monto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  fecha_inicio DATE DEFAULT NULL,
  fecha_vencimiento DATE DEFAULT NULL,
  fecha_pago DATE DEFAULT NULL,
  estado ENUM('pendiente','pagado','vencido','becado') NOT NULL DEFAULT 'pendiente',
  registrado_por INT DEFAULT NULL,
  CONSTRAINT fk_pago_jugador
    FOREIGN KEY (jugador_id) REFERENCES jugadores(id) ON DELETE CASCADE,
  CONSTRAINT fk_pago_usuario
    FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. INVENTARIO
CREATE TABLE inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item VARCHAR(80) NOT NULL,
  categoria VARCHAR(30) DEFAULT NULL,
  cantidad INT NOT NULL DEFAULT 0,
  estado ENUM('nuevo','uso','dañado','baja') NOT NULL DEFAULT 'nuevo',
  fecha_adquisicion DATE DEFAULT NULL,
  vida_util_meses INT DEFAULT NULL,
  prestado_a INT DEFAULT NULL,
  fecha_ingreso DATE DEFAULT NULL,
  proveedor VARCHAR(100) DEFAULT NULL,
  CONSTRAINT fk_inventario_usuario
    FOREIGN KEY (prestado_a) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. CLASES
CREATE TABLE clases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  categoria VARCHAR(20) DEFAULT NULL,
  entrenador_id INT DEFAULT NULL,
  dia_semana VARCHAR(50) DEFAULT NULL,
  hora_inicio TIME DEFAULT NULL,
  hora_fin TIME DEFAULT NULL,
  cancha VARCHAR(30) DEFAULT NULL,
  CONSTRAINT fk_clase_entrenador
    FOREIGN KEY (entrenador_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. ASISTENCIAS
CREATE TABLE asistencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clase_id INT NOT NULL,
  jugador_id INT NOT NULL,
  fecha DATE NOT NULL,
  presente TINYINT(1) NOT NULL DEFAULT 1,
  observacion TEXT DEFAULT NULL,
  CONSTRAINT fk_asistencia_clase
    FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
  CONSTRAINT fk_asistencia_jugador
    FOREIGN KEY (jugador_id) REFERENCES jugadores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. EVALUACIONES
CREATE TABLE evaluaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  jugador_id INT NOT NULL,
  entrenador_id INT DEFAULT NULL,
  fecha DATE NOT NULL,
  saque INT DEFAULT NULL,
  recepcion INT DEFAULT NULL,
  ataque INT DEFAULT NULL,
  bloqueo INT DEFAULT NULL,
  defensa INT DEFAULT NULL,
  comentario TEXT DEFAULT NULL,
  clase_id INT DEFAULT NULL,
  CONSTRAINT fk_eval_jugador
    FOREIGN KEY (jugador_id) REFERENCES jugadores(id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_entrenador
    FOREIGN KEY (entrenador_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- DATOS DE PRUEBA (Un Administrador)
-- Contraseña: 123456
-- ============================================
INSERT INTO usuarios (nombre, email, password_hash, rol, activo) 
VALUES ('Admin Principal', 'admin@voley.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 1);

ALTER TABLE jugadores ADD COLUMN fecha_nacimiento DATE DEFAULT NULL;