import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAccountCategories } from '@/hooks/useAccountCategories';
import { useCrypto } from '@/hooks/useCrypto';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import ClientCard from '@/components/clients/ClientCard';
import ClientDialog from '@/components/clients/ClientDialog';
import BulkMessageDialog from '@/components/clients/BulkMessageDialog';
import BulkImportDialog from '@/components/clients/BulkImportDialog';
import { SharedPanelsManager } from '@/components/shared-panels/SharedPanelsManager';
import { ClientAppsManager } from '@/components/apps/ClientAppsManager';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Filter, Send, Server, Trash2, X, CheckSquare, FileText, DollarSign, AlertCircle, Eye, EyeOff, Users, ChevronDown, Tv, Radio, Cloud, Crown, Terminal, Tag } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { differenceInDays, isPast, differenceInMinutes } from 'date-fns';

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

interface Client {
  id: string;
  name: string;
  phone: string | null;
  telegram: string | null;
  device: string | null;
  login: string | null;
  password: string | null;
  login2: string | null;
  password2: string | null;
  login3: string | null;
  password3: string | null;
  login4: string | null;
  password4: string | null;
  login5: string | null;
  password5: string | null;
  expiration_date: string;
  plan_name: string | null;
  plan_price: number | null;
  app_name: string | null;
  mac_address: string | null;
  server_name: string | null;
  server_id: string | null;
  server_ids: string[] | null;
  created_at: string | null;
  is_paid: boolean | null;
  shared_slot_type: string | null;
  shared_panel_id: string | null;
  account_type: string | null;
}

interface ServerOption {
  id: string;
  name: string;
}

type StatusFilter = 'all' | 'active' | 'expiring' | 'expired';
type PaymentFilter = 'all' | 'paid' | 'unpaid';
type SortOption = 'name' | 'expiration' | 'price';

interface WhatsAppTemplate {
  id: string;
  type: string;
  name: string;
  message: string;
  is_default: boolean;
}

