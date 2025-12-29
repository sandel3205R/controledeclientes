import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, Save, Send, CheckCircle, XCircle, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNotifications } from './useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const SOUND_ENABLED_KEY = 'expiration_alert_sound_enabled';

const DAYS_OPTIONS = [
  { value: 1, label: '1 dia' },
  { value: 3, label: '3 dias' },
  { value: 7, label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
];

export function NotificationCard() {
  const { user } = useAuth();
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = useNotifications();

  const [preferences, setPreferences] = useState({
    is_enabled: true,
    days_before: [3] as number[],
  });
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem(SOUND_ENABLED_KEY);
    return stored !== 'false'; // Default to true
  });

  // Toggle sound preference
  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
    toast.success(enabled ? 'Som de alerta ativado' : 'Som de alerta desativado');
  };

  // Carregar preferências
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;

      try {
        const { data } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          const daysBefore = Array.isArray(data.days_before)
            ? (data.days_before as number[]).filter(d => typeof d === 'number')
            : [3];

          setPreferences({
            is_enabled: data.is_enabled,
            days_before: daysBefore.length > 0 ? daysBefore : [3],
          });
        }
      } catch (err) {
        console.error('Erro ao carregar preferências:', err);
      } finally {
        setLoadingPrefs(false);
      }
    };

    loadPreferences();
  }, [user]);

  // Salvar preferências
  const savePreferences = async () => {
    if (!user) return;

    setSavingPrefs(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          is_enabled: preferences.is_enabled,
          days_before: preferences.days_before,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Preferências salvas!');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar preferências');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Toggle dia
  const toggleDay = (day: number) => {
    setPreferences(prev => {
      const days = prev.days_before.includes(day)
        ? prev.days_before.filter(d => d !== day)
        : [...prev.days_before, day].sort((a, b) => a - b);
      return { ...prev, days_before: days.length > 0 ? days : [3] };
    });
  };

  // Ativar/Desativar notificações
  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  // Enviar teste
  const handleTest = async () => {
    setSendingTest(true);
    await sendTestNotification();
    setSendingTest(false);
  };

  // Status visual
  const getStatusIcon = () => {
    if (!isSupported) return <XCircle className="h-5 w-5 text-destructive" />;
    if (permission === 'denied') return <XCircle className="h-5 w-5 text-destructive" />;
    if (isSubscribed) return <CheckCircle className="h-5 w-5 text-green-500" />;
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (!isSupported) return 'Não suportado neste navegador';
    if (permission === 'denied') return 'Bloqueado - habilite nas configurações do navegador';
    if (isSubscribed) return 'Ativado - você receberá alertas';
    return 'Desativado - clique em Ativar para receber alertas';
  };

  if (loadingPrefs) {
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
          Notificações Push
        </CardTitle>
        <CardDescription>
          Receba alertas sobre clientes com assinatura expirando
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status e Toggle Principal */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <p className="font-medium">
                {isSubscribed ? 'Notificações Ativas' : 'Notificações Desativadas'}
              </p>
              <p className="text-sm text-muted-foreground">{getStatusText()}</p>
            </div>
          </div>
          <Button
            variant={isSubscribed ? 'secondary' : 'default'}
            onClick={handleToggle}
            disabled={isLoading || !isSupported || permission === 'denied'}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSubscribed ? (
              <>
                <BellOff className="h-4 w-4 mr-2" />
                Desativar
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Ativar
              </>
            )}
          </Button>
        </div>

        {/* Erro */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Botão de Teste */}
        {isSubscribed && (
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={sendingTest}
            className="w-full"
          >
            {sendingTest ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar Notificação de Teste
          </Button>
        )}

        {/* Configurações de Dias */}
        <div className="space-y-4 pt-4 border-t">
          {/* Som de Alerta */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 className="h-5 w-5 text-primary" />
              ) : (
                <VolumeX className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label>Som de Alerta</Label>
                <p className="text-sm text-muted-foreground">
                  Toca um som quando houver vencimentos urgentes
                </p>
              </div>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={handleSoundToggle}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Receber Alertas de Vencimento</Label>
              <p className="text-sm text-muted-foreground">
                Ative para ser notificado sobre clientes vencendo
              </p>
            </div>
            <Switch
              checked={preferences.is_enabled}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, is_enabled: checked }))
              }
            />
          </div>

          <div className="space-y-3">
            <Label>Alertar com antecedência de:</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleDay(option.value)}
                  disabled={!preferences.is_enabled}
                  className={`
                    px-3 py-2 rounded-lg border text-sm font-medium transition-all
                    ${preferences.days_before.includes(option.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'}
                    ${!preferences.is_enabled && 'opacity-50 cursor-not-allowed'}
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {preferences.days_before.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm">
                <span className="font-medium">Você será alertado: </span>
                {preferences.days_before.map((day, i) => (
                  <span key={day}>
                    <Badge variant="secondary" className="mx-1">
                      {day} {day === 1 ? 'dia' : 'dias'}
                    </Badge>
                    {i < preferences.days_before.length - 1 && 'e '}
                  </span>
                ))}
                antes do vencimento
              </p>
            </div>
          )}

          <Button onClick={savePreferences} disabled={savingPrefs} className="w-full">
            {savingPrefs ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Preferências
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}