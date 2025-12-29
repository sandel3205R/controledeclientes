# 📋 MASTER PROMPT - Controle de Clientes

## Documento de Especificação Técnica Completa

**Versão:** 1.0  
**Data:** 2025-12-29  
**Objetivo:** Recriar exatamente o mesmo aplicativo em um novo projeto

---

## 🎯 VISÃO GERAL DO PROJETO

### Descrição
Sistema de gestão de clientes para revendedores de serviços de streaming (IPTV). O aplicativo é um PWA (Progressive Web App) que permite:

1. **Administrador**: Gerenciar vendedores, definir planos de assinatura, ver relatórios globais e fazer backup
2. **Vendedores**: Gerenciar seus próprios clientes, servidores, templates de mensagens, cupons, indicações e contas a pagar

### Tecnologias Principais
- **Frontend**: React 18 + Vite + TypeScript
- **Estilização**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions, RLS)
- **Estado**: TanStack Query (React Query)
- **Roteamento**: React Router DOM v6
- **PWA**: vite-plugin-pwa
- **Gráficos**: Recharts
- **Data**: date-fns
- **Notificações**: Sonner (toasts)

---

## 🔐 SISTEMA DE AUTENTICAÇÃO E AUTORIZAÇÃO

### Roles (Papéis)
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'seller');
```

- **admin**: Primeiro usuário registrado automaticamente. Acesso total ao sistema
- **seller**: Todos os usuários subsequentes. Acesso apenas aos próprios dados

### Tabela de Roles
```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'seller',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);
```

### Função de Verificação de Role (Security Definer)
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### Políticas de Senha
- Mínimo 8 caracteres
- Deve conter: maiúscula, minúscula, número, símbolo especial (!@#$...)
- Verificação de força em tempo real
- Verificação de vazamento via API HaveIBeenPwned (k-anonymity)
- Vendedores com senhas fracas são forçados a atualizar no login
- Administradores são isentos da atualização forçada

### Proteção contra Força Bruta
- Após 10 tentativas falhas, usuário é banido
- Edge Function `check-login-attempt` valida antes da autenticação
- Administradores podem desbanir via Settings

---

## 👤 TABELA DE PERFIS (profiles)

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  whatsapp TEXT,
  commission_percentage NUMERIC DEFAULT 0,
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  is_permanent BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMP WITH TIME ZONE,
  temp_password_expires_at TIMESTAMP WITH TIME ZONE,
  needs_password_update BOOLEAN DEFAULT true,
  seller_plan_id UUID REFERENCES seller_plans(id),
  has_unlimited_clients BOOLEAN DEFAULT false,
  has_pro_export BOOLEAN DEFAULT false,
  pro_export_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Trigger para Novos Usuários
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, subscription_expires_at, is_permanent)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data ->> 'full_name',
    NOW() + INTERVAL '5 days',  -- Trial de 5 dias
    false
  );
  
  -- Primeiro usuário vira admin (permanente)
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    UPDATE public.profiles SET is_permanent = true WHERE id = NEW.id;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'seller');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

---

## 👥 TABELA DE CLIENTES (clients)

```sql
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  telegram TEXT,
  email TEXT,
  device TEXT,
  mac_address TEXT,
  expiration_date DATE NOT NULL,
  
  -- Plano
  plan_id UUID REFERENCES plans(id),
  plan_name TEXT,
  plan_price NUMERIC,
  
  -- Servidor
  server_id UUID REFERENCES servers(id),
  server_ids UUID[] DEFAULT '{}',
  server_name TEXT,
  
  -- Credenciais (CRIPTOGRAFADAS com AES-256-GCM)
  login TEXT,
  password TEXT,
  login2 TEXT,
  password2 TEXT,
  login3 TEXT,
  password3 TEXT,
  login4 TEXT,
  password4 TEXT,
  login5 TEXT,
  password5 TEXT,
  
  -- Pagamento
  is_paid BOOLEAN DEFAULT true,
  is_annual_paid BOOLEAN DEFAULT false,
  payment_notes TEXT,
  
  -- Indicações
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES clients(id),
  
  -- Créditos Compartilhados
  shared_panel_id UUID REFERENCES shared_panels(id),
  shared_slot_type TEXT, -- 'p2p' ou 'iptv'
  
  -- Tipo de conta
  account_type TEXT,
  app_name TEXT,
  screens INTEGER DEFAULT 1,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Trigger para Gerar Código de Indicação
