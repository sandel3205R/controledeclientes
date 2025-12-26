import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Server, Tv, Smartphone, Monitor, DollarSign, Users } from 'lucide-react';
import { useSharedPanels, SharedPanel } from '@/hooks/useSharedPanels';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useCrypto } from '@/hooks/useCrypto';

const DEVICE_OPTIONS = [
  { id: 'TV SMART', label: 'TV Smart', icon: Tv },
  { id: 'CELULAR', label: 'Celular', icon: Smartphone },
  { id: 'COMPUTADOR', label: 'Computador', icon: Monitor },
] as const;
const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  device: z.string().optional(),
  login: z.string().optional(),
  password: z.string().optional(),
  login2: z.string().optional(),
  password2: z.string().optional(),
  login3: z.string().optional(),
  password3: z.string().optional(),
  login4: z.string().optional(),
  password4: z.string().optional(),
  login5: z.string().optional(),
  password5: z.string().optional(),
  expiration_date: z.string().min(1, 'Data de vencimento é obrigatória'),
  plan_name: z.string().optional(),
  plan_price: z.string().optional(),
  app_name: z.string().optional(),
  mac_address: z.string().optional(),
  server_name: z.string().optional(),
  server_id: z.string().optional(),
  is_paid: z.boolean().optional(),
  screens: z.string().optional(),
});

type ClientForm = z.infer<typeof clientSchema>;

interface ServerOption {
  id: string;
  name: string;
}

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: {
    id: string;
    name: string;
    phone: string | null;
    email?: string | null;
    device: string | null;
    login: string | null;
    password: string | null;
    login2?: string | null;
    password2?: string | null;
    login3?: string | null;
    password3?: string | null;
    login4?: string | null;
    password4?: string | null;
    login5?: string | null;
    password5?: string | null;
    expiration_date: string;
    plan_name: string | null;
    plan_price: number | null;
    app_name: string | null;
    mac_address: string | null;
    server_name: string | null;
    server_id?: string | null;
    is_paid?: boolean | null;
    screens?: number | null;
  } | null;
  onSuccess: () => void;
}

