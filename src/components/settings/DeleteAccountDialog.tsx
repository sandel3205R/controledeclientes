import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DeleteAccountDialogProps {
  userEmail: string;
}

export function DeleteAccountDialog({ userEmail }: DeleteAccountDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (confirmText !== 'EXCLUIR') {
      toast.error('Digite EXCLUIR para confirmar');
      return;
    }

    setIsDeleting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.');
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('delete-seller-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao excluir conta');
      }

      toast.success('Conta excluída com sucesso. Você será desconectado.');
      
      // Sign out and redirect
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      
      setTimeout(() => {
        navigate('/auth');
      }, 1500);

    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Erro ao excluir conta. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full sm:w-auto">
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir minha conta
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Excluir conta permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  <strong>ATENÇÃO:</strong> Esta ação é irreversível e você não poderá criar uma nova conta com o e-mail <strong>{userEmail}</strong>.
                </AlertDescription>
              </Alert>
              
              <div className="text-sm space-y-2">
                <p>Ao excluir sua conta:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Todos os seus clientes serão excluídos</li>
                  <li>Todos os seus servidores serão excluídos</li>
                  <li>Todos os templates e configurações serão perdidos</li>
                  <li>O e-mail será bloqueado permanentemente</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-delete">
                  Digite <strong className="text-destructive">EXCLUIR</strong> para confirmar:
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Digite EXCLUIR"
                  className="uppercase"
                  disabled={isDeleting}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={confirmText !== 'EXCLUIR' || isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir permanentemente
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
