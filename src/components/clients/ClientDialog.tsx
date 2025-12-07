import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().optional(),
  device: z.string().optional(),
  login: z.string().optional(),
  password: z.string().optional(),
  expiration_date: z.string().min(1, 'Data de vencimento é obrigatória'),
  plan_name: z.string().optional(),
  plan_price: z.string().optional(),
});

type ClientForm = z.infer<typeof clientSchema>;

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

  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        phone: client.phone || '',
        device: client.device || '',
        login: client.login || '',
        password: client.password || '',
        expiration_date: client.expiration_date,
        plan_name: client.plan_name || '',
        plan_price: client.plan_price?.toString() || '',
      });
    } else {
      reset({
        name: '',
        phone: '',
        device: '',
        login: '',
        password: '',
        expiration_date: '',
        plan_name: '',
        plan_price: '',
      });
    }
  }, [client, reset]);

  const onSubmit = async (data: ClientForm) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const clientData = {
        name: data.name,
        phone: data.phone || null,
        device: data.device || null,
        login: data.login || null,
        password: data.password || null,
        expiration_date: data.expiration_date,
        plan_name: data.plan_name || null,
        plan_price: data.plan_price ? parseFloat(data.plan_price) : null,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="device">Dispositivo</Label>
              <Input id="device" {...register('device')} placeholder="TV, Celular..." />
            </div>
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
                  <div className="p-2 border-b flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const oneMonthLater = addMonths(new Date(), 1);
                        setValue('expiration_date', format(oneMonthLater, 'yyyy-MM-dd'));
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
                      }}
                    >
                      +3 meses
                    </Button>
                  </div>
                  <Calendar
                    mode="single"
                    selected={watch('expiration_date') ? new Date(watch('expiration_date') + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setValue('expiration_date', format(date, 'yyyy-MM-dd'));
                      }
                    }}
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
