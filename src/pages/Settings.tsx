import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { User, Lock, Save, Palette, Check, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { NotificationSettingsCard } from '@/modules/notifications/NotificationSettingsCard';
import { MyPlanCard } from '@/components/settings/MyPlanCard';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
});

const passwordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export default function Settings() {
  const { user, role } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [allowFirstAdminSignup, setAllowFirstAdminSignup] = useState(false);
  const [loadingAdminSetting, setLoadingAdminSetting] = useState(true);
  const [savingAdminSetting, setSavingAdminSetting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const isAdmin = role === 'admin';

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        if (data?.full_name) {
          setFullName(data.full_name);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };
    
    loadProfile();
  }, [user]);

  // Load first admin signup setting
  useEffect(() => {
    if (!isAdmin) return;
    
    const loadSetting = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'allow_first_admin_signup')
          .maybeSingle();
        
        setAllowFirstAdminSignup(data?.value === 'true');
      } catch (error) {
        console.error('Error loading admin setting:', error);
      } finally {
        setLoadingAdminSetting(false);
      }
    };
    
    loadSetting();
  }, [isAdmin]);

  const handleToggleFirstAdminSignup = async (enabled: boolean) => {
    setSavingAdminSetting(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key: 'allow_first_admin_signup', 
          value: enabled ? 'true' : 'false',
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      if (error) throw error;
      
      setAllowFirstAdminSignup(enabled);
      toast.success(enabled 
        ? 'Cadastro de primeiro admin ATIVADO' 
        : 'Cadastro de primeiro admin DESATIVADO'
      );
    } catch (error: any) {
      toast.error('Erro ao atualizar configuração');
      console.error(error);
    } finally {
      setSavingAdminSetting(false);
    }
  };

  const handleThemeChange = async (newTheme: typeof theme) => {
    setSavingTheme(true);
    try {
      await setTheme(newTheme);
      toast.success('Tema atualizado para todos os usuários!');
    } catch (error) {
      toast.error('Erro ao atualizar tema');
    } finally {
      setSavingTheme(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = profileSchema.safeParse({ full_name: fullName });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user?.id);

      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Senha atualizada com sucesso!');
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar senha');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie sua conta e preferências</p>
        </div>

        {/* Notification Settings */}
        <NotificationSettingsCard />

        {/* My Plan - Sellers Only */}
        {!isAdmin && <MyPlanCard />}

        {/* First Admin Signup - Admin Only */}
        {isAdmin && (
          <Card variant="glow" className="border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <ShieldCheck className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-lg">Primeiro Login Admin</CardTitle>
                  <CardDescription>
                    Permite criar conta admin sem precisar de convite (use apenas no deploy inicial)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {allowFirstAdminSignup && (
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-yellow-600 dark:text-yellow-500">
                    <strong>Atenção:</strong> Esta opção está ativada! Desative após configurar o admin.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="first-admin-toggle">Permitir cadastro de admin</Label>
                  <p className="text-xs text-muted-foreground">
                    O primeiro usuário a se cadastrar será automaticamente admin
                  </p>
                </div>
                <Switch
                  id="first-admin-toggle"
                  checked={allowFirstAdminSignup}
                  onCheckedChange={handleToggleFirstAdminSignup}
                  disabled={loadingAdminSetting || savingAdminSetting}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Theme Settings - Admin Only */}
        {isAdmin && (
          <Card variant="glow" className="border-primary/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Palette className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Tema Global</CardTitle>
                  <CardDescription>
                    Altere o tema para todos os usuários do sistema
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleThemeChange(t.id)}
                    disabled={savingTheme}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-300 hover:scale-[1.03] group",
                      theme === t.id
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/30"
                        : "border-border hover:border-primary/50 bg-card hover:bg-card/80"
                    )}
                  >
                    {theme === t.id && (
                      <div className="absolute top-2 right-2 p-1 rounded-full bg-primary animate-pulse">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                    <div 
                      className="w-full h-12 rounded-lg shadow-lg transition-transform group-hover:scale-105"
                      style={{ 
                        background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]}, ${t.colors[2]})` 
                      }}
                    />
                    <span className={cn(
                      "font-medium text-xs text-center",
                      theme === t.id ? "text-primary" : "text-foreground"
                    )}>
                      {t.name}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Escolha um dos 8 temas disponíveis - aplicado em tempo real para todos
              </p>
            </CardContent>
          </Card>
        )}

        {/* Profile Settings */}
        <Card variant="glow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Perfil</CardTitle>
                <CardDescription>Atualize suas informações pessoais</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" value={user?.email || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome / Empresa *</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome ou nome da empresa"
                  disabled={loadingProfile}
                />
                <p className="text-xs text-muted-foreground">
                  Este nome aparecerá nas mensagens de WhatsApp para os clientes
                </p>
              </div>
              <Button type="submit" variant="gradient" disabled={savingProfile || loadingProfile}>
                <Save className="w-4 h-4 mr-2" />
                {savingProfile ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password Settings */}
        <Card variant="glow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Lock className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-lg">Segurança</CardTitle>
                <CardDescription>Altere sua senha de acesso</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Digite novamente"
                />
              </div>
              <Button type="submit" variant="secondary" disabled={savingPassword}>
                <Lock className="w-4 h-4 mr-2" />
                {savingPassword ? 'Atualizando...' : 'Atualizar senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
