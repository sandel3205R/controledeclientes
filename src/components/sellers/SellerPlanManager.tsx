import { useState, useEffect } from 'react';
import { Crown, Zap, Star, Rocket, Check, Infinity } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SellerPlan {
  id: string;
  name: string;
  slug: string;
  max_clients: number | null;
  price_monthly: number;
  is_best_value: boolean;
}

interface SellerPlanManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerId: string;
  sellerName: string;
  currentPlanId: string | null;
  hasUnlimitedClients: boolean;
  clientCount: number;
  onSuccess: () => void;
}

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
    case 'trial': return 'from-gray-400 to-gray-600';
    case 'bronze': return 'from-amber-600 to-amber-800';
    case 'silver': return 'from-slate-400 to-slate-600';
    case 'gold': return 'from-yellow-400 to-yellow-600';
    case 'black': return 'from-gray-800 to-black';
    default: return 'from-primary to-primary/80';
  }
};

export function SellerPlanManager({ 
  open, 
  onOpenChange, 
  sellerId,
  sellerName,
  currentPlanId,
  hasUnlimitedClients,
  clientCount,
  onSuccess
}: SellerPlanManagerProps) {
  const [plans, setPlans] = useState<SellerPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(currentPlanId);
  const [unlimitedClients, setUnlimitedClients] = useState(hasUnlimitedClients);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from('seller_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });
      
      if (data) setPlans(data as SellerPlan[]);
    };

    if (open) {
      fetchPlans();
      setSelectedPlanId(currentPlanId);
      setUnlimitedClients(hasUnlimitedClients);
    }
  }, [open, currentPlanId, hasUnlimitedClients]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          seller_plan_id: selectedPlanId,
          has_unlimited_clients: unlimitedClients
        })
        .eq('id', sellerId);

      if (error) throw error;

      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      toast.success(`Plano ${selectedPlan?.name || ''} aplicado para ${sellerName}!`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Erro ao atualizar plano do vendedor');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const canDowngrade = !selectedPlan?.max_clients || clientCount <= selectedPlan.max_clients;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="w-6 h-6 text-yellow-500" />
            Gerenciar Plano - {sellerName}
          </DialogTitle>
          <DialogDescription className="text-base">
            Altere o plano do vendedor. Clientes atuais: <strong>{clientCount}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Unlimited toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <Infinity className="w-5 h-5 text-primary" />
            <div>
              <Label htmlFor="unlimited" className="font-medium">Clientes Ilimitados</Label>
              <p className="text-sm text-muted-foreground">Ignora o limite do plano</p>
            </div>
          </div>
          <Switch
            id="unlimited"
            checked={unlimitedClients}
            onCheckedChange={setUnlimitedClients}
          />
        </div>

        <div className="grid gap-3 py-2">
          {plans.map((plan) => {
            const Icon = getPlanIcon(plan.slug);
            const gradient = getPlanGradient(plan.slug);
            const isSelected = selectedPlanId === plan.id;
            const wouldExceedLimit = plan.max_clients && clientCount > plan.max_clients && !unlimitedClients;
            
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-xl border-2 p-4 transition-all cursor-pointer",
                  isSelected 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50",
                  wouldExceedLimit && "opacity-50",
                  plan.is_best_value && "ring-2 ring-yellow-500/50"
                )}
                onClick={() => !wouldExceedLimit && setSelectedPlanId(plan.id)}
              >
                {plan.is_best_value && (
                  <Badge className="absolute -top-2.5 left-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-xs">
                    ⭐ Melhor Custo-Benefício
                  </Badge>
                )}

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                      gradient
                    )}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{plan.name}</h3>
                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {plan.max_clients ? `Até ${plan.max_clients.toLocaleString()} clientes` : 'Clientes ilimitados'}
                      </p>
                      {wouldExceedLimit && (
                        <p className="text-xs text-destructive mt-1">
                          Vendedor tem {clientCount} clientes (excede limite)
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-bold">
                      {plan.price_monthly > 0 ? `R$ ${plan.price_monthly.toFixed(2).replace('.', ',')}` : 'Grátis'}
                    </div>
                    {plan.price_monthly > 0 && <div className="text-xs text-muted-foreground">/mês</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!canDowngrade && !unlimitedClients && (
          <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            ⚠️ O vendedor tem mais clientes do que o limite do plano selecionado. 
            Ative "Clientes Ilimitados" ou escolha um plano com limite maior.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant="gradient" 
            className="flex-1"
            disabled={loading || (!canDowngrade && !unlimitedClients)}
            onClick={handleSave}
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
