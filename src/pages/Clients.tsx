import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Plus, Search, Download, Upload, Filter, Send, Server, Trash2, X, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  server_id: string | null;
}

interface ServerOption {
  id: string;
  name: string;
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
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

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

  const fetchServers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('servers')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (data) setServers(data);
  };

  useEffect(() => {
    fetchClients();
    fetchTemplates();
    fetchServers();
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

    // Server filter
    if (serverFilter !== 'all') {
      if (serverFilter === 'none') {
        result = result.filter((c) => !c.server_id);
      } else {
        result = result.filter((c) => c.server_id === serverFilter);
      }
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
  }, [clients, search, statusFilter, serverFilter, sortBy]);

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

  const exportToExcel = () => {
    const exportData = filteredClients.map((c) => ({
      Nome: c.name,
      Telefone: c.phone || '',
      Plano: c.plan_name || '',
      Valor: c.plan_price || 0,
      Vencimento: c.expiration_date,
      Dispositivo: c.device || '',
      Login: c.login || '',
      Senha: c.password || '',
      Aplicativo: c.app_name || '',
      MAC: c.mac_address || '',
      Servidor: c.server_name || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, 'clientes.xlsx');
    toast.success('Arquivo exportado com sucesso!');
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('Planilha vazia ou formato inválido');
        return;
      }

      let importedCount = 0;
      let errorCount = 0;

      for (const row of jsonData as Record<string, unknown>[]) {
        const name = String(row['Nome'] || row['nome'] || '').trim();
        const expirationDate = row['Vencimento'] || row['vencimento'] || row['Data Vencimento'];
        
        if (!name) {
          errorCount++;
          continue;
        }

        // Parse expiration date
        let parsedDate: string;
        if (typeof expirationDate === 'number') {
          // Excel date serial number
          const date = new Date((expirationDate - 25569) * 86400 * 1000);
          parsedDate = date.toISOString().split('T')[0];
        } else if (typeof expirationDate === 'string') {
          // Try to parse string date
          const parts = expirationDate.split(/[\/\-]/);
          if (parts.length === 3) {
            // Assume DD/MM/YYYY or DD-MM-YYYY format for Brazilian dates
            if (parts[0].length <= 2) {
              parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else {
              parsedDate = expirationDate;
            }
          } else {
            parsedDate = new Date().toISOString().split('T')[0];
          }
        } else {
          // Default to today + 30 days
          const date = new Date();
          date.setDate(date.getDate() + 30);
          parsedDate = date.toISOString().split('T')[0];
        }

        // Find server by name if provided
        let serverId: string | null = null;
        const serverName = String(row['Servidor'] || row['servidor'] || '').trim();
        if (serverName) {
          const matchedServer = servers.find(s => s.name.toLowerCase() === serverName.toLowerCase());
          if (matchedServer) {
            serverId = matchedServer.id;
          }
        }

        const clientData = {
          seller_id: user.id,
          name,
          phone: String(row['Telefone'] || row['telefone'] || '').trim() || null,
          plan_name: String(row['Plano'] || row['plano'] || '').trim() || null,
          plan_price: Number(row['Valor'] || row['valor'] || 0) || null,
          expiration_date: parsedDate,
          device: String(row['Dispositivo'] || row['dispositivo'] || '').trim() || null,
          login: String(row['Login'] || row['login'] || '').trim() || null,
          password: String(row['Senha'] || row['senha'] || '').trim() || null,
          app_name: String(row['Aplicativo'] || row['aplicativo'] || row['App'] || '').trim() || null,
          mac_address: String(row['MAC'] || row['mac'] || row['Mac Address'] || '').trim() || null,
          server_id: serverId,
          server_name: serverName || null,
        };

        const { error } = await supabase.from('clients').insert(clientData);
        
        if (error) {
          console.error('Error importing client:', name, error);
          errorCount++;
        } else {
          importedCount++;
        }
      }

      if (importedCount > 0) {
        toast.success(`${importedCount} cliente(s) importado(s) com sucesso!`);
        fetchClients();
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} cliente(s) não puderam ser importados`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao processar a planilha');
    }

    // Reset the input
    event.target.value = '';
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
          
          {isSelectionMode ? (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">
                {selectedClients.size} selecionado(s)
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
                Excluir ({selectedClients.size})
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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setIsSelectionMode(true)}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Selecionar</span>
              </Button>
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
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportExcel}
                  className="hidden"
                />
                <Button variant="outline" asChild>
                  <span className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Importar</span>
                  </span>
                </Button>
              </label>
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
