import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Cloud,
  Tv,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Check,
  Calendar,
  Mail,
  Lock,
  Wifi,
  Hash,
  AlertCircle,
  Phone,
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ClientAppDialog from './ClientAppDialog';
import { useCrypto } from '@/hooks/useCrypto';

interface ClientApp {
  id: string;
  client_id: string;
  app_type: string;
  email: string | null;
  password: string | null;
  mac_address: string | null;
  device_id: string | null;
  app_price: number | null;
  expiration_date: string;
  notes: string | null;
  client_name: string;
  client_phone: string | null;
}

const APP_LABELS: Record<string, { label: string; icon: typeof Cloud; color: string }> = {
  clouddy: { label: 'Clouddy', icon: Cloud, color: 'blue' },
  ibo_pro: { label: 'IBO PRO', icon: Tv, color: 'purple' },
  ibo_player: { label: 'IBO PLAYER', icon: Tv, color: 'pink' },
};

export function ClientAppsManager() {
  const { user } = useAuth();
  const { decryptSingle } = useCrypto();
  const [apps, setApps] = useState<ClientApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<ClientApp | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [decryptedApps, setDecryptedApps] = useState<Record<string, { email: string | null; password: string | null }>>({});
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [clients, setClients] = useState<{ id: string; name: string; phone: string | null }[]>([]);

  const fetchApps = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch apps with client info
      const { data: appsData, error } = await supabase
        .from('client_apps')
        .select('*')
        .eq('seller_id', user.id)
        .order('expiration_date');

      if (error) throw error;

      // Fetch client names
      const clientIds = appsData?.map((a) => a.client_id) || [];
      let clientsMap: Record<string, { name: string; phone: string | null }> = {};

      if (clientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name, phone')
          .in('id', clientIds);

        if (clientsData) {
          clientsMap = clientsData.reduce((acc, c) => {
            acc[c.id] = { name: c.name, phone: c.phone };
            return acc;
          }, {} as Record<string, { name: string; phone: string | null }>);
        }
      }

      const appsWithClients: ClientApp[] = (appsData || []).map((app) => ({
        ...app,
        client_name: clientsMap[app.client_id]?.name || 'Cliente não encontrado',
        client_phone: clientsMap[app.client_id]?.phone || null,
      }));

      // Decrypt credentials
      const decrypted: Record<string, { email: string | null; password: string | null }> = {};
      for (const app of appsWithClients) {
        if (app.app_type === 'clouddy') {
          const email = await decryptSingle(app.email);
          const password = await decryptSingle(app.password);
          decrypted[app.id] = { email, password };
        }
      }
      setDecryptedApps(decrypted);
      setApps(appsWithClients);
    } catch (err) {
      console.error('Error fetching apps:', err);
      toast.error('Erro ao carregar aplicativos');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    if (!user) return;

    // Fetch clients that don't have an app yet
    const { data: existingAppClientIds } = await supabase
      .from('client_apps')
      .select('client_id')
      .eq('seller_id', user.id);

    const excludeIds = existingAppClientIds?.map((a) => a.client_id) || [];

    let query = supabase
      .from('clients')
      .select('id, name, phone')
      .eq('seller_id', user.id)
      .order('name');

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data } = await query;
    setClients(data || []);
  };

  useEffect(() => {
    fetchApps();
    fetchClients();
  }, [user]);

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from('client_apps').delete().eq('id', deleteId);

    if (error) {
      toast.error('Erro ao excluir aplicativo');
    } else {
      toast.success('Aplicativo excluído');
      fetchApps();
      fetchClients();
    }
    setDeleteId(null);
  };

  const copyToClipboard = async (text: string, label: string, appId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(`${appId}-${label}`);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatus = (expDate: string) => {
    const date = new Date(expDate);
    const daysUntil = differenceInDays(date, new Date());

    if (isPast(date)) return { label: 'Vencido', class: 'status-expired', icon: '🔴' };
    if (daysUntil <= 30) return { label: 'Vencendo', class: 'status-expiring', icon: '🟡' };
    return { label: 'Ativo', class: 'status-active', icon: '🟢' };
  };

  const sendWhatsApp = (app: ClientApp, type: 'reminder' | 'credentials') => {
    if (!app.client_phone) return;
    const phone = app.client_phone.replace(/\D/g, '');
    const formattedDate = format(new Date(app.expiration_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const appInfo = APP_LABELS[app.app_type];
    
    let message = '';
    if (type === 'reminder') {
      message = `Olá ${app.client_name}! 👋\n\nLembramos que seu aplicativo *${appInfo.label}* vence em *${formattedDate}*.\n\nDeseja renovar? Entre em contato!\n\n🎬 *SanPlay*`;
    } else {
      if (app.app_type === 'clouddy') {
        const creds = decryptedApps[app.id];
        message = `Olá ${app.client_name}! 🎉\n\nSeus dados do *${appInfo.label}*:\n\n📧 Email: ${creds?.email || 'N/A'}\n🔑 Senha: ${creds?.password || 'N/A'}\n\n📅 Válido até: *${formattedDate}*\n\n🎬 *SanPlay*`;
      } else {
        message = `Olá ${app.client_name}! 🎉\n\nSeus dados do *${appInfo.label}*:\n\n📺 MAC: ${app.mac_address || 'N/A'}\n🆔 ID: ${app.device_id || 'N/A'}\n\n📅 Válido até: *${formattedDate}*\n\n🎬 *SanPlay*`;
      }
    }

    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const filteredApps = apps.filter((app) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      app.client_name.toLowerCase().includes(searchLower) ||
      APP_LABELS[app.app_type]?.label.toLowerCase().includes(searchLower)
    );
  });

  const handleAddAppForClient = (clientId: string, clientName: string) => {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName);
    setEditingApp(null);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Aplicativos</h3>
          <Badge variant="secondary">{apps.length}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-48"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar App
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-64 overflow-y-auto">
              {clients.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  Todos os clientes já possuem app
                </div>
              ) : (
                clients.map((client) => (
                  <DropdownMenuItem
                    key={client.id}
                    onClick={() => handleAddAppForClient(client.id, client.name)}
                  >
                    {client.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Apps Grid */}
      {filteredApps.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum aplicativo cadastrado
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredApps.map((app) => {
            const appInfo = APP_LABELS[app.app_type] || { label: app.app_type, icon: Tv, color: 'gray' };
            const Icon = appInfo.icon;
            const status = getStatus(app.expiration_date);
            const creds = decryptedApps[app.id];

            return (
              <Card key={app.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{app.client_name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          className={cn(
                            'text-[10px] px-1.5 py-0 gap-1',
                            appInfo.color === 'blue' && 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                            appInfo.color === 'purple' && 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                            appInfo.color === 'pink' && 'bg-pink-500/20 text-pink-400 border-pink-500/30'
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {appInfo.label}
                        </Badge>
                        <Badge className={cn('text-[10px] px-1.5 py-0', status.class)}>
                          {status.icon} {status.label}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedClientId(app.client_id);
                            setSelectedClientName(app.client_name);
                            setEditingApp(app);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {app.client_phone && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => sendWhatsApp(app, 'reminder')}>
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Lembrar Vencimento
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sendWhatsApp(app, 'credentials')}>
                              <Phone className="h-4 w-4 mr-2" />
                              Enviar Credenciais
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(app.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Credentials */}
                  {app.app_type === 'clouddy' ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-blue-400" />
                        <span className="truncate flex-1">{creds?.email || 'N/A'}</span>
                        {creds?.email && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(creds.email!, 'Email', app.id)}
                          >
                            {copiedId === `${app.id}-Email` ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-blue-400" />
                        <span className="truncate flex-1">{creds?.password || 'N/A'}</span>
                        {creds?.password && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(creds.password!, 'Senha', app.id)}
                          >
                            {copiedId === `${app.id}-Senha` ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-3.5 w-3.5 text-purple-400" />
                        <span className="truncate flex-1">{app.mac_address || 'N/A'}</span>
                        {app.mac_address && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(app.mac_address!, 'MAC', app.id)}
                          >
                            {copiedId === `${app.id}-MAC` ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash className="h-3.5 w-3.5 text-purple-400" />
                        <span className="truncate flex-1">{app.device_id || 'N/A'}</span>
                        {app.device_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(app.device_id!, 'ID', app.id)}
                          >
                            {copiedId === `${app.id}-ID` ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/30 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(app.expiration_date), 'dd/MM/yyyy')}
                    </div>
                    {app.app_price && (
                      <span className="text-primary font-medium">
                        R$ {app.app_price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      {selectedClientId && (
        <ClientAppDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedClientId(null);
              setSelectedClientName('');
              setEditingApp(null);
            }
          }}
          clientId={selectedClientId}
          clientName={selectedClientName}
          existingApp={editingApp}
          onSuccess={() => {
            fetchApps();
            fetchClients();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aplicativo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O aplicativo será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
