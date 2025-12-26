import { useState } from "react";
import { usePushSubscription } from "./usePushSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Send,
  Bell,
  BellOff,
  Smartphone,
  Server,
  Key,
  Database,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface DiagnosticItemProps {
  label: string;
  status: "ok" | "error" | "warning" | "loading" | "unknown";
  detail?: string;
  icon: React.ReactNode;
}

function DiagnosticItem({ label, status, detail, icon }: DiagnosticItemProps) {
  const statusIcons = {
    ok: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    error: <XCircle className="h-4 w-4 text-destructive" />,
    warning: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    loading: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
    unknown: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
  };

  const statusColors = {
    ok: "bg-green-500/10 border-green-500/30 text-green-600",
    error: "bg-destructive/10 border-destructive/30 text-destructive",
    warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-600",
    loading: "bg-muted border-border text-muted-foreground",
    unknown: "bg-muted border-border text-muted-foreground",
  };

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border", statusColors[status])}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {statusIcons[status]}
        </div>
        {detail && <p className="text-xs opacity-80 truncate">{detail}</p>}
      </div>
    </div>
  );
}

export function PushDiagnosticPanel() {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    lastError,
    diagnostics,
    refreshSubscription,
  } = usePushSubscription();

  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    step: string;
    success: boolean;
    message: string;
  }[]>([]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResults([]);

    const addResult = (step: string, success: boolean, message: string) => {
      setTestResults((prev) => [...prev, { step, success, message }]);
    };

    try {
      // Step 1: Check service worker
      addResult("Service Worker", true, "Verificando...");
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) {
        addResult("Service Worker", false, "Não registrado!");
        return;
      }
      addResult("Service Worker", true, `Ativo: ${reg.active?.state || "aguardando"}`);

      // Step 2: Check subscription
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        addResult("Subscription", false, "Não inscrito. Ative as notificações primeiro.");
        return;
      }
      addResult("Subscription", true, `Endpoint: ...${sub.endpoint.slice(-30)}`);

      // Step 3: Send test notification
      addResult("Envio", true, "Enviando para o servidor...");
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        addResult("Autenticação", false, "Não autenticado");
        return;
      }

      const { data, error } = await supabase.functions.invoke("test-push-notification", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        const serverMsg = (data as any)?.error || error.message;
        addResult("Servidor", false, serverMsg);
        return;
      }

      addResult("Servidor", true, (data as any)?.message || "Notificação enviada!");
      addResult("Resultado", true, "✅ Verifique a notificação no seu dispositivo!");
      
      toast.success("Notificação de teste enviada!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addResult("Erro", false, msg);
      toast.error(msg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleRefresh = async () => {
    await refreshSubscription();
    toast.success("Diagnóstico atualizado");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Diagnóstico de Notificações Push
            </CardTitle>
            <CardDescription>
              Verifique se as notificações estão configuradas corretamente
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Summary */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
          <div className="flex-shrink-0">
            {isSubscribed ? (
              <Bell className="h-8 w-8 text-green-500" />
            ) : (
              <BellOff className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold">
              {isSubscribed ? "Notificações Ativas" : "Notificações Inativas"}
            </h4>
            <p className="text-sm text-muted-foreground">
              {isSubscribed
                ? "Você receberá alertas de vencimento"
                : "Ative para receber alertas no navegador"}
            </p>
          </div>
          <Button
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={isLoading || !isSupported || permission === "denied"}
            variant={isSubscribed ? "secondary" : "default"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : isSubscribed ? (
              "Desativar"
            ) : (
              "Ativar"
            )}
          </Button>
        </div>

        {/* Diagnostic Items */}
        <div className="grid gap-3">
          <DiagnosticItem
            icon={<Wifi className="h-4 w-4" />}
            label="Navegador Suportado"
            status={isSupported ? "ok" : "error"}
            detail={isSupported ? "Push API disponível" : "Navegador não suporta push"}
          />

          <DiagnosticItem
            icon={<Bell className="h-4 w-4" />}
            label="Permissão"
            status={
              permission === "granted"
                ? "ok"
                : permission === "denied"
                  ? "error"
                  : "warning"
            }
            detail={
              permission === "granted"
                ? "Permissão concedida"
                : permission === "denied"
                  ? "Bloqueado - vá em configurações do navegador"
                  : "Aguardando permissão"
            }
          />

          <DiagnosticItem
            icon={<Server className="h-4 w-4" />}
            label="Service Worker"
            status={
              diagnostics?.serviceWorkerState === "activated"
                ? "ok"
                : diagnostics?.serviceWorkerState === "none"
                  ? "error"
                  : "warning"
            }
            detail={`Estado: ${diagnostics?.serviceWorkerState || "desconhecido"} | Scope: ${diagnostics?.serviceWorkerScope || "n/a"}`}
          />

          <DiagnosticItem
            icon={<Key className="h-4 w-4" />}
            label="VAPID Key"
            status={diagnostics?.vapidKeyOk ? "ok" : "error"}
            detail={diagnostics?.vapidKeyOk ? "Chave configurada" : "Chave não encontrada"}
          />

          <DiagnosticItem
            icon={<Smartphone className="h-4 w-4" />}
            label="Subscription"
            status={diagnostics?.subscriptionEndpoint ? "ok" : "warning"}
            detail={
              diagnostics?.subscriptionEndpoint
                ? `...${diagnostics.subscriptionEndpoint.slice(-40)}`
                : "Não inscrito"
            }
          />

          <DiagnosticItem
            icon={<Database className="h-4 w-4" />}
            label="Banco de Dados"
            status={diagnostics?.dbSubscriptionExists ? "ok" : "warning"}
            detail={
              diagnostics?.dbSubscriptionExists
                ? "Subscription salva"
                : "Subscription não encontrada no DB"
            }
          />
        </div>

        {/* Last Error */}
        {lastError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-sm font-medium text-destructive">Último erro:</p>
            <p className="text-xs text-destructive/80 break-all">{lastError}</p>
          </div>
        )}

        <Separator />

        {/* Test Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Teste de Notificação</h4>
              <p className="text-sm text-muted-foreground">
                Envia uma notificação de teste para verificar se está funcionando
              </p>
            </div>
            <Button
              onClick={handleTest}
              disabled={isTesting || !isSubscribed}
              variant="outline"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Teste
            </Button>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium mb-2">Resultado do teste:</p>
              {testResults.map((result, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <span className="font-medium">{result.step}:</span>
                  <span className="text-muted-foreground truncate">{result.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="p-4 rounded-lg bg-muted/30 border">
          <h4 className="font-medium mb-2">Dicas de Solução</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>iOS:</strong> Instale o app na tela inicial primeiro (PWA)</li>
            <li>• <strong>Android:</strong> Verifique se notificações estão permitidas nas configurações</li>
            <li>• <strong>Permissão bloqueada:</strong> Acesse configurações do navegador → Site → Notificações → Permitir</li>
            <li>• <strong>Não funciona:</strong> Desative e ative as notificações novamente</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