```sql
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      new_code := upper(substring(md5(random()::text) from 1 for 6));
      SELECT EXISTS(SELECT 1 FROM clients WHERE referral_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.referral_code := new_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER generate_referral_code_trigger
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();
```

---

## 🔒 CRIPTOGRAFIA DE CREDENCIAIS

### Sistema
- Algoritmo: AES-256-GCM
- Chave: ENCRYPTION_KEY (secret do Supabase)
- Edge Function: `crypto`

### Campos Criptografados
- login, password (1 ao 5)
- Credenciais de client_apps

### Hook useCrypto
```typescript
const { encryptCredentials, decryptCredentials, decryptSingle } = useCrypto();

// Criptografar antes de salvar
const encrypted = await encryptCredentials({
  login: 'usuario',
  password: 'senha123'
});

// Descriptografar para exibir
const decrypted = await decryptCredentials(clientData);
```

---

## 📊 OUTRAS TABELAS PRINCIPAIS

### servers (Servidores)
```sql
CREATE TABLE public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  monthly_cost NUMERIC DEFAULT 0,
  credit_cost NUMERIC DEFAULT 0,
  credit_recharge_cost NUMERIC DEFAULT 0,
  total_credits INTEGER DEFAULT 0,
  used_credits INTEGER DEFAULT 0,
  payment_due_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### plans (Planos de Cliente)
```sql
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  duration_days INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### shared_panels (Créditos Compartilhados)
```sql
CREATE TABLE public.shared_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  total_slots INTEGER NOT NULL DEFAULT 3,
  p2p_slots INTEGER DEFAULT 0,
  iptv_slots INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### whatsapp_templates (Templates de Mensagem)
```sql
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'welcome', 'expiring', 'credentials', 'billing', etc.
  message TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### coupons (Cupons de Desconto)
```sql
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed');

CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  discount_type discount_type DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  min_plan_value NUMERIC,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### coupon_usages (Uso de Cupons)
```sql
CREATE TABLE public.coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  seller_id UUID NOT NULL,
  original_price NUMERIC NOT NULL,
  discount_applied NUMERIC NOT NULL,
  final_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### referrals (Indicações)
