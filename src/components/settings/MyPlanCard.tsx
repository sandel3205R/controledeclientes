import { useState, useEffect } from 'react';
import { Crown, Zap, Star, Rocket, Users, MessageCircle, Check, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useSellerPlan, SellerPlan } from '@/hooks/useSellerPlan';

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
    case 'trial': return 'from-gray-400 to-gray-600';
    case 'bronze': return 'from-amber-600 to-amber-800';
    case 'silver': return 'from-slate-400 to-slate-600';
    case 'gold': return 'from-yellow-400 to-yellow-600';
    case 'black': return 'from-gray-800 to-black';
    default: return 'from-primary to-primary/80';
  }
};

export function MyPlanCard() {
  const { currentPlan, allPlans, clientCount, hasUnlimitedClients, remainingClients, loading } = useSellerPlan();
  const [selectedUpgrade, setSelectedUpgrade] = useState<SellerPlan | null>(null);

  if (loading) {
    return (
      <Card variant="glow" className="border-primary/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const usagePercentage = currentPlan?.max_clients 
    ? Math.min(100, (clientCount / currentPlan.max_clients) * 100)
    : 0;

  const upgradePlans = allPlans.filter(plan => {
    if (plan.slug === 'trial') return false;
    if (!currentPlan) return true;
    return plan.price_monthly > currentPlan.price_monthly;
  });

  const handleRequestUpgrade = (plan: SellerPlan) => {
    const message = `Olá ${ADMIN_NAME}! 👋

Gostaria de alterar meu plano para *${plan.name}*!

📊 Meu plano atual: ${currentPlan?.name || 'Teste'}
📈 Plano desejado: ${plan.name}
💰 Valor: R$ ${plan.price_monthly.toFixed(2).replace('.', ',')}/mês
👥 Limite de clientes: ${plan.max_clients ? plan.max_clients : 'Ilimitado'}

Atualmente tenho ${clientCount} clientes cadastrados.

Aguardo instruções para pagamento!`;

    const phone = ADMIN_WHATSAPP.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const Icon = currentPlan ? getPlanIcon(currentPlan.slug) : Star;
  const gradient = currentPlan ? getPlanGradient(currentPlan.slug) : 'from-gray-400 to-gray-600';

  return (
    <Card variant="glow" className="border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg bg-gradient-to-br",
            gradient
          )}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Meu Plano</CardTitle>
            <CardDescription>Gerencie seu plano e limite de clientes</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan Info */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                gradient
              )}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{currentPlan?.name || 'Teste'}</h3>
                <p className="text-sm text-muted-foreground">
                  {currentPlan?.price_monthly 
                    ? `R$ ${currentPlan.price_monthly.toFixed(2).replace('.', ',')}/mês`
                    : 'Gratuito'}
                </p>
              </div>
            </div>
            {hasUnlimitedClients && (
              <Badge className="bg-primary/20 text-primary">
                ∞ Ilimitado
              </Badge>
            )}
          </div>

          {/* Usage Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>Clientes cadastrados</span>
              </div>
              <span className="font-medium">
                {clientCount} / {hasUnlimitedClients || !currentPlan?.max_clients ? '∞' : currentPlan.max_clients}
              </span>
            </div>
            {currentPlan?.max_clients && !hasUnlimitedClients && (
              <Progress 
                value={usagePercentage} 
                className={cn(
                  "h-2",
                  usagePercentage >= 90 ? "[&>div]:bg-destructive" : 
                  usagePercentage >= 70 ? "[&>div]:bg-yellow-500" : ""
                )}
              />
            )}
            {remainingClients !== null && (
              <p className={cn(
                "text-xs",
                remainingClients <= 5 ? "text-destructive" : "text-muted-foreground"
              )}>
                {remainingClients > 0 
                  ? `${remainingClients} vagas restantes`
                  : 'Limite atingido! Faça upgrade para continuar cadastrando.'}
              </p>
            )}
          </div>
        </div>

        {/* Upgrade Options */}
        {upgradePlans.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h4 className="font-semibold">Fazer Upgrade</h4>
            </div>
            
            <div className="grid gap-3">
              {upgradePlans.map((plan) => {
                const PlanIcon = getPlanIcon(plan.slug);
                const planGradient = getPlanGradient(plan.slug);
                
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative rounded-xl border-2 p-4 transition-all cursor-pointer",
                      selectedUpgrade?.id === plan.id 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50",
                      plan.is_best_value && "ring-2 ring-yellow-500/50"
                    )}
                    onClick={() => setSelectedUpgrade(plan)}
                  >
                    {plan.is_best_value && (
                      <Badge className="absolute -top-2.5 left-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-xs">
                        ⭐ Melhor Custo-Benefício
                      </Badge>
                    )}

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br",
                          planGradient
                        )}>
                          <PlanIcon className="w-5 h-5 text-white" />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-semibold">{plan.name}</h5>
                            {selectedUpgrade?.id === plan.id && (
                              <Check className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {plan.max_clients ? `Até ${plan.max_clients.toLocaleString()} clientes` : 'Clientes ilimitados'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold">
                          R$ {plan.price_monthly.toFixed(2).replace('.', ',')}
                        </div>
                        <div className="text-xs text-muted-foreground">/mês</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button 
              variant="whatsapp" 
              className="w-full"
              disabled={!selectedUpgrade}
              onClick={() => selectedUpgrade && handleRequestUpgrade(selectedUpgrade)}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Solicitar Upgrade via WhatsApp
            </Button>
          </div>
        )}

        {upgradePlans.length === 0 && currentPlan?.slug === 'black' && (
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="font-medium">Você está no plano máximo!</p>
            <p className="text-sm text-muted-foreground">Aproveite clientes ilimitados.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
