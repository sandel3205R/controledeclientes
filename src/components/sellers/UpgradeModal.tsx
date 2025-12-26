import { useState } from 'react';
import { Crown, Zap, Star, Rocket, Check, MessageCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SellerPlan } from '@/hooks/useSellerPlan';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: SellerPlan | null;
  allPlans: SellerPlan[];
  clientCount: number;
}

const ADMIN_WHATSAPP = '5531999999999'; // Configure admin WhatsApp
const ADMIN_NAME = 'SANDEL';

const getPlanIcon = (slug: string) => {
  switch (slug) {
    case 'bronze': return Star;
    case 'silver': return Zap;
    case 'gold': return Crown;
    case 'black': return Rocket;
    default: return Star;
  }
};

const getPlanGradient = (slug: string) => {
  switch (slug) {
    case 'bronze': return 'from-amber-600 to-amber-800';
    case 'silver': return 'from-slate-400 to-slate-600';
    case 'gold': return 'from-yellow-400 to-yellow-600';
    case 'black': return 'from-gray-800 to-black';
    default: return 'from-primary to-primary/80';
  }
};

export function UpgradeModal({ 
  open, 
  onOpenChange, 
  currentPlan, 
  allPlans,
  clientCount 
}: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<SellerPlan | null>(null);

  // Filter out trial and current plan, show only upgrades
  const upgradePlans = allPlans.filter(plan => {
    if (plan.slug === 'trial') return false;
    if (!currentPlan) return true;
    return plan.price_monthly > currentPlan.price_monthly;
  });

  const handleUpgrade = (plan: SellerPlan) => {
    const message = `Olá ${ADMIN_NAME}! 👋

Gostaria de fazer upgrade do meu plano para *${plan.name}*!

📊 Meu plano atual: ${currentPlan?.name || 'Teste'}
📈 Plano desejado: ${plan.name}
💰 Valor: R$ ${plan.price_monthly.toFixed(2).replace('.', ',')}/mês
👥 Limite de clientes: ${plan.max_clients ? plan.max_clients : 'Ilimitado'}

Atualmente tenho ${clientCount} clientes cadastrados.

Aguardo instruções para pagamento!`;

    const phone = ADMIN_WHATSAPP.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="w-6 h-6 text-yellow-500" />
            Limite de Clientes Atingido!
          </DialogTitle>
          <DialogDescription className="text-base">
            Você atingiu o limite de <strong>{currentPlan?.max_clients || 0} clientes</strong> do plano {currentPlan?.name || 'atual'}. 
            Faça upgrade para continuar cadastrando!
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {upgradePlans.map((plan) => {
            const Icon = getPlanIcon(plan.slug);
            const gradient = getPlanGradient(plan.slug);
            
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-xl border-2 p-5 transition-all cursor-pointer",
                  selectedPlan?.id === plan.id 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50",
                  plan.is_best_value && "ring-2 ring-yellow-500/50"
                )}
                onClick={() => setSelectedPlan(plan)}
              >
                {plan.is_best_value && (
                  <Badge className="absolute -top-3 left-4 bg-gradient-to-r from-yellow-500 to-orange-500">
                    ⭐ Melhor Custo-Benefício
                  </Badge>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br",
                      gradient
                    )}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      <p className="text-muted-foreground">
                        {plan.max_clients ? `Até ${plan.max_clients.toLocaleString()} clientes` : 'Clientes ilimitados'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      R$ {plan.price_monthly.toFixed(2).replace('.', ',')}
                    </div>
                    <div className="text-sm text-muted-foreground">/mês</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Check className="w-3 h-3" /> Suporte prioritário
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Check className="w-3 h-3" /> Backup automático
                  </Badge>
                  {plan.slug === 'black' && (
                    <Badge variant="outline" className="gap-1">
                      <Check className="w-3 h-3" /> API personalizada
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant="whatsapp" 
            className="flex-1"
            disabled={!selectedPlan}
            onClick={() => selectedPlan && handleUpgrade(selectedPlan)}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Solicitar Upgrade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