// Format phone number as +55 31 95555-5555
const formatWhatsApp = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  
  let formatted = '+';
  
  if (digits.length <= 2) {
    formatted += digits;
  } else if (digits.length <= 4) {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2)}`;
  } else if (digits.length <= 9) {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  } else {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }
  
  return formatted;
};

export default function ClientDialog({ open, onOpenChange, client, onSuccess }: ClientDialogProps) {
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [customDevice, setCustomDevice] = useState('');
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [isPaid, setIsPaid] = useState(true);
  const [annualMonthlyRenewal, setAnnualMonthlyRenewal] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const { encryptCredentials } = useCrypto();
  const { panels, fetchPanels } = useSharedPanels();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsApp(e.target.value);
    setValue('phone', formatted);
  };

  const fetchServers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('servers')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (data) setServers(data);
  };

  useEffect(() => {
    if (open) {
      fetchServers();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return; // Only reset when dialog opens
    
    if (client) {
      // Parse device string to extract predefined devices and custom device
      const deviceString = client.device || '';
      const deviceList = deviceString.split(',').map(d => d.trim()).filter(Boolean);
      const predefinedIds: string[] = DEVICE_OPTIONS.map(d => d.id);
      const predefined = deviceList.filter(d => predefinedIds.includes(d));
      const custom = deviceList.filter(d => !predefinedIds.includes(d)).join(', ');
      
      setSelectedDevices(predefined);
      setCustomDevice(custom);
      setIsPaid(client.is_paid !== false);
      setAnnualMonthlyRenewal((client as any).is_annual_paid === true);
      setSelectedPanelId((client as any).shared_panel_id || null);
      
      // Parse server_ids array or fallback to server_id
      const serverIds = (client as any).server_ids || [];
      if (serverIds.length > 0) {
        setSelectedServers(serverIds);
      } else if (client.server_id) {
        setSelectedServers([client.server_id]);
      } else {
        setSelectedServers([]);
      }

      reset({
        name: client.name,
        phone: client.phone || '',
        email: (client as any).email || '',
        device: client.device || '',
        login: client.login || '',
        password: client.password || '',
        login2: client.login2 || '',
        password2: client.password2 || '',
        login3: client.login3 || '',
        password3: client.password3 || '',
        login4: (client as any).login4 || '',
        password4: (client as any).password4 || '',
        login5: (client as any).login5 || '',
        password5: (client as any).password5 || '',
        expiration_date: client.expiration_date,
        plan_name: client.plan_name || '',
        plan_price: client.plan_price?.toString() || '',
        app_name: client.app_name || '',
        mac_address: client.mac_address || '',
        server_name: client.server_name || '',
        server_id: client.server_id || '',
        is_paid: client.is_paid !== false,
        screens: client.screens?.toString() || '1',
      });
    } else {
      setSelectedDevices([]);
      setCustomDevice('');
      setSelectedServers([]);
      setIsPaid(true);
      setAnnualMonthlyRenewal(false);
      setSelectedPanelId(null);
      reset({
        name: '',
        phone: '',
        email: '',
        device: '',
        login: '',
        password: '',
        login2: '',
        password2: '',
        login3: '',
        password3: '',
        login4: '',
        password4: '',
        login5: '',
        password5: '',
        expiration_date: '',
        plan_name: '',
        plan_price: '',
        app_name: '',
        mac_address: '',
        server_name: '',
        server_id: '',
        is_paid: true,
        screens: '1',
      });
    }
  }, [open, client, reset]);

  const handleDeviceChange = (deviceId: string, checked: boolean) => {
    setSelectedDevices(prev => 
      checked 
        ? [...prev, deviceId]
        : prev.filter(d => d !== deviceId)
    );
  };

  const getDeviceString = () => {
    const devices = [...selectedDevices];
    if (customDevice.trim()) {
      devices.push(customDevice.trim());
    }
    return devices.join(', ');
  };

  const handleServerChange = (serverId: string, checked: boolean) => {
    setSelectedServers(prev => {
      if (checked) {
        if (prev.length >= 5) {
          toast.error('Máximo de 5 servidores permitidos');
          return prev;
        }
        return [...prev, serverId];
      }
      return prev.filter(id => id !== serverId);
    });
  };

  // Get server name by id
  const getServerName = (serverId: string) => {
    return servers.find(s => s.id === serverId)?.name || '';
  };

  const onSubmit = async (data: ClientForm) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Get selected server names
      const selectedServerNames = selectedServers
        .map(id => servers.find(s => s.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      
      // Build device string from checkboxes and custom input
      const deviceString = getDeviceString();

      // Combine selected server names with any additional premium accounts
      const allServerNames = [selectedServerNames, data.server_name].filter(Boolean).join(', ');
      
      // Use first selected server for server_id (for backwards compatibility)
      const primaryServerId = selectedServers.length > 0 ? selectedServers[0] : null;

      // Encrypt credentials before saving
      const encryptedCredentials = await encryptCredentials({
        login: data.login || null,
        password: data.password || null,
        login2: data.login2 || null,
        password2: data.password2 || null,
        login3: data.login3 || null,
        password3: data.password3 || null,
        login4: data.login4 || null,
        password4: data.password4 || null,
        login5: data.login5 || null,
        password5: data.password5 || null,
      });

      const clientData = {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        device: deviceString || null,
        login: encryptedCredentials.login || null,
        password: encryptedCredentials.password || null,
        login2: encryptedCredentials.login2 || null,
        password2: encryptedCredentials.password2 || null,
        login3: encryptedCredentials.login3 || null,
        password3: encryptedCredentials.password3 || null,
        login4: encryptedCredentials.login4 || null,
        password4: encryptedCredentials.password4 || null,
        login5: encryptedCredentials.login5 || null,
        password5: encryptedCredentials.password5 || null,
        expiration_date: data.expiration_date,
        plan_name: data.plan_name || null,
        plan_price: data.plan_price ? parseFloat(data.plan_price) : null,
        app_name: data.app_name || null,
        mac_address: data.mac_address || null,
        server_name: allServerNames || null,
        server_id: primaryServerId,
        server_ids: selectedServers,
        seller_id: user.id,
        is_paid: isPaid,
        is_annual_paid: annualMonthlyRenewal,
        shared_panel_id: selectedPanelId,
        screens: data.screens ? parseInt(data.screens) : 1,
      };

      if (client) {
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', client.id);
        if (error) throw error;
        toast.success('Cliente atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([clientData]);
        if (error) throw error;
        toast.success('Cliente criado com sucesso!');
      }

      // Refresh client list and close dialog
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...register('name')} placeholder="Nome do cliente" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input 
                id="phone" 
                value={watch('phone') || ''}
                onChange={handlePhoneChange}
                placeholder="+55 31 95555-5555" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email"
                {...register('email')} 
                placeholder="email@exemplo.com" 
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan_name">Plano</Label>
              <Input id="plan_name" {...register('plan_name')} placeholder="Nome do plano" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan_price">Valor (R$)</Label>
              <Input 
                id="plan_price" 
                type="number" 
                step="0.01" 
                {...register('plan_price')} 
                placeholder="0,00" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="screens">Telas</Label>
              <Input 
                id="screens" 
                type="number" 
                min="1"
                max="10"
                {...register('screens')} 
                placeholder="1" 
              />
            </div>
          </div>

          {/* Payment Status */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
            <div className="flex items-center gap-2">
              <DollarSign className={cn("h-4 w-4", isPaid ? "text-green-500" : "text-red-500")} />
              <Label htmlFor="is_paid" className="font-medium cursor-pointer">
                Status do Pagamento
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-medium", !isPaid ? "text-red-500" : "text-muted-foreground")}>
                Não Pago
              </span>
              <Switch
                id="is_paid"
                checked={isPaid}
                onCheckedChange={setIsPaid}
              />
              <span className={cn("text-sm font-medium", isPaid ? "text-green-500" : "text-muted-foreground")}>
                Pago
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Dispositivo</Label>
            <div className="flex flex-wrap gap-4">
              {DEVICE_OPTIONS.map((device) => {
                const Icon = device.icon;
                return (
                  <div key={device.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={device.id}
                      checked={selectedDevices.includes(device.id)}
                      onCheckedChange={(checked) => handleDeviceChange(device.id, checked as boolean)}
                    />
                    <label
                      htmlFor={device.id}
                      className="flex items-center gap-1.5 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {device.label}
                    </label>
                  </div>
                );
              })}
            </div>
            <Input
              value={customDevice}
              onChange={(e) => setCustomDevice(e.target.value)}
              placeholder="Outro dispositivo..."
              className="mt-2"
            />
          </div>

          <div className="space-y-2">
            <Label>Vencimento *</Label>
            <Popover onOpenChange={(open) => {
              if (open) {
                // When opening, set calendar to show the selected date's month or current month
                const currentValue = watch('expiration_date');
                if (currentValue) {
                  setCalendarMonth(new Date(currentValue + 'T12:00:00'));
                } else {
                  setCalendarMonth(new Date());
                }
              }
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !watch('expiration_date') && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {watch('expiration_date') ? (
                    format(new Date(watch('expiration_date') + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione a data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0" 
                align="center" 
                side="bottom"
                sideOffset={4}
              >
                <div className="p-1.5 border-b grid grid-cols-5 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[10px] px-1 h-7"
                    onClick={() => {
                      const oneMonthLater = addMonths(new Date(), 1);
                      setValue('expiration_date', format(oneMonthLater, 'yyyy-MM-dd'));
                      setCalendarMonth(oneMonthLater);
                    }}
                  >
                    +1m
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[10px] px-1 h-7"
                    onClick={() => {
                      const twoMonthsLater = addMonths(new Date(), 2);
                      setValue('expiration_date', format(twoMonthsLater, 'yyyy-MM-dd'));
                      setCalendarMonth(twoMonthsLater);
                    }}
                  >
                    +2m
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[10px] px-1 h-7"
                    onClick={() => {
                      const threeMonthsLater = addMonths(new Date(), 3);
                      setValue('expiration_date', format(threeMonthsLater, 'yyyy-MM-dd'));
                      setCalendarMonth(threeMonthsLater);
                    }}
                  >
                    +3m
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[10px] px-1 h-7"
                    onClick={() => {
                      const sixMonthsLater = addMonths(new Date(), 6);
                      setValue('expiration_date', format(sixMonthsLater, 'yyyy-MM-dd'));
                      setCalendarMonth(sixMonthsLater);
                    }}
                  >
                    +6m
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[10px] px-1 h-7"
                    onClick={() => {
                      // If annual with monthly renewal, add only 30 days
                      // Otherwise add full 12 months
                      const newDate = annualMonthlyRenewal 
                        ? addDays(new Date(), 30)
                        : addMonths(new Date(), 12);
                      setValue('expiration_date', format(newDate, 'yyyy-MM-dd'));
                      setCalendarMonth(newDate);
                    }}
                  >
                    {annualMonthlyRenewal ? '+30d' : '+1a'}
                  </Button>
                </div>
                {/* Annual with monthly renewal option */}
                <div className="px-2 py-1.5 border-b flex items-center justify-between">
                  <Label htmlFor="annual-monthly" className="text-xs text-muted-foreground cursor-pointer">
                    Plano Anual com renovação mensal (30 dias)
                  </Label>
                  <Switch
                    id="annual-monthly"
                    checked={annualMonthlyRenewal}
                    onCheckedChange={setAnnualMonthlyRenewal}
                    className="scale-75"
                  />
                </div>
                <Calendar
                  mode="single"
                  selected={watch('expiration_date') ? new Date(watch('expiration_date') + 'T12:00:00') : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setValue('expiration_date', format(date, 'yyyy-MM-dd'));
                      setCalendarMonth(date);
                    }
                  }}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  locale={ptBR}
                  initialFocus
                  className="pointer-events-auto p-2"
                  classNames={{
                    months: "flex flex-col",
                    month: "space-y-2",
                    caption: "flex justify-center pt-1 relative items-center",
                    caption_label: "text-xs font-medium",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse",
                    head_row: "flex",
                    head_cell: "text-muted-foreground rounded-md w-7 font-normal text-[10px]",
                    row: "flex w-full mt-1",
                    cell: "h-7 w-7 text-center text-xs p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-7 w-7 p-0 font-normal text-xs aria-selected:opacity-100 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground",
                    day_outside: "text-muted-foreground opacity-50",
                    day_disabled: "text-muted-foreground opacity-50",
                    day_hidden: "invisible",
                  }}
                />
              </PopoverContent>
            </Popover>
            {errors.expiration_date && (
              <p className="text-xs text-destructive">{errors.expiration_date.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Servidores (máx. 5)</Label>
            <div className="space-y-2 p-3 border rounded-md bg-muted/30">
              {servers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum servidor cadastrado</p>
              ) : (
                servers.map((server) => {
                  const serverIndex = selectedServers.indexOf(server.id);
                  const isSelected = serverIndex !== -1;
                  return (
                    <div key={server.id} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`server-${server.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => handleServerChange(server.id, checked as boolean)}
                        />
                        <label
                          htmlFor={`server-${server.id}`}
                          className="flex items-center gap-1.5 text-sm font-medium leading-none cursor-pointer"
                        >
                          <Server className="h-4 w-4 text-muted-foreground" />
                          {server.name}
                        </label>
                      </div>
                      {isSelected && (
                        <div className="ml-6 grid grid-cols-2 gap-2">
                          <Input
                            placeholder={`Login - ${server.name}`}
                            className="h-8 text-xs"
                            {...register(serverIndex === 0 ? 'login' : serverIndex === 1 ? 'login2' : serverIndex === 2 ? 'login3' : serverIndex === 3 ? 'login4' : 'login5')}
                          />
                          <Input
                            placeholder={`Senha - ${server.name}`}
                            className="h-8 text-xs"
                            {...register(serverIndex === 0 ? 'password' : serverIndex === 1 ? 'password2' : serverIndex === 2 ? 'password3' : serverIndex === 3 ? 'password4' : 'password5')}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="app_name">Aplicativo</Label>
              <Input id="app_name" {...register('app_name')} placeholder="Nome do app" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mac_address">MAC</Label>
              <Input id="mac_address" {...register('mac_address')} placeholder="00:00:00:00:00:00" />
            </div>
          </div>

          {/* Shared Panel Selection */}
          {panels.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Painel Compartilhado
              </Label>
              <Select
                value={selectedPanelId || 'none'}
                onValueChange={(value) => setSelectedPanelId(value === 'none' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar painel (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {panels.map((panel) => {
                    const filledSlots = panel.filled_slots || 0;
                    const availableSlots = panel.total_slots - filledSlots;
                    return (
                      <SelectItem key={panel.id} value={panel.id}>
                        {panel.name} ({filledSlots}/{panel.total_slots} - {availableSlots > 0 ? `${availableSlots} vaga(s)` : 'Completo'})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vincule a um crédito compartilhado para controlar vagas
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="server_name">Contas Premium</Label>
            <Input id="server_name" {...register('server_name')} placeholder="Ex: Conta Netflix, Spotify..." />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="gradient" className="flex-1" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