```sql
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  referrer_client_id UUID NOT NULL REFERENCES clients(id),
  referred_client_id UUID NOT NULL REFERENCES clients(id),
  discount_percentage NUMERIC DEFAULT 50,
  coupon_id UUID REFERENCES coupons(id),
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### bills_to_pay (Contas a Pagar)
```sql
CREATE TABLE public.bills_to_pay (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  description TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_whatsapp TEXT,
  recipient_telegram TEXT,
  recipient_pix TEXT,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### client_apps (Aplicativos de Cliente)
```sql
CREATE TABLE public.client_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  app_type TEXT NOT NULL,
  email TEXT,
  password TEXT, -- CRIPTOGRAFADO
  mac_address TEXT,
  device_id TEXT,
  app_price NUMERIC DEFAULT 0,
  activation_date DATE DEFAULT CURRENT_DATE,
  expiration_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### app_types (Tipos de Aplicativo Personalizados)
```sql
CREATE TABLE public.app_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  uses_email BOOLEAN DEFAULT true, -- true = email/password, false = MAC/ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### message_history (Histórico de Mensagens)
```sql
CREATE TABLE public.message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  client_id UUID REFERENCES clients(id),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  delivery_status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'pending'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### client_message_tracking (Rastreamento de Mensagens por Vencimento)
```sql
CREATE TABLE public.client_message_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  seller_id UUID NOT NULL,
  expiration_date DATE NOT NULL,
  messaged_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### admin_messages (Mensagens do Admin para Vendedores)
```sql
CREATE TABLE public.admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### login_attempts (Tentativas de Login)
```sql
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  is_successful BOOLEAN DEFAULT false,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### notification_preferences (Preferências de Notificação)
```sql
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  days_before JSONB DEFAULT '[3]'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### push_subscriptions (Inscrições Push)
```sql
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### seller_plans (Planos de Vendedor)
```sql
CREATE TABLE public.seller_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  max_clients INTEGER,
  price_monthly NUMERIC DEFAULT 0,
  is_best_value BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### account_categories (Categorias de Conta)
```sql
CREATE TABLE public.account_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'tag',
  color TEXT DEFAULT 'gray',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### app_settings (Configurações Globais)
```sql
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## 🔒 POLÍTICAS RLS (Row Level Security)

### Padrão para todas as tabelas de vendedor:
```sql
-- Vendedores veem apenas seus próprios dados
CREATE POLICY "Sellers can view their own data" ON public.TABELA
FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own data" ON public.TABELA
FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own data" ON public.TABELA
FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own data" ON public.TABELA
FOR DELETE USING (auth.uid() = seller_id);

-- Admins veem tudo
CREATE POLICY "Admins can view all data" ON public.TABELA
FOR SELECT USING (has_role(auth.uid(), 'admin'));
```

---

## 🔧 EDGE FUNCTIONS

### 1. crypto (Criptografia)
- **verify_jwt:** true
- **Ações:** encrypt, decrypt, encrypt_batch, decrypt_batch
- **Usa:** ENCRYPTION_KEY

### 2. check-login-attempt (Verificação de Login)
- **verify_jwt:** false
- **Ações:** check, register_failure, register_success
- **Limite:** 10 tentativas falhas = ban

### 3. create-seller (Criar Vendedor)
- **verify_jwt:** true
- **Requer:** role admin
- **Cria:** usuário no auth + profile

### 4. change-seller-password (Alterar Senha)
- **verify_jwt:** true
- **Requer:** role admin

### 5. generate-temp-password (Senha Temporária)
- **verify_jwt:** true
- **Requer:** role admin
- **Validade:** 4 horas

### 6. cleanup-trash (Limpar Lixeira)
- **verify_jwt:** true
- **Requer:** role admin
- **Exclui:** vendedores marcados como deletados

### 7. backup-data (Backup)
- **verify_jwt:** true
- **Requer:** role admin

### 8. restore-data (Restaurar Backup)
- **verify_jwt:** true
- **Requer:** role admin

### 9. send-push-notifications (Notificações Push)
- **verify_jwt:** false
- **Usa:** VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

### 10. get-vapid-public-key (Chave VAPID Pública)
- **verify_jwt:** false

### 11. test-push-notification (Testar Notificação)
- **verify_jwt:** true

---

## 📱 ESTRUTURA DE ROTAS

```typescript
// Rotas Públicas
/auth         - Login/Registro
/install      - Instruções de instalação PWA

// Rotas Protegidas (qualquer usuário autenticado)
/dashboard    - Dashboard (diferente para admin/seller)
/clients      - Gerenciar clientes (seller only)
/servers      - Gerenciar servidores (seller only)
/bills        - Contas a pagar (seller only)
/coupons      - Cupons de desconto (seller only)
/referrals    - Sistema de indicações (seller only)
/templates    - Templates de mensagem
/messages     - Histórico de mensagens
/settings     - Configurações

// Rotas Admin Only
/sellers      - Gerenciar vendedores
/reports      - Relatórios globais
/plans        - Gerenciar planos
/backup       - Backup e restauração
```

---

## 🎨 TEMAS DISPONÍVEIS

### Temas Dark (Padrão)
1. **netflix** (padrão) - Vermelho/Preto
2. **neon-blue** - Ciano/Roxo
3. **emerald** - Verde esmeralda
4. **purple-galaxy** - Roxo galáxia
5. **sunset-orange** - Laranja pôr do sol
6. **cyberpunk** - Rosa/Ciano neon
7. **ocean-deep** - Azul oceano
8. **gold-luxury** - Dourado luxo
9. **aurora-violet** - Violeta aurora

### Temas Light
10. **citrus-light** - Laranja claro
11. **mint-fresh** - Verde menta
12. **sky-breeze** - Azul céu
13. **rose-garden** - Rosa jardim
14. **lavender-dream** - Lavanda

### Temas Sazonais
- **christmas** - Natal (verde/vermelho + neve)
- **newyear** - Ano Novo (dourado/fogos)
- **carnival** - Carnaval (colorido)
- **clients-control** - Tema padrão do app

---

## 📲 FUNCIONALIDADES PRINCIPAIS

### Para Vendedores

#### 1. Gestão de Clientes
- CRUD completo de clientes
- Filtros: ativos, vencendo (7 dias), vencidos, não pagos
- Busca por nome, telefone, email
- Ordenação por nome, vencimento
- Visualização em cards com status colorido
- Importação em massa via CSV/Excel
- Criptografia automática de credenciais

#### 2. Mensagens WhatsApp/Telegram
- Templates personalizáveis por tipo
- Variáveis dinâmicas: {nome}, {login}, {senha}, {vencimento}, {preco}, etc.
- Envio individual ou em massa
- Modo manual (um por um) para envios em massa
- Histórico de todas as mensagens enviadas
- Rastreamento de mensagens por vencimento

#### 3. Créditos Compartilhados
- Criar painéis com slots P2P e IPTV
- Vincular clientes a slots
- Badge na sidebar mostrando slots disponíveis
- Ações: cobrar, lembrar, boas-vindas, desvincular

#### 4. Servidores
- Servidores de custo fixo (mensalidade)
- Servidores de crédito (custo por crédito)
- Alertas de créditos baixos (80%, 95%)
- Cálculo automático de reserva por cliente

#### 5. Contas a Pagar
- Cadastro com destinatário, valor, vencimento
- Contatos: WhatsApp, Telegram, PIX
- Status: pendente/pago
- Filtros por período

#### 6. Cupons de Desconto
- Desconto percentual ou valor fixo
- Limite de usos
- Valor mínimo do plano
- Data de expiração
- Relatório de uso com exportação CSV

#### 7. Sistema de Indicações
- Código único por cliente
- Desconto automático para indicador
- Rastreamento de indicações

#### 8. Aplicativos de Cliente
- Tipos customizáveis (nome + tipo de credencial)
- Credenciais: email/senha ou MAC/ID
- Data de ativação e expiração separadas
- Preço específico por app

#### 9. Dashboard
- Cards: total, ativos, vencendo, vencidos
- Receita total
- Custos fixos e de créditos
- Lucro líquido
- Gráficos de status
- Alertas de créditos baixos

### Para Administradores

#### 1. Gestão de Vendedores
- Criar vendedores com email/senha
- Definir período de assinatura
- Estados: Ativos, Expirados, Lixeira
- Filtro por dias expirados (7, 15, 30, todos)
- Busca por nome ou email
- Ações: +5 dias, +30 dias, tornar permanente, remover dias

#### 2. Senhas Temporárias
- Gerar senha de 8 caracteres
- Validade: 4 horas
- Envio automático via WhatsApp
- Admin nunca vê senha real do vendedor

#### 3. Mensagens Broadcast
- Enviar avisos para todos os vendedores
- Prioridades: baixa, normal, alta, urgente
- Data de expiração
- Banner no dashboard dos vendedores

#### 4. Backup e Restauração
- Backup de todas as tabelas
- Restauração completa

#### 5. Usuários Banidos
- Visualizar usuários bloqueados
- Desbanir usuários

---

## 🔔 SISTEMA DE NOTIFICAÇÕES PUSH

### Configuração
- PWA com Service Worker (sw-push.js)
- VAPID Authentication
- Compatível com iOS 16.4+

### Fluxo
1. Usuário habilita notificações em Settings
2. Subscription salva em push_subscriptions
3. Edge Function envia notificações

---

## 📱 PWA CONFIGURATION

### vite.config.ts
```typescript
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    navigateFallback: '/index.html',
  },
  manifest: {
    name: 'Controle de Clientes',
    short_name: 'Clientes',
    theme_color: '#e50914',
    background_color: '#141414',
    display: 'standalone',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
})
```

### Atualização Automática
- Sem prompts de atualização
- Atualiza silenciosamente em background
- Botão "Forçar Atualização" disponível

---

## 🔐 SECRETS DO SUPABASE

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
ENCRYPTION_KEY          # Para AES-256-GCM
VAPID_PUBLIC_KEY        # Para Push Notifications
VAPID_PRIVATE_KEY       # Para Push Notifications
```

