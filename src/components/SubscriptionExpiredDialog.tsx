import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MessageCircle, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_WHATSAPP = '+5531998518865';
const ADMIN_NAME = 'SANDEL';

export default function SubscriptionExpiredDialog() {
  const { subscription, role, signOut } = useAuth();

  // Don't show for admins or permanent users
  if (role === 'admin' || subscription?.isPermanent || !subscription?.isExpired) {
    return null;
  }

  const handleContactAdmin = () => {
    const phone = ADMIN_WHATSAPP.replace(/\D/g, '');
    const message = `Olá ${ADMIN_NAME}! 👋\n\nMeu período de teste expirou e gostaria de continuar usando o painel.\n\nComo faço para ativar meu plano?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <DialogTitle className="text-xl">Período de Teste Expirado</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Seu período de teste de 3 dias acabou. Entre em contato com o administrador para ativar seu plano e continuar usando o painel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-center text-muted-foreground">
              <Clock className="w-4 h-4 inline mr-1" />
              Contate o administrador para ativar seu plano de 30 dias
            </p>
          </div>

          <Button 
            variant="whatsapp" 
            className="w-full" 
            size="lg"
            onClick={handleContactAdmin}
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Falar com {ADMIN_NAME}
          </Button>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={signOut}
          >
            Sair da Conta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}