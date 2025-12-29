import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Crown, AlertTriangle, CheckCircle, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ADMIN_WHATSAPP = '+5531998518865';

export function SubscriptionCountdown() {
  const { subscription, role, loading, user } = useAuth();

  // Don't show for admins
  if (role === 'admin') return null;

  // Loading state - show while auth is loading OR subscription hasn't loaded yet
  if (loading || !subscription) {
    return (
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-center h-16">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const { isPermanent, isExpired, daysRemaining, hoursRemaining } = subscription;

  const handleRequestRenewal = () => {
    const phone = ADMIN_WHATSAPP.replace(/\D/g, '');
    const userEmail = user?.email || 'não informado';
    
    let message = '';
    if (isExpired) {
      message = `Olá! 👋

Meu plano expirou e gostaria de renovar meu acesso ao painel.

📧 Meu e-mail: ${userEmail}

Por favor, me envie as opções de planos disponíveis.

Obrigado!`;
    } else {
      message = `Olá! 👋

Gostaria de renovar meu plano antes do vencimento.

📧 Meu e-mail: ${userEmail}
⏰ Dias restantes: ${daysRemaining}

Por favor, me envie as opções de renovação.

Obrigado!`;
    }
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Permanent user
  if (isPermanent) {
    return (
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-yellow-500/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">Acesso Permanente</h3>
                <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                  ∞ Ilimitado
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Você tem acesso completo ao sistema sem limite de tempo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Expired
  if (isExpired) {
    return (
      <Card className="border-destructive/50 bg-gradient-to-r from-destructive/10 to-destructive/5">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 rounded-xl bg-gradient-to-br from-destructive to-destructive/80 shadow-lg animate-pulse">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-destructive">Período Expirado</h3>
                  <Badge variant="destructive">Inativo</Badge>
                </div>
                <p className="text-sm text-destructive/80">
                  Seu período de acesso expirou. Renove agora!
                </p>
              </div>
            </div>
            <Button 
              variant="whatsapp" 
              size="sm"
              onClick={handleRequestRenewal}
              className="w-full sm:w-auto"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Renovar Agora
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active with countdown
  const totalTrialDays = 5; // Trial period is 5 days
  const progressPercentage = daysRemaining !== null 
    ? Math.min(100, Math.max(0, (daysRemaining / totalTrialDays) * 100))
    : 100;

  const isUrgent = daysRemaining !== null && daysRemaining <= 2;
  const isWarning = daysRemaining !== null && daysRemaining <= 5;

  const getStatusColor = () => {
    if (isUrgent) return 'from-destructive/10 to-orange-500/10 border-destructive/30';
    if (isWarning) return 'from-yellow-500/10 to-orange-500/10 border-yellow-500/30';
    return 'from-green-500/10 to-primary/10 border-green-500/30';
  };

  const getIconGradient = () => {
    if (isUrgent) return 'from-destructive to-orange-500';
    if (isWarning) return 'from-yellow-500 to-orange-500';
    return 'from-green-500 to-primary';
  };

  const getProgressColor = () => {
    if (isUrgent) return '[&>div]:bg-destructive';
    if (isWarning) return '[&>div]:bg-yellow-500';
    return '[&>div]:bg-green-500';
  };

  return (
    <Card className={cn("bg-gradient-to-r", getStatusColor())}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 w-full">
            <div className={cn("p-3 rounded-xl bg-gradient-to-br shadow-lg shrink-0", getIconGradient())}>
              {isUrgent ? (
                <AlertTriangle className="w-6 h-6 text-white" />
              ) : daysRemaining !== null && daysRemaining > 10 ? (
                <CheckCircle className="w-6 h-6 text-white" />
              ) : (
                <Clock className="w-6 h-6 text-white" />
              )}
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg">
                    {daysRemaining !== null ? (
                      daysRemaining === 0 ? (
                        hoursRemaining !== null && hoursRemaining > 0 ? (
                          `${hoursRemaining}h restantes`
                        ) : (
                          'Expira hoje!'
                        )
                      ) : daysRemaining === 1 ? (
                        '1 dia restante'
                      ) : (
                        `${daysRemaining} dias restantes`
                      )
                    ) : (
                      'Acesso ativo'
                    )}
                  </h3>
                  {isUrgent && (
                    <Badge variant="destructive" className="animate-pulse">
                      Urgente!
                    </Badge>
                  )}
                  {!isUrgent && isWarning && (
                    <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                      Atenção
                    </Badge>
                  )}
                </div>
                {daysRemaining !== null && (
                  <span className="text-sm font-medium text-muted-foreground shrink-0">
                    {Math.round(progressPercentage)}%
                  </span>
                )}
              </div>
              {daysRemaining !== null && (
                <Progress 
                  value={progressPercentage} 
                  className={cn("h-2", getProgressColor())}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {isUrgent 
                  ? 'Renove agora para não perder o acesso!' 
                  : isWarning 
                    ? 'Seu período de acesso está acabando' 
                    : 'Aproveite seu acesso ao sistema'}
              </p>
            </div>
          </div>
          
          {/* Show renewal button when warning or urgent */}
          {isWarning && (
            <Button 
              variant="whatsapp" 
              size="sm"
              onClick={handleRequestRenewal}
              className="w-full sm:w-auto shrink-0"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Renovar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}