---

## 📁 ESTRUTURA DE PASTAS

```
src/
├── components/
│   ├── admin/              # Componentes específicos do admin
│   ├── apps/               # ClientAppsManager, AppTypesManager
│   ├── auth/               # ForcePasswordUpdateDialog, PasswordStrengthMeter
│   ├── bills/              # BillDialog
│   ├── categories/         # AccountCategoriesManager
│   ├── clients/            # ClientCard, ClientDialog, BulkImportDialog, BulkMessageDialog
│   ├── coupons/            # CouponsManager, CouponUsageReport
│   ├── dashboard/          # StatCard, SubscriptionCountdown
│   ├── layout/             # AppLayout
│   ├── messages/           # MessageHistoryList
│   ├── onboarding/         # OnboardingTour
│   ├── referrals/          # ReferralsManager
│   ├── sellers/            # ChangePasswordDialog, TempPasswordDialog
│   ├── shared-panels/      # SharedPanelsManager, SharedPanelsBadge
│   ├── templates/          # WhatsAppTemplatesManager
│   └── ui/                 # Componentes shadcn/ui
├── hooks/
│   ├── useAuth.tsx
│   ├── useCrypto.tsx
│   ├── useExpirationAlerts.tsx
│   ├── useLoginAttempts.tsx
│   ├── useMessageHistory.tsx
│   ├── useMessageTracking.tsx
│   ├── useNotificationBadge.tsx
│   ├── useOfflineSync.tsx
│   ├── useOnboardingTour.tsx
│   ├── usePasswordStrength.tsx
│   ├── usePasswordUpdateCheck.tsx
│   ├── usePWAUpdate.tsx
│   ├── useSharedPanels.tsx
│   ├── useTheme.tsx
│   └── useValueVisibility.tsx
├── pages/
│   ├── Auth.tsx
│   ├── Backup.tsx
│   ├── Bills.tsx
│   ├── Clients.tsx
│   ├── Coupons.tsx
│   ├── Dashboard.tsx
│   ├── Install.tsx
│   ├── MessageHistory.tsx
│   ├── Plans.tsx
│   ├── Referrals.tsx
│   ├── Reports.tsx
│   ├── Sellers.tsx
│   ├── Servers.tsx
│   ├── Settings.tsx
│   └── Templates.tsx
├── modules/
│   └── notifications/      # NotificationCard, useNotifications
├── integrations/
│   └── supabase/
│       ├── client.ts       # Cliente Supabase (auto-gerado)
│       └── types.ts        # Tipos do banco (auto-gerado)
└── assets/
    └── logo.jpg

supabase/
└── functions/
    ├── backup-data/
    ├── change-seller-password/
    ├── check-login-attempt/
    ├── cleanup-trash/
    ├── create-seller/
    ├── crypto/
    ├── generate-temp-password/
    ├── get-vapid-public-key/
    ├── restore-data/
    ├── send-push-notifications/
    └── test-push-notification/
```

