# Control de Programación y Seguimiento Comercial (`Comercial-Control-CRM`)

Micro-frontend de **seguimiento comercial, gestión de prospectos, control de cotizaciones y métricas publicitarias** para el CRM de **Geofal**, construido sobre **Next.js 16**, **React 19**, **TypeScript** y **Tailwind CSS v4**.

---

## 🎯 1. Propósito y Módulos Comerciales

`Comercial-Control-CRM` centraliza todo el embudo comercial y de atención a prospectos de Geofal, unificando tres tableros especializados a través de un switch de pestañas (`commercial-module-tabs.tsx`):

### A. Seguimiento Cliente (`seguimiento-cliente-grid.tsx`)
Tablero principal de prospección y negociación con clientes:
- **Congelamiento de Columnas (Pinning)**: Las columnas clave hasta RUC (`no`, `fecha_contacto`, `persona_contacto`, `numero_celular`, `email`, `razon_social`, `ruc`) permanecen fijas a la izquierda durante el scroll horizontal, con borde y sombra divisoria.
- **Catálogos Estandarizados**:
  - `estado_cliente`: *EN ESPERA DE ATENCIÓN, SE SOLICITÓ INFORMACIÓN, EN ESPERA DE INFORMACIÓN, INFORMACIÓN RECIBIDA, COTIZACIÓN EN PROCESO, COTIZACIÓN REALIZADA, COTIZACIÓN ENVIADA, NO ENVIÓ LA INFORMACIÓN, DESCARTO EL SERVICIO*.
  - `servicio_solicitado`: Catálogo cerrado con 11 servicios estándar (Ensayos de Laboratorio, Densidades, Probetas, etc.).
  - `estado_seguimiento`: *En Negociación, Se Generó una Versión, Cotización Rechazada, Se Generó Venta*.
- **Prevención de Condiciones de Carrera**: Las suscripciones Realtime de Postgres se desactivan automáticamente en la grilla durante la edición de celdas inline para evitar sobrescrituras de datos.
- **Botón de Recarga Manual**: Botón estandarizado con animación de spinner para sincronizar la base de datos bajo demanda del usuario.

### B. Publicidad Geofal (`publicidad-geofal-grid.tsx`)
- Registro y medición de canales de adquisición (Meta Ads, Google Ads, referidos directos, llamadas telefónicas).
- Análisis de efectividad y cálculo del retorno sobre inversión publicitaria (ROAS).

### C. Resumen Comercial 1 (`resumen-comercial-1-grid.tsx`)
- Tablero ejecutivo con indicadores clave de rendimiento (KPIs), volumen de cotizaciones abiertas vs. cerradas y montos acumulados de venta.

---

## 💻 2. Stack Tecnológico

| Capa | Tecnología | Propósito |
|---|---|---|
| **Framework** | Next.js 16.1.6 (App Router) | Servidor optimizado con Turbopack |
| **Biblioteca UI** | React 19.2.3 | Componentes reactivos de alta interactividad |
| **Virtualización** | TanStack React Virtual v3 | Desplazamiento fluido en listas de clientes |
| **Gestión de Grillas** | TanStack Table v8 | Paginación, ordenamiento y pinning de columnas |
| **Cache & Estado** | TanStack React Query v5 | Mutaciones optimistas y queries cacheadas |
| **Estilos** | Tailwind CSS v4 | Headers en gris claro corporativo (`bg-[#f4f4f5]`) |
| **Base de Datos & Auth** | Supabase Client v2 | Conexión directa a tablas comerciales |
| **Notificaciones** | Sonner | Feedback toast interactivo |

---

## 📁 3. Estructura del Proyecto

```
Comercial-Control-CRM/
├── src/
│   ├── app/                            # App Router de Next.js
│   │   ├── layout.tsx                  # Layout con QueryClient y Toaster
│   │   ├── page.tsx                    # Entrada con commercial-module-tabs
│   │   └── globals.css                 # Estilos globales y tokens Tailwind v4
│   ├── components/
│   │   ├── commercial-module-tabs.tsx  # Orquestador de pestañas comerciales
│   │   ├── seguimiento-cliente-grid.tsx # Grilla de seguimiento con column pinning
│   │   ├── publicidad-geofal-grid.tsx  # Grilla de control publicitario
│   │   ├── resumen-comercial-1-grid.tsx # Grilla de resumen y KPIs comerciales
│   │   ├── DatagridEditor.tsx          # Editor de datos base
│   │   ├── login-button.tsx            # Autenticación con Supabase
│   │   └── providers.tsx               # Context Providers globales
│   ├── hooks/                          # Custom hooks comerciales y de tracking
│   ├── lib/                            # Conexión Supabase y formatos
│   ├── services/                       # Servicios de consulta y mutación SQL
│   └── types/                          # Interfaces de prospectos y campañas
├── Dockerfile                          # Build multi-stage para producción
├── package.json                        # Scripts configurados con --port 8474
└── tsconfig.json                       # Configuración de compilación TypeScript
```

---

## ⚙️ 4. Instalación y Ejecución Local

### Prerrequisitos
- Node.js v20 o v22 instalado
- npm v10 o superior

### Pasos
```bash
# 1. Ingresar al directorio
cd Comercial-Control-CRM

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local

# 4. Iniciar servidor de desarrollo en puerto 8474
npm run dev
```
El módulo comercial estará disponible en: `http://localhost:8474`.

### Variables de Entorno (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://db.geofal.com.pe
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

---

## 🐳 5. Despliegue en Producción (Docker / Coolify)

```bash
# Construir imagen Docker
docker build -t comercial-control-crm \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://db.geofal.com.pe \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key \
  .

# Ejecutar contenedor
docker run -d -p 8474:8474 --name comercial-control-crm comercial-control-crm
```
En **Coolify**, el servicio se encuentra mapeado hacia `https://comercial.geofal.com.pe` con balanceo y certificados SSL administrados por Traefik.
