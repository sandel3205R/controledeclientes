import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addYears, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Mail, Lock, Wifi, Hash, Tv, Plus, User, Phone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { useCrypto } from '@/hooks/useCrypto';
import { ScrollArea } from '@/components/ui/scroll-area';

const appSchema = z.object({
  client_name: z.string().min(1, 'Nome do cliente é obrigatório'),
  client_phone: z.string().optional(),
  app_type: z.string().min(1, 'Tipo de aplicativo é obrigatório'),
  email: z.string().optional(),
  password: z.string().optional(),
  mac_address: z.string().optional(),
  device_id: z.string().optional(),
  app_price: z.string().optional(),
  expiration_date: z.string().min(1, 'Data de vencimento é obrigatória'),
  notes: z.string().optional(),
});

type AppForm = z.infer<typeof appSchema>;

interface ExistingClient {
  id: string;
  name: string;
  phone: string | null;
}

interface AppType {
  id: string;
  name: string;
  uses_email: boolean;
}

interface ClientAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  clientName?: string;
  existingApp?: {
    id: string;
    app_type: string;
    email: string | null;
    password: string | null;
    mac_address: string | null;
    device_id: string | null;
    app_price: number | null;
    expiration_date: string;
    notes: string | null;
  } | null;
  onSuccess: () => void;
  mode?: 'new' | 'existing' | 'edit';
  appTypes: AppType[];
}