---

## 🎯 VARIÁVEIS DE TEMPLATE DE MENSAGEM

```
{nome}              - Nome do cliente
{login}             - Login principal
{senha}             - Senha principal
{login2} a {login5} - Logins adicionais
{senha2} a {senha5} - Senhas adicionais
{vencimento}        - Data de vencimento (DD/MM/YYYY)
{vencimento_dinamico} - "hoje", "amanhã", "em X dias"
{preco}             - Preço do plano
{dias_restantes}    - Dias até vencer
{servidor}          - Nome do servidor
{app}               - Nome do aplicativo
```

---

## 💡 REGRAS DE NEGÓCIO IMPORTANTES

1. **Pagamento**: Status de pago/não pago persiste através de renovações. Clientes não pagos continuam marcados mesmo após renovar.

2. **Mensagens de Cobrança**: Clientes não pagos recebem aviso especial sobre pagar 2 meses.

3. **Créditos Compartilhados**: Terminologia sempre "Créditos Compartilhados", nunca "painéis compartilhados".

4. **Senhas de Vendedor**: Admin NUNCA vê senha real. Apenas gera temporárias de 4 horas.

5. **Renovação de Vendedor**: Dias são adicionados à data futura de expiração, não à data atual.

6. **Primeiro Usuário**: Automaticamente admin permanente.

7. **Trial de Vendedor**: 5 dias iniciais para novos vendedores.

8. **WhatsApp do Admin**: +5531998518865 (SANDEL) - usado em renovações e contatos.

---

## 📦 DEPLOY

### Vercel
- vercel.json configurado para SPA routing
- Environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

### Lovable Cloud
- Deploy automático de Edge Functions
- Supabase integrado

---

## 🚀 COMO RECRIAR

1. Criar novo projeto Lovable
2. Habilitar Cloud (Supabase)
3. Copiar este documento como Knowledge do projeto
4. Solicitar: "Recrie o aplicativo seguindo o Master Prompt"
5. Configurar secrets: ENCRYPTION_KEY, VAPID keys
6. Testar todas as funcionalidades

---

**FIM DO DOCUMENTO**
