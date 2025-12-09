import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';
import { Bell, BellOff, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const DAYS_OPTIONS = [
  { value: 1, label: '1 dia antes' },
  { value: 3, label: '3 dias antes' },
  { value: 7, label: '7 dias antes' },
  { value: 14, label: '14 dias antes' },
  { value: 30, label: '30 dias antes' },
];

interface NotificationPreferences {
  id?: string;
  is_enabled: boolean;
  days_before: number[];
}

export function NotificationSettings() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe, isLoading: pushLoading } = usePushNotifications();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    is_enabled: true,
    days_before: [3]
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const daysBefore = Array.isArray(data.days_before) 
          ? (data.days_before as unknown as number[]).filter(d => typeof d === 'number')
          : [3];
        setPreferences({
          id: data.id,
          is_enabled: data.is_enabled,
          days_before: daysBefore.length > 0 ? daysBefore : [3]
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          is_enabled: preferences.is_enabled,
          days_before: preferences.days_before
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success('Preferências salvas com sucesso!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Erro ao salvar preferências');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setPreferences(prev => {
      const days = prev.days_before.includes(day)
        ? prev.days_before.filter(d => d !== day)
        : [...prev.days_before, day].sort((a, b) => a - b);
      return { ...prev, days_before: days.length > 0 ? days : [3] };
    });
  };

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações de Vencimento
        </CardTitle>
        <CardDescription>
          Configure quando deseja receber alertas sobre clientes com assinatura expirando
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Push Notification Status */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Notificações no Navegador</p>
              <p className="text-sm text-muted-foreground">
                {!isSupported 
                  ? 'Não suportado neste navegador'
                  : permission === 'denied'
                    ? 'Bloqueado - habilite nas configurações do navegador'
                    : isSubscribed 
                      ? 'Ativado - você receberá alertas'
                      : 'Desativado - clique para ativar'
                }
              </p>
            </div>
          </div>
          <Button
            variant={isSubscribed ? 'secondary' : 'default'}
            size="sm"
            onClick={handlePushToggle}
            disabled={pushLoading || !isSupported || permission === 'denied'}
          >
            {pushLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSubscribed ? (
              'Desativar'
            ) : (
              'Ativar'
            )}
          </Button>
        </div>

        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-enabled">Receber Notificações</Label>
            <p className="text-sm text-muted-foreground">
              Ative para receber alertas sobre clientes vencendo
            </p>
          </div>
          <Switch
            id="notifications-enabled"
            checked={preferences.is_enabled}
            onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, is_enabled: checked }))}
          />
        </div>

        {/* Days Selection */}
        <div className="space-y-3">
          <Label>Alertar com antecedência de:</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => toggleDay(option.value)}
                className={`
                  px-3 py-2 rounded-lg border text-sm font-medium transition-all
                  ${preferences.days_before.includes(option.value)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                  }
                `}
                disabled={!preferences.is_enabled}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Selecione um ou mais períodos para receber alertas
          </p>
        </div>

        {/* Selected Summary */}
        {preferences.days_before.length > 0 && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm">
              <span className="font-medium">Você será alertado: </span>
              {preferences.days_before.map((day, index) => (
                <span key={day}>
                  <Badge variant="secondary" className="mx-1">
                    {day} {day === 1 ? 'dia' : 'dias'}
                  </Badge>
                  {index < preferences.days_before.length - 1 && 'e '}
                </span>
              ))}
              antes do vencimento
            </p>
          </div>
        )}

        {/* Save Button */}
        <Button 
          onClick={savePreferences} 
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Preferências
        </Button>
      </CardContent>
    </Card>
  );
}
