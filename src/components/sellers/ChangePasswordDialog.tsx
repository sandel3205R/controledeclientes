import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Key, Eye, EyeOff, Shield } from 'lucide-react';

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirme a senha'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type PasswordForm = z.infer<typeof passwordSchema>;

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  onSuccess?: () => void;
}

export function ChangePasswordDialog({ open, onOpenChange, seller, onSuccess }: ChangePasswordDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: PasswordForm) => {
    if (!seller) return;

    setSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('change-seller-password', {
        body: {
          seller_id: seller.id,
          new_password: data.newPassword,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      toast.success('Senha alterada com sucesso!');
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao alterar senha';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Alterar Senha
          </DialogTitle>
          <DialogDescription>
            Alterar senha do vendedor: <strong>{seller?.full_name || seller?.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite a nova senha"
                className="pl-10 pr-10"
                {...form.register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.formState.errors.newPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirme a nova senha"
                className="pl-10 pr-10"
                {...form.register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
