import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Mail, Lock, Wifi, Hash, Cloud, Tv } from 'lucide-react';
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

const APP_TYPES = [
  { id: 'clouddy', label: 'Clouddy', icon: Cloud, usesEmail: true },
  { id: 'ibo_pro', label: 'IBO PRO', icon: Tv, usesEmail: false },
  { id: 'ibo_player', label: 'IBO PLAYER', icon: Tv, usesEmail: false },
] as const;

const appSchema = z.object({
  app_type: z.enum(['clouddy', 'ibo_pro', 'ibo_player']),
  email: z.string().optional(),
  password: z.string().optional(),
  mac_address: z.string().optional(),
  device_id: z.string().optional(),
  app_price: z.string().optional(),
  expiration_date: z.string().min(1, 'Data de vencimento é obrigatória'),
  notes: z.string().optional(),
});

type AppForm = z.infer<typeof appSchema>;

interface ClientAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
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
}

export default function ClientAppDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  existingApp,
  onSuccess,
}: ClientAppDialogProps) {
  const [loading, setLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const { encryptCredentials, decryptCredentials } = useCrypto();

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
      app_type: 'clouddy',
      expiration_date: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    },
  });

  const selectedAppType = watch('app_type');
  const selectedApp = APP_TYPES.find(a => a.id === selectedAppType);
  const usesEmail = selectedApp?.usesEmail ?? true;

  useEffect(() => {
    const loadExistingApp = async () => {
      if (existingApp) {
        // Decrypt credentials
        const decrypted = await decryptCredentials({
          login: existingApp.email,
          password: existingApp.password,
        });

        reset({
          app_type: existingApp.app_type as 'clouddy' | 'ibo_pro' | 'ibo_player',
          email: decrypted.login || '',
          password: decrypted.password || '',
          mac_address: existingApp.mac_address || '',
          device_id: existingApp.device_id || '',
          app_price: existingApp.app_price?.toString() || '',
          expiration_date: existingApp.expiration_date,
          notes: existingApp.notes || '',
        });
      } else {
        reset({
          app_type: 'clouddy',
          email: '',
          password: '',
          mac_address: '',
          device_id: '',
          app_price: '',
          expiration_date: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
          notes: '',
        });
      }
    };

    if (open) {
      loadExistingApp();
    }
  }, [existingApp, open, reset, decryptCredentials]);

  const onSubmit = async (data: AppForm) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Encrypt email/password for Clouddy
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

      const appData = {
        client_id: clientId,
        seller_id: user.id,
        app_type: data.app_type,
        email: encryptedEmail,
        password: encryptedPassword,
        mac_address: data.mac_address || null,
        device_id: data.device_id || null,
        app_price: data.app_price ? parseFloat(data.app_price) : null,
        expiration_date: data.expiration_date,
        notes: data.notes || null,
      };

      if (existingApp) {
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
        toast.success('Aplicativo cadastrado com sucesso!');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar aplicativo');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = (months: number) => {
    const newDate = addYears(new Date(), months / 12);
    setValue('expiration_date', format(newDate, 'yyyy-MM-dd'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingApp ? 'Editar Aplicativo' : 'Adicionar Aplicativo'}
            <span className="text-sm text-muted-foreground ml-2">({clientName})</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-2">
          {/* App Type */}
          <div className="space-y-2">
            <Label>Tipo de Aplicativo *</Label>
            <Select
              value={selectedAppType}
              onValueChange={(value) => setValue('app_type', value as 'clouddy' | 'ibo_pro' | 'ibo_player')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o aplicativo" />
              </SelectTrigger>
              <SelectContent>
                {APP_TYPES.map((app) => {
                  const Icon = app.icon;
                  return (
                    <SelectItem key={app.id} value={app.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {app.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Clouddy fields - Email/Password */}
          {usesEmail && (
            <div className="space-y-4 p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center gap-2 text-blue-500 text-sm font-medium">
                <Cloud className="h-4 w-4" />
                Credenciais Clouddy
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Senha
                  </Label>
                  <Input
                    id="password"
                    type="text"
                    {...register('password')}
                    placeholder="Senha do app"
                  />
                </div>
              </div>
            </div>
          )}

          {/* IBO fields - MAC/ID */}
          {!usesEmail && (
            <div className="space-y-4 p-3 rounded-lg border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center gap-2 text-purple-500 text-sm font-medium">
                <Tv className="h-4 w-4" />
                Credenciais {selectedApp?.label}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mac_address" className="flex items-center gap-1">
                    <Wifi className="h-3 w-3" /> MAC Address
                  </Label>
                  <Input
                    id="mac_address"
                    {...register('mac_address')}
                    placeholder="XX:XX:XX:XX:XX:XX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="device_id" className="flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Device ID
                  </Label>
                  <Input
                    id="device_id"
                    {...register('device_id')}
                    placeholder="ID do dispositivo"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="app_price">Valor do Aplicativo (R$)</Label>
            <Input
              id="app_price"
              type="number"
              step="0.01"
              {...register('app_price')}
              placeholder="0,00"
            />
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label>Vencimento do App *</Label>
            <Popover
              onOpenChange={(isOpen) => {
                if (isOpen) {
                  const currentValue = watch('expiration_date');
                  if (currentValue) {
                    setCalendarMonth(new Date(currentValue + 'T12:00:00'));
                  } else {
                    setCalendarMonth(new Date());
                  }
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !watch('expiration_date') && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {watch('expiration_date')
                    ? format(new Date(watch('expiration_date') + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex gap-1 p-2 border-b">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAdd(12)}
                  >
                    +1 ano
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAdd(24)}
                  >
                    +2 anos
                  </Button>
                </div>
                <Calendar
                  mode="single"
                  selected={
                    watch('expiration_date')
                      ? new Date(watch('expiration_date') + 'T12:00:00')
                      : undefined
                  }
                  onSelect={(date) => {
                    if (date) {
                      setValue('expiration_date', format(date, 'yyyy-MM-dd'));
                    }
                  }}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.expiration_date && (
              <p className="text-xs text-destructive">{errors.expiration_date.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Anotações sobre o aplicativo..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : existingApp ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
