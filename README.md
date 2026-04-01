# Retiros de Socios — Guía de instalación

## Paso 1: Crear cuenta en Supabase (gratis)

1. Entrá a **https://supabase.com** → "Start your project" → creá una cuenta con Google o email
2. Creá un nuevo proyecto (nombre: `retiros-socios`, elegí una contraseña y región: South America)
3. Esperá que termine de crear (~2 minutos)
4. Andá a **SQL Editor** (ícono de terminal en la barra izquierda)
5. Pegá y ejecutá este SQL para crear las tablas:

```sql
-- Tabla de configuración compartida
create table config (
  id int primary key default 1,
  empresa text default 'Mi Empresa',
  socios jsonb default '["Socio A", "Socio B"]'
);
insert into config (id, empresa, socios) values (1, 'Mi Empresa', '["Socio A", "Socio B"]');

-- Tabla de cheques compartida
create table cheques (
  id text primary key,
  numero text,
  monto float,
  fecha_carga text,
  fecha_cobro text,
  destino text,
  estado text default 'pendiente',
  cargado_por text,
  acreditado_en bigint,
  created_at bigint
);

-- Habilitar acceso público (sin login requerido)
alter table config enable row level security;
alter table cheques enable row level security;
create policy "public" on config for all using (true) with check (true);
create policy "public" on cheques for all using (true) with check (true);
```

6. En la barra izquierda andá a **Settings → API**
7. Copiá estos dos valores (los vas a necesitar en el Paso 3):
   - **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
   - **anon public key** (texto largo que empieza con `eyJ...`)

---

## Paso 2: Obtener clave de Anthropic (para el OCR de cheques)

1. Entrá a **https://console.anthropic.com**
2. Andá a **API Keys** → "Create Key"
3. Copiá la clave (empieza con `sk-ant-...`)
4. **Importante:** necesitás tener crédito cargado (mínimo $5 USD). Andá a Billing y cargá.

---

## Paso 3: Subir a Vercel (gratis)

### Opción A — Sin código (recomendada):

1. Creá una cuenta en **https://github.com** si no tenés
2. Creá un nuevo repositorio llamado `retiros-socios` (público o privado)
3. Subí todos estos archivos al repositorio
4. Creá cuenta en **https://vercel.com** → "Add New Project" → importá el repo de GitHub
5. En el paso de configuración, antes de deployar, agregá estas **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = la URL que copiaste de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la anon key de Supabase
   - `ANTHROPIC_API_KEY` = tu clave de Anthropic
6. Click en **Deploy** → en 2 minutos tenés la URL lista

### Opción B — Con terminal:

```bash
npm install -g vercel
cd retiros-socios
cp .env.example .env.local
# Editá .env.local con tus claves reales
vercel --prod
```

---

## Paso 4: Usar la app

1. La URL de Vercel (algo como `https://retiros-socios-xxx.vercel.app`) es tu app
2. Mandásela al otro socio por WhatsApp
3. Cada uno la abre, elige su nombre **una sola vez**, y el dispositivo lo recuerda
4. Para agregarla a la pantalla de inicio: en el celular, tocás el ícono de compartir → "Agregar a inicio"
5. Andá a **Config** y cambiá los nombres de los socios y la empresa

---

## Resumen de costos

| Servicio | Costo |
|----------|-------|
| Supabase | Gratis (hasta 500MB) |
| Vercel | Gratis |
| Anthropic (OCR) | ~$0.01 por cheque analizado |

El único costo real es el OCR: menos de 1 centavo de dólar por cheque.
