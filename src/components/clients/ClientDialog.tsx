import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Server, Tv, Smartphone, Monitor } from 'lucide-react';
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

const DEVICE_OPTIONS = [
  { id: 'TV SMART', label: 'TV Smart', icon: Tv },
  { id: 'CELULAR', label: 'Celular', icon: Smartphone },
  { id: 'COMPUTADOR', label: 'Computador', icon: Monitor },
] as const;
const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().optional(),
  device: z.string().optional(),
  login: z.string().optional(),
  password: z.string().optional(),
  expiration_date: z.string().min(1, 'Data de vencimento é obrigatória'),
  plan_name: z.string().optional(),
  plan_price: z.string().optional(),
  app_name: z.string().optional(),
  mac_address: z.string().optional(),
  server_name: z.string().optional(),
  server_id: z.string().optional(),
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
    device: string | null;
    login: string | null;
    password: string | null;
    expiration_date: string;
    plan_name: string | null;
    plan_price: number | null;
    app_name: string | null;
    mac_address: string | null;
    server_name: string | null;
    server_id?: string | null;
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
    if (client) {
      // Parse device string to extract predefined devices and custom device
      const deviceString = client.device || '';
      const deviceList = deviceString.split(',').map(d => d.trim()).filter(Boolean);
      const predefinedIds: string[] = DEVICE_OPTIONS.map(d => d.id);
      const predefined = deviceList.filter(d => predefinedIds.includes(d));
      const custom = deviceList.filter(d => !predefinedIds.includes(d)).join(', ');
      
      setSelectedDevices(predefined);
      setCustomDevice(custom);
      
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
        device: client.device || '',
        login: client.login || '',
        password: client.password || '',
        expiration_date: client.expiration_date,
        plan_name: client.plan_name || '',
        plan_price: client.plan_price?.toString() || '',
        app_name: client.app_name || '',
        mac_address: client.mac_address || '',
        server_name: client.server_name || '',
        server_id: client.server_id || '',
      });
    } else {
      setSelectedDevices([]);
      setCustomDevice('');
      setSelectedServers([]);
      reset({
        name: '',
        phone: '',
        device: '',
        login: '',
        password: '',
        expiration_date: '',
        plan_name: '',
        plan_price: '',
        app_name: '',
        mac_address: '',
        server_name: '',
        server_id: '',
      });
    }
  }, [client, reset]);

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
        if (prev.length >= 3) {
          toast.error('Máximo de 3 servidores permitidos');
          return prev;
        }
        return [...prev, serverId];
      }
      return prev.filter(id => id !== serverId);
    });
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

      const clientData = {
        name: data.name,
        phone: data.phone || null,
        device: deviceString || null,
        login: data.login || null,
        password: data.password || null,
        expiration_date: data.expiration_date,
        plan_name: data.plan_name || null,
        plan_price: data.plan_price ? parseFloat(data.plan_price) : null,
        app_name: data.app_name || null,
        mac_address: data.mac_address || null,
        server_name: allServerNames || null,
        server_id: primaryServerId,
        server_ids: selectedServers,
        seller_id: user.id,
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

          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp</Label>
            <Input 
              id="phone" 
              value={watch('phone') || ''}
              onChange={handlePhoneChange}
              placeholder="+55 31 95555-5555" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Popover>
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
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-2 border-b flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const oneMonthLater = addMonths(new Date(), 1);
                        setValue('expiration_date', format(oneMonthLater, 'yyyy-MM-dd'));
                        setCalendarMonth(oneMonthLater);
                      }}
                    >
                      +1 mês
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const twoMonthsLater = addMonths(new Date(), 2);
                        setValue('expiration_date', format(twoMonthsLater, 'yyyy-MM-dd'));
                        setCalendarMonth(twoMonthsLater);
                      }}
                    >
                      +2 meses
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const threeMonthsLater = addMonths(new Date(), 3);
                        setValue('expiration_date', format(threeMonthsLater, 'yyyy-MM-dd'));
                        setCalendarMonth(threeMonthsLater);
                      }}
                    >
                      +3 meses
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const sixMonthsLater = addMonths(new Date(), 6);
                        setValue('expiration_date', format(sixMonthsLater, 'yyyy-MM-dd'));
                        setCalendarMonth(sixMonthsLater);
                      }}
                    >
                      +6 meses
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const oneYearLater = addMonths(new Date(), 12);
                        setValue('expiration_date', format(oneYearLater, 'yyyy-MM-dd'));
                        setCalendarMonth(oneYearLater);
                      }}
                    >
                      +1 ano
                    </Button>
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
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {errors.expiration_date && (
                <p className="text-xs text-destructive">{errors.expiration_date.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="login">Login</Label>
              <Input id="login" {...register('login')} placeholder="Login de acesso" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" {...register('password')} placeholder="Senha de acesso" />
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

          <div className="space-y-3">
            <Label>Servidores (máx. 3)</Label>
            <div className="space-y-2 p-3 border rounded-md bg-muted/30">
              {servers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum servidor cadastrado</p>
              ) : (
                servers.map((server) => (
                  <div key={server.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`server-${server.id}`}
                      checked={selectedServers.includes(server.id)}
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
                ))
              )}
            </div>
          </div>

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
