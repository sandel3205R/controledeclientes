import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePasswordStrength } from '@/hooks/usePasswordStrength';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { Lock, ShieldAlert, Check } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[a-z]/, 'Senha deve conter letra minúscula')
    .regex(/[A-Z]/, 'Senha deve conter letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter número')
    .regex(/[^a-zA-Z0-9]/, 'Senha deve conter símbolo especial (!@#$%...)'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

interface ForcePasswordUpdateDialogProps {
  open: boolean;
  onPasswordUpdated: () => void;
}

export function ForcePasswordUpdateDialog({ open, onPasswordUpdated }: ForcePasswordUpdateDialogProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { result: passwordCheck, checkPassword, resetCheck } = usePasswordStrength();

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    
    if (newPassword.length >= 4) {
      checkPassword(newPassword);
    } else {
      resetCheck();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    // Check if password is breached
    if (passwordCheck.isBreached) {
      toast.error('Esta senha foi encontrada em vazamentos de dados. Por favor, escolha outra senha.');
      return;
    }

    // Check password strength
    if (passwordCheck.strength.score < 2) {
      toast.error('Senha muito fraca. Por favor, escolha uma senha mais forte.');
      return;
    }

    setLoading(true);
    try {
      // Update password in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;

      // Mark password as updated in profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ needs_password_update: false })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      toast.success('Senha atualizada com sucesso!');
      setPassword('');
      setConfirmPassword('');
      resetCheck();
      onPasswordUpdated();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md [&>button]:hidden" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-destructive/10">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-xl">Atualização de Senha Obrigatória</DialogTitle>
              <DialogDescription>
                Por questões de segurança, você precisa criar uma senha mais forte.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Alert className="border-primary/50 bg-primary/10">
          <Lock className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            <strong>Requisitos da nova senha:</strong>
            <ul className="mt-2 space-y-1">
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3" /> Mínimo 8 caracteres
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3" /> Letra maiúscula (A-Z)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3" /> Letra minúscula (a-z)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3" /> Número (0-9)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3" /> Símbolo especial (!@#$%...)
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Exemplo: <strong>Luana345@</strong>
            </p>
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Digite sua nova senha"
              value={password}
              onChange={handlePasswordChange}
              required
            />
            <PasswordStrengthMeter
              strength={passwordCheck.strength}
              isBreached={passwordCheck.isBreached}
              breachCount={passwordCheck.breachCount}
              isChecking={passwordCheck.isChecking}
              password={password}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirmar Nova Senha</Label>
            <Input
              id="confirm-new-password"
              type="password"
              placeholder="Confirme sua nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            variant="gradient"
            className="w-full"
            disabled={loading || passwordCheck.isChecking}
          >
            <Lock className="w-4 h-4 mr-2" />
            {loading ? 'Atualizando...' : 'Atualizar Senha'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
