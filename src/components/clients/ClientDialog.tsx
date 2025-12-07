import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().optional(),
  device: z.string().optional(),
  login: z.string().optional(),
  password: z.string().optional(),
  expiration_date: z.string().min(1, 'Data de vencimento é obrigatória'),
  plan_id: z.string().optional(),
});

type ClientForm = z.infer<typeof clientSchema>;

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
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
    plan_id: string | null;
  } | null;
  onSuccess: () => void;
}

export default function ClientDialog({ open, onOpenChange, client, onSuccess }: ClientDialogProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
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

  const selectedPlanId = watch('plan_id');

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from('plans')
        .select('id, name, price, duration_days')
        .eq('is_active', true);
      if (data) setPlans(data);
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        phone: client.phone || '',
        device: client.device || '',
        login: client.login || '',
        password: client.password || '',
        expiration_date: client.expiration_date,
        plan_id: client.plan_id || '',
      });
    } else {
      reset({
        name: '',
        phone: '',
        device: '',
        login: '',
        password: '',
        expiration_date: '',
        plan_id: '',
      });
    }
  }, [client, reset]);

  const handlePlanChange = (planId: string) => {
    setValue('plan_id', planId);
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      const date = new Date();
      date.setDate(date.getDate() + plan.duration_days);
      setValue('expiration_date', date.toISOString().split('T')[0]);
    }
  };

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
        plan_id: data.plan_id || null,
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
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" {...register('phone')} placeholder="(00) 00000-0000" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan_id">Plano</Label>
            <Select value={selectedPlanId} onValueChange={handlePlanChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} - R$ {plan.price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="device">Dispositivo</Label>
              <Input id="device" {...register('device')} placeholder="TV, Celular..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiration_date">Vencimento *</Label>
              <Input id="expiration_date" type="date" {...register('expiration_date')} />
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
