import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCrypto } from '@/hooks/useCrypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Edit, Trash2, Users, AlertCircle, UserPlus, Link, Tv, Radio, Search, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreditPanel {
  id: string;
  name: string;
  p2p_slots: number;
  iptv_slots: number;
  seller_id: string;
  created_at: string;
  filled_p2p?: number;
  filled_iptv?: number;
  clients?: PanelClientInfo[];
  shared_login?: string;
  shared_password?: string;
}

interface PanelClient {
  id: string;
  name: string;
  shared_slot_type: string | null;
  login: string | null;
  password: string | null;
}

interface PanelClientInfo {
  id: string;
  name: string;
  shared_slot_type: string | null;
}

interface ExistingClient {
  id: string;
  name: string;
  phone: string | null;
  login: string | null;
  password: string | null;
  shared_panel_id: string | null;
}

type PanelPreset = 'p2p_iptv' | 'iptv_only';

export function SharedPanelsManager() {
  const { user } = useAuth();
  const { decryptSingle } = useCrypto();
  const [panels, setPanels] = useState<CreditPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<CreditPanel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<CreditPanel | null>(null);
  const [panelClients, setPanelClients] = useState<PanelClient[]>([]);
  const [sharedCredentials, setSharedCredentials] = useState({ login: '', password: '' });
  const [existingClients, setExistingClients] = useState<ExistingClient[]>([]);
  const [selectedExistingClientId, setSelectedExistingClientId] = useState<string>('');
  const [addMode, setAddMode] = useState<'new' | 'existing'>('existing');
  const [selectedSlotType, setSelectedSlotType] = useState<'p2p' | 'iptv'>('iptv');
  const [clientSearch, setClientSearch] = useState('');
  
  const [formData, setFormData] = useState({ 
    name: '', 
    preset: 'p2p_iptv' as PanelPreset,
    p2p_slots: 1,
    iptv_slots: 2,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [clientFormData, setClientFormData] = useState({
    name: '',
    phone: '',
    expiration_date: '',
  });

  const fetchPanels = useCallback(async () => {
    if (!user) return;

    try {
      const { data: panelsData, error: panelsError } = await supabase
        .from('shared_panels')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (panelsError) {
        console.error('Error fetching panels:', panelsError);
        return;
      }

      // Get clients with their shared_panel_id and slot type
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, shared_panel_id, shared_slot_type, login, password')
        .eq('seller_id', user.id)
        .not('shared_panel_id', 'is', null);

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        return;
      }

      const panelCounts: { [key: string]: { p2p: number; iptv: number; clients: PanelClientInfo[]; login?: string; password?: string } } = {};
      clientsData?.forEach(client => {
        if (client.shared_panel_id) {
          if (!panelCounts[client.shared_panel_id]) {
            panelCounts[client.shared_panel_id] = { p2p: 0, iptv: 0, clients: [] };
          }
          if (client.shared_slot_type === 'p2p') {
            panelCounts[client.shared_panel_id].p2p++;
          } else if (client.shared_slot_type === 'iptv') {
            panelCounts[client.shared_panel_id].iptv++;
          }
          panelCounts[client.shared_panel_id].clients.push({
            id: client.id,
            name: client.name,
            shared_slot_type: client.shared_slot_type,
          });
          // Get login/password from first client
          if (!panelCounts[client.shared_panel_id].login && client.login) {
            panelCounts[client.shared_panel_id].login = client.login;
            panelCounts[client.shared_panel_id].password = client.password || undefined;
          }
        }
      });

      const panelsWithCounts = await Promise.all(
        (panelsData ?? []).map(async (panel) => {
          const counts = panelCounts[panel.id];
          const [login, password] = await Promise.all([
            decryptSingle(counts?.login ?? null),
            decryptSingle(counts?.password ?? null),
          ]);

          return {
            ...panel,
            filled_p2p: counts?.p2p || 0,
            filled_iptv: counts?.iptv || 0,
            clients: counts?.clients || [],
            shared_login: login ?? undefined,
            shared_password: password ?? undefined,
          };
        })
      );

      setPanels(panelsWithCounts);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, decryptSingle]);

  useEffect(() => {
    fetchPanels();
  }, [fetchPanels]);

  const handlePresetChange = (preset: PanelPreset) => {
    if (preset === 'p2p_iptv') {
      setFormData({ ...formData, preset, p2p_slots: 1, iptv_slots: 2 });
    } else {
      setFormData({ ...formData, preset, p2p_slots: 0, iptv_slots: 2 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editingPanel) {
      const { error } = await supabase
        .from('shared_panels')
        .update({ 
          name: formData.name, 
          p2p_slots: formData.p2p_slots,
          iptv_slots: formData.iptv_slots,
        })
        .eq('id', editingPanel.id);

      if (error) {
        toast.error('Erro ao atualizar crédito');
      } else {
        toast.success('Crédito atualizado!');
        setDialogOpen(false);
        resetForm();
        fetchPanels();
      }
    } else {
      const { error } = await supabase
        .from('shared_panels')
        .insert({
          name: formData.name,
          p2p_slots: formData.p2p_slots,
          iptv_slots: formData.iptv_slots,
          seller_id: user.id,
          total_slots: formData.p2p_slots + formData.iptv_slots,
        });

      if (error) {
        toast.error('Erro ao criar crédito');
      } else {
        toast.success('Crédito criado!');
        setDialogOpen(false);
        resetForm();
        fetchPanels();
      }
    }
  };

  const handleEdit = (panel: CreditPanel) => {
    setEditingPanel(panel);
    const preset: PanelPreset = panel.p2p_slots > 0 ? 'p2p_iptv' : 'iptv_only';
    setFormData({ 
      name: panel.name, 
      preset,
      p2p_slots: panel.p2p_slots,
      iptv_slots: panel.iptv_slots,
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    const { error } = await supabase
      .from('shared_panels')
      .delete()
      .eq('id', deleteId);

    if (error) {
      toast.error('Erro ao excluir crédito');
    } else {
      toast.success('Crédito excluído');
      fetchPanels();
    }
    setDeleteId(null);
  };

  const resetForm = () => {
    setFormData({ name: '', preset: 'p2p_iptv', p2p_slots: 1, iptv_slots: 2 });
    setEditingPanel(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const fetchExistingClients = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, login, password, shared_panel_id')
      .eq('seller_id', user.id)
      .is('shared_panel_id', null)
      .order('name');
    
    if (data) {
      setExistingClients(data);
    }
  };

  const openAddClientDialog = async (panel: CreditPanel) => {
    setSelectedPanel(panel);
    setAddMode('existing');
    setSelectedExistingClientId('');
    setClientSearch('');
    
    const availP2P = panel.p2p_slots - (panel.filled_p2p || 0);
    const availIPTV = panel.iptv_slots - (panel.filled_iptv || 0);
    
    if (availP2P > 0) {
      setSelectedSlotType('p2p');
    } else {
      setSelectedSlotType('iptv');
    }
    
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, shared_slot_type, login, password')
      .eq('shared_panel_id', panel.id)
      .order('created_at');
    
    if (clients && clients.length > 0) {
      setPanelClients(clients);
      setSharedCredentials({
        login: clients[0].login || '',
        password: clients[0].password || '',
      });
    } else {
      setPanelClients([]);
      setSharedCredentials({ login: '', password: '' });
    }
    
    setClientFormData({
      name: '',
      phone: '',
      expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    
    await fetchExistingClients();
    setAddClientDialogOpen(true);
  };

  const handleAddClient = async () => {
    if (!user || !selectedPanel) return;

    if (!clientFormData.name.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    const { error } = await supabase.from('clients').insert({
      seller_id: user.id,
      name: clientFormData.name,
      phone: clientFormData.phone || null,
      expiration_date: clientFormData.expiration_date,
      shared_panel_id: selectedPanel.id,
      shared_slot_type: selectedSlotType,
      login: sharedCredentials.login || null,
      password: sharedCredentials.password || null,
    });

    if (error) {
      console.error('Error adding client:', error);
      toast.error('Erro ao adicionar cliente');
    } else {
      toast.success(`Cliente ${selectedSlotType.toUpperCase()} adicionado!`);
      await handleAfterAddClient();
    }
  };

  const handleLinkExistingClient = async () => {
    if (!user || !selectedPanel || !selectedExistingClientId) {
      toast.error('Selecione um cliente');
      return;
    }

    const selectedClient = existingClients.find(c => c.id === selectedExistingClientId);
    if (!selectedClient) {
      toast.error('Cliente não encontrado');
      return;
    }

    let updateData: Record<string, unknown> = {
      shared_panel_id: selectedPanel.id,
      shared_slot_type: selectedSlotType,
    };

    if (panelClients.length === 0) {
      setSharedCredentials({
        login: selectedClient.login || '',
        password: selectedClient.password || '',
      });
    } else {
      updateData.login = sharedCredentials.login || null;
      updateData.password = sharedCredentials.password || null;
    }

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', selectedExistingClientId);

    if (error) {
      console.error('Error linking client:', error);
      toast.error('Erro ao vincular cliente');
    } else {
      toast.success(`Cliente vinculado como ${selectedSlotType.toUpperCase()}!`);
      await handleAfterAddClient();
    }
  };

  const handleAfterAddClient = async () => {
    await fetchPanels();
    
    if (!selectedPanel) return;
    
    const newFilledP2P = (selectedPanel.filled_p2p || 0) + (selectedSlotType === 'p2p' ? 1 : 0);
    const newFilledIPTV = (selectedPanel.filled_iptv || 0) + (selectedSlotType === 'iptv' ? 1 : 0);
    const isFull = newFilledP2P >= selectedPanel.p2p_slots && newFilledIPTV >= selectedPanel.iptv_slots;
    
    if (isFull) {
      toast.success('Crédito completo! Todas as vagas foram preenchidas.');
      setAddClientDialogOpen(false);
    } else {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, shared_slot_type, login, password')
        .eq('shared_panel_id', selectedPanel.id)
        .order('created_at');
      if (clients) {
        setPanelClients(clients);
        if (clients.length > 0) {
          setSharedCredentials({
            login: clients[0].login || '',
            password: clients[0].password || '',
          });
        }
      }
      
      setClientFormData({
        name: '',
        phone: '',
        expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      setSelectedExistingClientId('');
      await fetchExistingClients();
      
      setSelectedPanel({
        ...selectedPanel,
        filled_p2p: newFilledP2P,
        filled_iptv: newFilledIPTV,
      });
      
      const availP2P = selectedPanel.p2p_slots - newFilledP2P;
      const availIPTV = selectedPanel.iptv_slots - newFilledIPTV;
      if (availP2P <= 0 && availIPTV > 0) {
        setSelectedSlotType('iptv');
      } else if (availIPTV <= 0 && availP2P > 0) {
        setSelectedSlotType('p2p');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const panelsWithAvailableSlots = panels.filter(p => {
    const availP2P = p.p2p_slots - (p.filled_p2p || 0);
    const availIPTV = p.iptv_slots - (p.filled_iptv || 0);
    return availP2P > 0 || availIPTV > 0;
  });

  const totalAvailableSlots = panelsWithAvailableSlots.reduce((acc, p) => {
    const availP2P = p.p2p_slots - (p.filled_p2p || 0);
    const availIPTV = p.iptv_slots - (p.filled_iptv || 0);
    return acc + availP2P + availIPTV;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Créditos Compartilhados</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie créditos com vagas P2P e IPTV
          </p>
        </div>
        <Button variant="gradient" size="sm" onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Crédito
        </Button>
      </div>

      {totalAvailableSlots > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-500">Vagas Disponíveis</p>
            <p className="text-xs text-amber-400">
              {panelsWithAvailableSlots.length} crédito(s) com vagas para preencher
            </p>
          </div>
        </div>
      )}

      {panels.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">Nenhum crédito compartilhado</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Criar crédito
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {panels.map((panel) => {
            const availP2P = panel.p2p_slots - (panel.filled_p2p || 0);
            const availIPTV = panel.iptv_slots - (panel.filled_iptv || 0);
            const isFull = availP2P <= 0 && availIPTV <= 0;

            return (
              <Card 
                key={panel.id} 
                className="card-gradient border-amber-500/30 ring-1 ring-amber-500/20"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{panel.name}</CardTitle>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {panel.p2p_slots > 0 && (
                          <Badge 
                            variant="secondary" 
                            className={availP2P > 0 
                              ? "bg-blue-500/20 text-blue-500" 
                              : "bg-green-500/20 text-green-500"
                            }
                          >
                            <Radio className="w-3 h-3 mr-1" />
                            P2P: {panel.filled_p2p || 0}/{panel.p2p_slots}
                          </Badge>
                        )}
                        <Badge 
                          variant="secondary" 
                          className={availIPTV > 0 
                            ? "bg-purple-500/20 text-purple-500" 
                            : "bg-green-500/20 text-green-500"
                          }
                        >
                          <Tv className="w-3 h-3 mr-1" />
                          IPTV: {panel.filled_iptv || 0}/{panel.iptv_slots}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(panel)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(panel.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Show shared credentials for easy copy */}
                  {panel.shared_login && (
                    <div className="p-2 bg-muted/50 rounded-md text-xs space-y-1.5">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-muted-foreground">Login:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-medium">{panel.shared_login}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => {
                              navigator.clipboard.writeText(panel.shared_login || '');
                              setCopiedId(`${panel.id}-login`);
                              toast.success('Login copiado!');
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                          >
                            {copiedId === `${panel.id}-login` ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      {panel.shared_password && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground">Senha:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-medium">{panel.shared_password}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => {
                                navigator.clipboard.writeText(panel.shared_password || '');
                                setCopiedId(`${panel.id}-password`);
                                toast.success('Senha copiada!');
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                            >
                              {copiedId === `${panel.id}-password` ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-1 h-7 text-xs"
                        onClick={() => {
                          const text = `Login: ${panel.shared_login}${panel.shared_password ? `\nSenha: ${panel.shared_password}` : ''}`;
                          navigator.clipboard.writeText(text);
                          setCopiedId(`${panel.id}-all`);
                          toast.success('Credenciais copiadas!');
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                      >
                        {copiedId === `${panel.id}-all` ? (
                          <Check className="w-3 h-3 mr-1.5 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3 mr-1.5" />
                        )}
                        Copiar tudo
                      </Button>
                    </div>
                  )}

                  {/* Show linked clients */}
                  {panel.clients && panel.clients.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Clientes vinculados:</p>
                      <div className="flex flex-wrap gap-1">
                        {panel.clients.map(client => (
                          <Badge 
                            key={client.id} 
                            variant="outline" 
                            className={`text-xs ${
                              client.shared_slot_type === 'p2p' 
                                ? 'border-blue-500/30 text-blue-500' 
                                : 'border-purple-500/30 text-purple-500'
                            }`}
                          >
                            {client.shared_slot_type === 'p2p' ? (
                              <Radio className="w-2.5 h-2.5 mr-1" />
                            ) : (
                              <Tv className="w-2.5 h-2.5 mr-1" />
                            )}
                            {client.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground">
                    {isFull ? (
                      <span className="text-green-500 font-medium">Completo</span>
                    ) : (
                      <>
                        Falta:{' '}
                        {availP2P > 0 && <span className="text-blue-500 font-medium">{availP2P} P2P</span>}
                        {availP2P > 0 && availIPTV > 0 && ' e '}
                        {availIPTV > 0 && <span className="text-purple-500 font-medium">{availIPTV} IPTV</span>}
                      </>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-amber-500/30 hover:bg-amber-500/10"
                    onClick={() => openAddClientDialog(panel)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Adicionar Cliente
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}


      {/* Create/Edit Panel Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPanel ? 'Editar Crédito' : 'Novo Crédito'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="panel_name">Nome do Crédito *</Label>
              <Input
                id="panel_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Crédito Server X"
                required
              />
            </div>
            
            <div className="space-y-3">
              <Label>Tipo de Vagas</Label>
              <RadioGroup 
                value={formData.preset} 
                onValueChange={(v) => handlePresetChange(v as PanelPreset)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="p2p_iptv" id="p2p_iptv" />
                  <Label htmlFor="p2p_iptv" className="flex-1 cursor-pointer">
                    <div className="font-medium">1 P2P + 2 IPTV</div>
                    <div className="text-xs text-muted-foreground">Painel completo</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="iptv_only" id="iptv_only" />
                  <Label htmlFor="iptv_only" className="flex-1 cursor-pointer">
                    <div className="font-medium">Apenas 2 IPTV</div>
                    <div className="text-xs text-muted-foreground">Sem vaga P2P</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p2p_slots">Vagas P2P</Label>
                <Input
                  id="p2p_slots"
                  type="number"
                  min="0"
                  max="5"
                  value={formData.p2p_slots}
                  onChange={(e) => setFormData({ ...formData, p2p_slots: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iptv_slots">Vagas IPTV</Label>
                <Input
                  id="iptv_slots"
                  type="number"
                  min="0"
                  max="5"
                  value={formData.iptv_slots}
                  onChange={(e) => setFormData({ ...formData, iptv_slots: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="gradient" className="flex-1">
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Client to Panel Dialog */}
      <Dialog open={addClientDialogOpen} onOpenChange={setAddClientDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Adicionar Cliente - {selectedPanel?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {panelClients.length > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Clientes neste crédito:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {panelClients.map(client => (
                    <li key={client.id} className="flex items-center gap-2">
                      {client.shared_slot_type === 'p2p' ? (
                        <Radio className="w-3 h-3 text-blue-500" />
                      ) : (
                        <Tv className="w-3 h-3 text-purple-500" />
                      )}
                      {client.name}
                      <span className="text-xs opacity-70">
                        ({client.shared_slot_type?.toUpperCase()})
                      </span>
                    </li>
                  ))}
                </ul>
                {sharedCredentials.login && (
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                    Login: <span className="font-medium">{sharedCredentials.login}</span>
                  </p>
                )}
              </div>
            )}

            {/* Slot Type Selection */}
            {selectedPanel && (
              <div className="space-y-2">
                <Label>Tipo de Vaga</Label>
                <div className="flex gap-2">
                  {selectedPanel.p2p_slots > 0 && (
                    <Button
                      type="button"
                      variant={selectedSlotType === 'p2p' ? 'default' : 'outline'}
                      size="sm"
                      className={selectedSlotType === 'p2p' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                      onClick={() => setSelectedSlotType('p2p')}
                      disabled={(selectedPanel.filled_p2p || 0) >= selectedPanel.p2p_slots}
                    >
                      <Radio className="w-3.5 h-3.5 mr-1.5" />
                      P2P ({selectedPanel.p2p_slots - (selectedPanel.filled_p2p || 0)} vaga)
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={selectedSlotType === 'iptv' ? 'default' : 'outline'}
                    size="sm"
                    className={selectedSlotType === 'iptv' ? 'bg-purple-500 hover:bg-purple-600' : ''}
                    onClick={() => setSelectedSlotType('iptv')}
                    disabled={(selectedPanel.filled_iptv || 0) >= selectedPanel.iptv_slots}
                  >
                    <Tv className="w-3.5 h-3.5 mr-1.5" />
                    IPTV ({selectedPanel.iptv_slots - (selectedPanel.filled_iptv || 0)} vaga{selectedPanel.iptv_slots - (selectedPanel.filled_iptv || 0) !== 1 ? 's' : ''})
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 border-b pb-2">
              <Button
                type="button"
                variant={addMode === 'existing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAddMode('existing')}
              >
                <Link className="w-3.5 h-3.5 mr-1.5" />
                Cliente Existente
              </Button>
              <Button
                type="button"
                variant={addMode === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAddMode('new')}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                Novo Cliente
              </Button>
            </div>
              
            {addMode === 'existing' ? (
              <div className="space-y-3">
                {existingClients.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Nenhum cliente disponível para vincular
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Buscar cliente</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nome ou login..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Selecione um cliente</Label>
                      <ScrollArea className="h-[180px] border rounded-md p-2">
                        <div className="space-y-1">
                          {existingClients
                            .filter(client => {
                              const searchLower = clientSearch.toLowerCase();
                              return client.name.toLowerCase().includes(searchLower) ||
                                     (client.login?.toLowerCase().includes(searchLower));
                            })
                            .map(client => (
                              <div
                                key={client.id}
                                className={`p-2 rounded-md cursor-pointer transition-colors ${
                                  selectedExistingClientId === client.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted'
                                }`}
                                onClick={() => setSelectedExistingClientId(client.id)}
                              >
                                <div className="font-medium text-sm">{client.name}</div>
                                {client.login && (
                                  <div className={`text-xs ${selectedExistingClientId === client.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    Login: {client.login}
                                  </div>
                                )}
                              </div>
                            ))}
                          {existingClients.filter(client => {
                            const searchLower = clientSearch.toLowerCase();
                            return client.name.toLowerCase().includes(searchLower) ||
                                   (client.login?.toLowerCase().includes(searchLower));
                          }).length === 0 && (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              Nenhum cliente encontrado
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                    
                    {panelClients.length === 0 && selectedExistingClientId && (
                      <p className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded">
                        O login/senha deste cliente será compartilhado com os próximos
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="client-name">Nome do Cliente *</Label>
                  <Input
                    id="client-name"
                    value={clientFormData.name}
                    onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                    placeholder="Nome do cliente"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="client-phone">Telefone</Label>
                  <Input
                    id="client-phone"
                    value={clientFormData.phone}
                    onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="client-expiration">Data de Vencimento *</Label>
                  <Input
                    id="client-expiration"
                    type="date"
                    value={clientFormData.expiration_date}
                    onChange={(e) => setClientFormData({ ...clientFormData, expiration_date: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="shared-login">Login</Label>
                    <Input
                      id="shared-login"
                      value={sharedCredentials.login}
                      onChange={(e) => setSharedCredentials({ ...sharedCredentials, login: e.target.value })}
                      placeholder="Login"
                      disabled={panelClients.length > 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shared-password">Senha</Label>
                    <Input
                      id="shared-password"
                      value={sharedCredentials.password}
                      onChange={(e) => setSharedCredentials({ ...sharedCredentials, password: e.target.value })}
                      placeholder="Senha"
                      disabled={panelClients.length > 0}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClientDialogOpen(false)}>
              Cancelar
            </Button>
            {addMode === 'existing' ? (
              <Button onClick={handleLinkExistingClient} disabled={!selectedExistingClientId}>
                <Link className="w-4 h-4 mr-2" />
                Vincular
              </Button>
            ) : (
              <Button onClick={handleAddClient}>
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir crédito?</AlertDialogTitle>
            <AlertDialogDescription>
              O crédito será removido. Os clientes vinculados não serão excluídos.
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
    </div>
  );
}