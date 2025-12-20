import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, User, ArrowRight, Sparkles, Phone, LogOut, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';

const authSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
  whatsapp: z.string().min(10, 'WhatsApp é obrigatório para renovação').optional(),
});

// Format phone number as +55 31 95555-5555
const formatWhatsApp = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  
  let formatted = '+';
  
  if (digits.length <= 2) {
    formatted += digits;
  } else if (digits.length <= 4) {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2)}`;
  } else if (digits.length <= 9) {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  } else {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }
  
  return formatted;
};

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [allowFirstAdmin, setAllowFirstAdmin] = useState(false);
  const [checkingFirstAdmin, setCheckingFirstAdmin] = useState(true);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // Check if first admin signup is allowed
  useEffect(() => {
    const checkFirstAdminSetting = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'allow_first_admin_signup')
          .maybeSingle();
        
        setAllowFirstAdmin(data?.value === 'true');
      } catch (error) {
        console.error('Error checking first admin setting:', error);
      } finally {
        setCheckingFirstAdmin(false);
      }
    };
    
    checkFirstAdminSetting();
  }, []);

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsApp(e.target.value);
    setWhatsapp(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = authSchema.safeParse({
        email,
        password,
        fullName: isLogin ? undefined : fullName,
        whatsapp: isLogin ? undefined : whatsapp,
      });

      // Additional validation for signup
      if (!isLogin && (!whatsapp || whatsapp.replace(/\D/g, '').length < 10)) {
        toast.error('WhatsApp é obrigatório para renovação do plano');
        setLoading(false);
        return;
      }

      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('E-mail ou senha incorretos');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Login realizado com sucesso!');
          navigate('/dashboard');
        }
      } else {
        const { error } = await signUp(email, password, fullName, whatsapp || undefined);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast.error('Este e-mail já está cadastrado');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('🎉 Conta criada! Você ganhou 3 dias de teste grátis!', {
            duration: 5000,
          });
          navigate('/dashboard');
        }
      }
    } catch {
      toast.error('Ocorreu um erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white mb-4 overflow-hidden">
            <img src="/logo.jpg" alt="Logo" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Controle de Clientes</h1>
          <p className="text-muted-foreground mt-2">Gestão inteligente de revendas</p>
        </div>

        {/* First Admin Signup Alert */}
        {allowFirstAdmin && !isLogin && !checkingFirstAdmin && (
          <Alert className="mb-4 border-primary/50 bg-primary/10">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary">
              <strong>Modo Admin Ativo:</strong> O primeiro usuário cadastrado será automaticamente administrador.
            </AlertDescription>
          </Alert>
        )}

        <Card variant="gradient" className="animate-slide-up">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {isLogin ? 'Bem-vindo de volta' : (allowFirstAdmin ? 'Criar conta Admin' : 'Criar conta')}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? 'Entre com suas credenciais'
                : (
                  <span className="flex flex-col gap-1">
                    <span>Preencha os dados para criar sua conta</span>
                    {!allowFirstAdmin && (
                      <span className="text-green-600 dark:text-green-400 font-medium">🎁 Ganhe 3 dias de teste grátis!</span>
                    )}
                  </span>
                )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium">
                      Nome completo
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Seu nome"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        required={!isLogin}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="text-sm font-medium">
                      WhatsApp <span className="text-destructive">*</span>
                      <span className="text-muted-foreground text-xs ml-1">(obrigatório para renovação)</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="whatsapp"
                        type="text"
                        placeholder="+55 31 95555-5555"
                        value={whatsapp}
                        onChange={handleWhatsAppChange}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Processando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {isLogin ? 'Entrar' : 'Criar conta'}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin ? (
                  <>
                    Não tem conta?{' '}
                    <span className="text-green-600 dark:text-green-400 font-medium">Cadastre-se</span>
                  </>
                ) : (
                  <>
                    Já tem conta?{' '}
                    <span className="text-green-600 dark:text-green-400 font-medium">Faça login</span>
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    localStorage.clear();
                    sessionStorage.clear();
                    toast.success('Sessão limpa com sucesso!');
                    window.location.reload();
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 mx-auto"
                >
                  <LogOut className="w-3 h-3" />
                  Limpar sessão corrompida
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
