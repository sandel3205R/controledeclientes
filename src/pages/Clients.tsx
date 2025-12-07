import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import ClientCard from '@/components/clients/ClientCard';
import ClientDialog from '@/components/clients/ClientDialog';
import BulkMessageDialog from '@/components/clients/BulkMessageDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Download, Filter, Send } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, isPast } from 'date-fns';
import * as XLSX from 'xlsx';
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
  device: string | null;
  login: string | null;
  password: string | null;
  expiration_date: string;
  plan_name: string | null;
  plan_price: number | null;
  app_name: string | null;
  mac_address: string | null;
  server_name: string | null;
}

type StatusFilter = 'all' | 'active' | 'expiring' | 'expired';
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
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);

  const fetchClients = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('seller_id', user.id)
      .order('name');

    if (error) {
      toast.error('Erro ao carregar clientes');
      return;
    }

    setClients(data || []);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('seller_id', user.id);
    if (data) setTemplates(data);
  };

  useEffect(() => {
    fetchClients();
    fetchTemplates();
  }, [user]);

  const getClientStatus = (expDate: string): StatusFilter => {
    const date = new Date(expDate);
    if (isPast(date)) return 'expired';
    if (differenceInDays(date, new Date()) <= 7) return 'expiring';
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

    // Sort
    result.sort((a, b) => {
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
  }, [clients, search, statusFilter, sortBy]);

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

  const exportToExcel = () => {
    const exportData = filteredClients.map((c) => ({
      Nome: c.name,
      Telefone: c.phone || '',
      Plano: c.plan_name || '',
      Valor: c.plan_price || 0,
      Vencimento: c.expiration_date,
      Dispositivo: c.device || '',
      Login: c.login || '',
      Status:
        getClientStatus(c.expiration_date) === 'active'
          ? 'Ativo'
          : getClientStatus(c.expiration_date) === 'expiring'
          ? 'Vencendo'
          : 'Vencido',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, 'clientes.xlsx');
    toast.success('Arquivo exportado com sucesso!');
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
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Meus Clientes</h1>
            <p className="text-muted-foreground">{filteredClients.length} clientes encontrados</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => setBulkMessageOpen(true)}
              className="bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20"
            >
              <Send className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Mensagem em Massa</span>
              <span className="sm:hidden">Massa</span>
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button
              variant="gradient"
              onClick={() => {
                setEditingClient(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
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
        </div>

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
              <ClientCard
                key={client.id}
                client={client}
                onEdit={() => handleEdit(client)}
                onDelete={() => setDeleteId(client.id)}
                onRenew={handleRenew}
              />
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
        />
      </div>
    </AppLayout>
  );
}
