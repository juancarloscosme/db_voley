-- ============================================
-- SISTEMA DE CONTROL PARA CLUB DE VÓLEY
-- Base de datos: MySQL (GoDaddy)
-- ============================================

-- Crear la base de datos (si no existe)
-- Nota: en GoDaddy el nombre puede llevar prefijo, ajústalo
CREATE DATABASE IF NOT EXISTS voley_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE voley_db;

-- ============================================
-- 1. USUARIOS (todos los roles del sistema)
-- ============================================
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin','entrenador','jugador','padre','cajero') NOT NULL DEFAULT 'jugador',
  telefono VARCHAR(20) DEFAULT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. JUGADORES (perfil deportivo)
-- ============================================
CREATE TABLE jugadores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  categoria VARCHAR(20) DEFAULT NULL,
  posicion VARCHAR(30) DEFAULT NULL,
  dorsal INT DEFAULT NULL,
  tutor_id INT DEFAULT NULL,
  CONSTRAINT fk_jugador_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_jugador_tutor
    FOREIGN KEY (tutor_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 3. PAGOS / INGRESOS
-- ============================================
CREATE TABLE pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  jugador_id INT NOT NULL,
  concepto VARCHAR(50) DEFAULT NULL,
  monto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  fecha_vencimiento DATE DEFAULT NULL,
  fecha_pago DATE DEFAULT NULL,
  estado ENUM('pendiente','pagado','vencido','becado') NOT NULL DEFAULT 'pendiente',
  registrado_por INT DEFAULT NULL,
  CONSTRAINT fk_pago_jugador
    FOREIGN KEY (jugador_id) REFERENCES jugadores(id) ON DELETE CASCADE,
  CONSTRAINT fk_pago_usuario
    FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. INVENTARIO
-- ============================================
CREATE TABLE inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item VARCHAR(80) NOT NULL,
  categoria VARCHAR(30) DEFAULT NULL,
  cantidad INT NOT NULL DEFAULT 0,
  estado ENUM('nuevo','uso','dañado','baja') NOT NULL DEFAULT 'nuevo',
  fecha_adquisicion DATE DEFAULT NULL,
  vida_util_meses INT DEFAULT NULL,
  prestado_a INT DEFAULT NULL,
  CONSTRAINT fk_inventario_usuario
    FOREIGN KEY (prestado_a) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 5. CLASES / ENTRENAMIENTOS
-- ============================================
CREATE TABLE clases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  categoria VARCHAR(20) DEFAULT NULL,
  entrenador_id INT DEFAULT NULL,
  dia_semana VARCHAR(15) DEFAULT NULL,
  hora_inicio TIME DEFAULT NULL,
  hora_fin TIME DEFAULT NULL,
  cancha VARCHAR(30) DEFAULT NULL,
  CONSTRAINT fk_clase_entrenador
    FOREIGN KEY (entrenador_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 6. ASISTENCIAS
-- ============================================
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

-- ============================================
-- 7. EVALUACIONES TÉCNICAS
-- ============================================
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
  CONSTRAINT fk_eval_jugador
    FOREIGN KEY (jugador_id) REFERENCES jugadores(id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_entrenador
    FOREIGN KEY (entrenador_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE pagos ADD COLUMN fecha_inicio DATE DEFAULT NULL AFTER monto;
ALTER TABLE inventario 
ADD COLUMN fecha_ingreso DATE DEFAULT NULL,
ADD COLUMN proveedor VARCHAR(100) DEFAULT NULL;