export default function ClientAppDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  existingApp,
  onSuccess,
  mode = 'new',
  appTypes,
}: ClientAppDialogProps) {
  const [loading, setLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const { encryptCredentials, decryptCredentials } = useCrypto();
  const [existingClients, setExistingClients] = useState<ExistingClient[]>([]);
  const [selectedExistingClientId, setSelectedExistingClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [addMode, setAddMode] = useState<'new' | 'existing'>('new');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AppForm>({
    resolver: zodResolver(appSchema),
    defaultValues: {
      app_type: appTypes[0]?.name || '',
      expiration_date: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    },
  });

  const selectedAppType = watch('app_type');
  const selectedAppTypeInfo = appTypes.find(a => a.name === selectedAppType);
  const usesEmail = selectedAppTypeInfo?.uses_email ?? true;

  const fetchExistingClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
    setExistingClients(data || []);
  };

  useEffect(() => {
    const loadExistingApp = async () => {
      if (mode === 'edit' && existingApp && clientId) {
        try {
          const decrypted = await decryptCredentials({
            login: existingApp.email,
            password: existingApp.password,
          });

          const appTypeInfo = appTypes.find(a => a.name === existingApp.app_type);

          reset({
            client_name: clientName || '',
            client_phone: '',
            app_type: existingApp.app_type,
            email: decrypted.login || '',
            password: decrypted.password || '',
            mac_address: existingApp.mac_address || '',
            device_id: existingApp.device_id || '',
            app_price: existingApp.app_price?.toString() || '',
            expiration_date: existingApp.expiration_date,
            notes: existingApp.notes || '',
          });
          setAddMode('existing');
          setSelectedExistingClientId(clientId);
        } catch (err) {
          console.error('Error decrypting credentials:', err);
        }
      } else {
        reset({
          client_name: '',
          client_phone: '',
          app_type: appTypes[0]?.name || '',
          email: '',
          password: '',
          mac_address: '',
          device_id: '',
          app_price: '',
          expiration_date: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
          notes: '',
        });
        setAddMode('new');
        setSelectedExistingClientId('');
        setClientSearch('');
      }
    };

    if (open) {
      loadExistingApp();
      fetchExistingClients();
    }
  }, [open, mode, existingApp?.id, clientId, appTypes]);

  const onSubmit = async (data: AppForm) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let encryptedEmail: string | null = null;
      let encryptedPassword: string | null = null;

      if (usesEmail && (data.email || data.password)) {
        const encrypted = await encryptCredentials({
          login: data.email || null,
          password: data.password || null,
        });
        encryptedEmail = encrypted.login;
        encryptedPassword = encrypted.password;
      }

      let targetClientId = clientId;

      if (mode === 'new' && addMode === 'new') {
        if (!data.client_name.trim()) {
          toast.error('Nome do cliente é obrigatório');
          setLoading(false);
          return;
        }

        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            seller_id: user.id,
            name: data.client_name.trim(),
            phone: data.client_phone || null,
            expiration_date: data.expiration_date,
          })
          .select()
          .single();

        if (clientError) {
          throw clientError;
        }

        targetClientId = newClient.id;
      } else if (mode === 'new' && addMode === 'existing') {
        if (!selectedExistingClientId) {
          toast.error('Selecione um cliente');
          setLoading(false);
          return;
        }
        targetClientId = selectedExistingClientId;
      }

      if (!targetClientId) {
        toast.error('Cliente não encontrado');
        setLoading(false);
        return;
      }

      const appData = {
        client_id: targetClientId,
        seller_id: user.id,
        app_type: data.app_type,
        email: encryptedEmail,
        password: encryptedPassword,
        mac_address: !usesEmail ? (data.mac_address || null) : null,
        device_id: !usesEmail ? (data.device_id || null) : null,
        app_price: data.app_price ? parseFloat(data.app_price) : null,
        expiration_date: data.expiration_date,
        notes: data.notes || null,
      };

      if (mode === 'edit' && existingApp) {
        const { error } = await supabase
          .from('client_apps')
          .update(appData)
          .eq('id', existingApp.id);
        if (error) throw error;
        toast.success('Aplicativo atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('client_apps')
          .insert([appData]);
        if (error) {
          if (error.code === '23505') {
            toast.error('Este cliente já possui um aplicativo cadastrado');
            return;
          }
          throw error;
        }
        toast.success('Cliente com aplicativo cadastrado com sucesso!');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving app:', error);
      toast.error(error.message || 'Erro ao salvar aplicativo');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = (months: number) => {
    const newDate = addMonths(new Date(), months);
    setValue('expiration_date', format(newDate, 'yyyy-MM-dd'));
  };

  const filteredClients = existingClients.filter(client => {
    if (!clientSearch) return true;
    return client.name.toLowerCase().includes(clientSearch.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Editar Aplicativo' : 'Novo Cliente com Aplicativo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-2">
          {/* Client selection - only for new mode */}
          {mode === 'new' && (
            <div className="space-y-3">
              <div className="flex gap-2 border-b pb-2">
                <Button
                  type="button"
                  variant={addMode === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAddMode('new')}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Novo Cliente
                </Button>
                <Button
                  type="button"
                  variant={addMode === 'existing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAddMode('existing')}
                >
                  <User className="w-3.5 h-3.5 mr-1.5" />
                  Cliente Existente
                </Button>
              </div>

              {addMode === 'new' ? (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <div className="space-y-2">
                    <Label htmlFor="client_name" className="flex items-center gap-1">
                      <User className="h-3 w-3" /> Nome do Cliente *
                    </Label>
                    <Input
                      id="client_name"
                      {...register('client_name')}
                      placeholder="Nome do cliente"
                    />
                    {errors.client_name && (
                      <p className="text-xs text-destructive">{errors.client_name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_phone" className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telefone
                    </Label>
                    <Input
                      id="client_phone"
                      {...register('client_phone')}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {existingClients.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Todos os clientes já possuem aplicativo
                    </div>
                  ) : (
                    <>
                      <Input
                        placeholder="Buscar cliente..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <ScrollArea className="h-[120px] border rounded-md p-1.5">
                        <div className="space-y-0.5">
                          {filteredClients.map(client => (
                            <div
                              key={client.id}
                              className={cn(
                                'p-2 rounded cursor-pointer transition-colors text-sm',
                                selectedExistingClientId === client.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted'
                              )}
                              onClick={() => setSelectedExistingClientId(client.id)}
                            >
                              <div className="font-medium">{client.name}</div>
                              {client.phone && (
                                <div className={cn(
                                  'text-xs',
                                  selectedExistingClientId === client.id 
                                    ? 'text-primary-foreground/70' 
                                    : 'text-muted-foreground'
                                )}>
                                  {client.phone}
                                </div>
                              )}
                            </div>
                          ))}
                          {filteredClients.length === 0 && (
                            <div className="text-center py-3 text-muted-foreground text-xs">
                              Nenhum cliente encontrado
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* App Type */}
          <div className="space-y-2">
            <Label>Aplicativo *</Label>
            {appTypes.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg">
                Nenhum tipo de aplicativo cadastrado
              </div>
            ) : (
              <Select
                value={selectedAppType}
                onValueChange={(value) => setValue('app_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o aplicativo" />
                </SelectTrigger>
                <SelectContent>
                  {appTypes.map((app) => (
                    <SelectItem key={app.id} value={app.name}>
                      <div className="flex items-center gap-2">
                        <Tv className="h-4 w-4" />
                        {app.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Credentials */}
          {usesEmail ? (
            <div className="space-y-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center gap-2 text-blue-500 text-sm font-medium">
                <Mail className="h-4 w-4" />
                Credenciais (Email/Senha)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1 text-xs">
                    <Mail className="h-3 w-3" /> Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="email@exemplo.com"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-1 text-xs">
                    <Lock className="h-3 w-3" /> Senha
                  </Label>
                  <Input
                    id="password"
                    type="text"
                    {...register('password')}
                    placeholder="Senha"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-3 rounded-lg border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center gap-2 text-purple-500 text-sm font-medium">
                <Wifi className="h-4 w-4" />
                Credenciais (MAC/ID)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="mac_address" className="flex items-center gap-1 text-xs">
                    <Wifi className="h-3 w-3" /> MAC Address
                  </Label>
                  <Input
                    id="mac_address"
                    {...register('mac_address')}
                    placeholder="00:00:00:00:00:00"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="device_id" className="flex items-center gap-1 text-xs">
                    <Hash className="h-3 w-3" /> Device ID
                  </Label>
                  <Input
                    id="device_id"
                    {...register('device_id')}
                    placeholder="ID do dispositivo"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Expiration & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal h-8 text-sm',
                      !watch('expiration_date') && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {watch('expiration_date')
                      ? format(new Date(watch('expiration_date')), 'dd/MM/yyyy')
                      : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch('expiration_date') ? new Date(watch('expiration_date')) : undefined}
                    onSelect={(date) =>
                      date && setValue('expiration_date', format(date, 'yyyy-MM-dd'))
                    }
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    locale={ptBR}
                    initialFocus
                  />
                  <div className="flex gap-1 p-2 border-t flex-wrap">
                    {[1, 3, 6, 12].map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => handleQuickAdd(m)}
                      >
                        +{m}m
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="app_price">Preço (R$)</Label>
              <Input
                id="app_price"
                type="number"
                step="0.01"
                {...register('app_price')}
                placeholder="0,00"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Anotações sobre o aplicativo..."
              className="min-h-[60px] text-sm"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || appTypes.length === 0}>
              {loading ? 'Salvando...' : mode === 'edit' ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