export default function Clients() {
  const { user } = useAuth();
  const { allCategories } = useAccountCategories();
  const { decryptCredentials } = useCrypto();
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const status = searchParams.get('status');
    if (status === 'active' || status === 'expiring' || status === 'expired') {
      return status;
    }
    return 'all';
  });
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [serverFilter, setServerFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('all');
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [sellerName, setSellerName] = useState('');
  const [panelsOpen, setPanelsOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [valuesHidden, setValuesHidden] = useState(() => {
    const stored = localStorage.getItem('valuesHidden');
    return stored === 'true';
  });

  const toggleValuesHidden = () => {
    setValuesHidden(prev => {
      const newValue = !prev;
      localStorage.setItem('valuesHidden', String(newValue));
      return newValue;
    });
  };

  const lastErrorRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  const fetchClients = async (showErrorToast = true) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('seller_id', user.id)
        .order('name');

      if (error) {
        console.error('Erro ao carregar clientes:', error);
        // Only show toast on initial load or if more than 30 seconds since last error
        const now = Date.now();
        if (showErrorToast && (isInitialLoadRef.current || now - lastErrorRef.current > 30000)) {
          toast.error('Erro ao carregar clientes');
          lastErrorRef.current = now;
        }
      } else {
        setClients(data || []);
        isInitialLoadRef.current = false;
      }
    } catch (err) {
      console.error('Erro de conexão:', err);
      // Only show toast on initial load or if more than 30 seconds since last error
      const now = Date.now();
      if (showErrorToast && (isInitialLoadRef.current || now - lastErrorRef.current > 30000)) {
        toast.error('Erro de conexão ao carregar clientes');
        lastErrorRef.current = now;
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('seller_id', user.id);
    if (data) setTemplates(data);
  };

  const fetchServers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('servers')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (data) setServers(data);
  };

  const fetchSellerName = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setSellerName(data.full_name || '');
    }
  };

  useEffect(() => {
    fetchClients(true); // Show error on initial load
    fetchTemplates();
    fetchServers();
    fetchSellerName();

    // Auto-refresh every 10 seconds (increased interval, no error toasts)
    const interval = setInterval(() => {
      fetchClients(false); // Don't show error toasts on auto-refresh
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  const getClientStatus = (expDate: string): StatusFilter => {
    const date = new Date(expDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = differenceInDays(date, today);
    
    if (daysUntil < 0) return 'expired';
    // Expiring: 0 (today), 1 (tomorrow), 2, or 3 days
    if (daysUntil <= 3) return 'expiring';
    return 'active';
  };

  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.phone?.includes(search) ||
          c.login?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((c) => getClientStatus(c.expiration_date) === statusFilter);
    }

    // Server filter
    if (serverFilter !== 'all') {
      if (serverFilter === 'none') {
        result = result.filter((c) => !c.server_id);
      } else {
        result = result.filter((c) => c.server_id === serverFilter);
      }
    }

    // Payment filter
    if (paymentFilter !== 'all') {
      if (paymentFilter === 'paid') {
        result = result.filter((c) => c.is_paid !== false);
      } else {
        result = result.filter((c) => c.is_paid === false);
      }
    }
    // Account type filter (Premium, SSH, IPTV, P2P)
    if (accountTypeFilter !== 'all') {
      if (accountTypeFilter === 'none') {
        result = result.filter((c) => !c.account_type);
      } else {
        result = result.filter((c) => c.account_type === accountTypeFilter);
      }
    }

    // Check if client was created recently (within last 5 minutes)
    const isRecentlyCreated = (client: Client): boolean => {
      if (!client.created_at) return false;
      const createdAt = new Date(client.created_at);
      const now = new Date();
      return differenceInMinutes(now, createdAt) <= 5;
    };

    // Sort - recently created clients always at the top
    result.sort((a, b) => {
      const aRecent = isRecentlyCreated(a);
      const bRecent = isRecentlyCreated(b);
      
      // If one is recent and the other isn't, recent one goes first
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;
      
      // If both are recent, sort by created_at (newest first)
      if (aRecent && bRecent) {
        return new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime();
      }
      
      // For "expiring" filter, always sort by expiration date (soonest first)
      // This ensures order: today → tomorrow → 2 days → 3 days
      if (statusFilter === 'expiring') {
        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
      }
      
      // Normal sorting for non-recent clients
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'expiration':
          return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
        case 'price':
          return (b.plan_price || 0) - (a.plan_price || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [clients, search, statusFilter, serverFilter, paymentFilter, accountTypeFilter, sortBy]);

  // Calculate unpaid clients stats
  const unpaidStats = useMemo(() => {
    const unpaidClients = clients.filter(c => c.is_paid === false);
    const totalUnpaid = unpaidClients.reduce((sum, c) => sum + (c.plan_price || 0), 0);
    return {
      count: unpaidClients.length,
      total: totalUnpaid,
    };
  }, [clients]);

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from('clients').delete().eq('id', deleteId);

    if (error) {
      toast.error('Erro ao excluir cliente');
    } else {
      toast.success('Cliente excluído com sucesso');
      fetchClients();
    }
    setDeleteId(null);
  };

  const handleRenew = async (clientId: string, newExpirationDate: string) => {
    const { error } = await supabase
      .from('clients')
      .update({ expiration_date: newExpirationDate })
      .eq('id', clientId);

    if (error) {
      toast.error('Erro ao renovar cliente');
    } else {
      toast.success('Cliente renovado com sucesso!');
      fetchClients();
    }
  };

  const toggleClientSelection = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const toggleAllClients = () => {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedClients);
    
    const { error } = await supabase
      .from('clients')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      toast.error('Erro ao excluir clientes');
    } else {
      toast.success(`${idsToDelete.length} cliente(s) excluído(s) com sucesso`);
      setSelectedClients(new Set());
      setIsSelectionMode(false);
      fetchClients();
    }
    setBulkDeleteOpen(false);
  };

  const cancelSelection = () => {
    setSelectedClients(new Set());
    setIsSelectionMode(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Meus Clientes</h1>
              <p className="text-muted-foreground">{valuesHidden ? '••' : filteredClients.length} clientes encontrados</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleValuesHidden}
              className="h-8 w-8"
              title={valuesHidden ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {valuesHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          
          {isSelectionMode ? (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">
                {valuesHidden ? '••' : selectedClients.size} selecionado(s)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllClients}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {selectedClients.size === filteredClients.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={selectedClients.size === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir ({valuesHidden ? '••' : selectedClients.size})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelSelection}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </div>
          ) : (
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setIsSelectionMode(true)}
              >
                <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Selecionar
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setBulkMessageOpen(true)}
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Mensagem
              </Button>
              <Button
                variant="gradient"
                size="sm"
                className="text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => {
                  setEditingClient(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Novo
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou login..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="expiring">Vencendo</SelectItem>
              <SelectItem value="expired">Vencidos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="expiration">Vencimento</SelectItem>
              <SelectItem value="price">Valor</SelectItem>
            </SelectContent>
          </Select>
          <Select value={serverFilter} onValueChange={setServerFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <Server className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Servidor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Servidores</SelectItem>
              <SelectItem value="none">Sem Servidor</SelectItem>
              {servers.map((server) => (
                <SelectItem key={server.id} value={server.id}>
                  {server.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as PaymentFilter)}>
            <SelectTrigger className={cn(
              "w-full sm:w-40",
              paymentFilter === 'unpaid' && "border-red-500/50 text-red-500"
            )}>
              <DollarSign className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="paid">Pagos</SelectItem>
              <SelectItem value="unpaid">Não Pagos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={accountTypeFilter} onValueChange={(v) => setAccountTypeFilter(v)}>
            <SelectTrigger className={cn(
              "w-full sm:w-40",
              accountTypeFilter !== 'all' && accountTypeFilter !== 'none' && "border-primary/50"
            )}>
              {accountTypeFilter === 'premium' ? <Crown className="w-4 h-4 mr-2" /> : 
               accountTypeFilter === 'ssh' ? <Terminal className="w-4 h-4 mr-2" /> :
               accountTypeFilter === 'iptv' ? <Tv className="w-4 h-4 mr-2" /> :
               accountTypeFilter === 'p2p' ? <Radio className="w-4 h-4 mr-2" /> :
               accountTypeFilter !== 'all' && accountTypeFilter !== 'none' ? <Tag className="w-4 h-4 mr-2" /> :
               <Filter className="w-4 h-4 mr-2" />}
              <SelectValue placeholder="Tipo Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipos</SelectItem>
              {allCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
              <SelectItem value="none">Sem Tipo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Unpaid Clients Summary */}
        {unpaidStats.count > 0 && (
          <div 
            className={cn(
              "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
              paymentFilter === 'unpaid' 
                ? "bg-red-500/20 border-red-500/50" 
                : "bg-red-500/10 border-red-500/30 hover:bg-red-500/15"
            )}
            onClick={() => setPaymentFilter(paymentFilter === 'unpaid' ? 'all' : 'unpaid')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-red-500">
                  {unpaidStats.count} cliente{unpaidStats.count !== 1 ? 's' : ''} não pago{unpaidStats.count !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  Clique para {paymentFilter === 'unpaid' ? 'ver todos' : 'filtrar'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total devido:</span>
              <span className="text-xl font-bold text-red-500">
                R$ {unpaidStats.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Shared Panels Section */}
        <Collapsible open={panelsOpen} onOpenChange={setPanelsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Créditos Compartilhados
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${panelsOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <SharedPanelsManager />
          </CollapsibleContent>
        </Collapsible>

        {/* Client Apps Section */}
        <Collapsible open={appsOpen} onOpenChange={setAppsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Aplicativos (Clouddy, IBO)
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${appsOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <ClientAppsManager />
          </CollapsibleContent>
        </Collapsible>

        {/* Client Grid */}
        {filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Nenhum cliente encontrado</p>
            <Button
              variant="gradient"
              className="mt-4"
              onClick={() => {
                setEditingClient(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar primeiro cliente
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <div key={client.id} className="relative">
                {isSelectionMode && (
                  <div 
                    className="absolute top-3 left-3 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleClientSelection(client.id);
                    }}
                  >
                    <Checkbox
                      checked={selectedClients.has(client.id)}
                      onCheckedChange={() => toggleClientSelection(client.id)}
                      className="h-5 w-5 bg-background border-2"
                    />
                  </div>
                )}
                <div 
                  className={cn(
                    isSelectionMode && "cursor-pointer",
                    isSelectionMode && selectedClients.has(client.id) && "ring-2 ring-primary rounded-lg"
                  )}
                  onClick={() => isSelectionMode && toggleClientSelection(client.id)}
                >
                  <ClientCard
                    client={client}
                    servers={servers}
                    onEdit={() => !isSelectionMode && handleEdit(client)}
                    onDelete={() => !isSelectionMode && setDeleteId(client.id)}
                    onRenew={handleRenew}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Client Dialog */}
        <ClientDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          client={editingClient}
          onSuccess={fetchClients}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O cliente será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Message Dialog */}
        <BulkMessageDialog
          open={bulkMessageOpen}
          onOpenChange={setBulkMessageOpen}
          clients={clients}
          templates={templates}
          sellerName={sellerName}
        />

        {/* Bulk Import Dialog */}
        <BulkImportDialog
          open={bulkImportOpen}
          onOpenChange={setBulkImportOpen}
          onSuccess={fetchClients}
          servers={servers}
        />


        {/* Bulk Delete Confirmation */}
        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {selectedClients.size} cliente(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Os clientes selecionados serão removidos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
                Excluir {selectedClients.size} cliente(s)
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
