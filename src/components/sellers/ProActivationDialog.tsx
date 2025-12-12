import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Crown, Calendar, Infinity, Sparkles, FileSpreadsheet, MessageCircle, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';

interface Seller {
  id: string;
  email: string;
  full_name: string | null;
  whatsapp: string | null;
}

interface ProActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: Seller | null;
  currentProStatus: {
    hasPro: boolean;
    expiresAt: string | null;
  };
  onSuccess: () => void;
}

export default function ProActivationDialog({
  open,
  onOpenChange,
  seller,
  currentProStatus,
  onSuccess
}: ProActivationDialogProps) {
  const [durationType, setDurationType] = useState<'days' | 'permanent'>('days');
  const [days, setDays] = useState('30');
  const [submitting, setSubmitting] = useState(false);

  const handleActivate = async () => {
    if (!seller) return;
    
    setSubmitting(true);
    try {
      let updateData: Record<string, unknown> = {
        has_pro_export: true
      };

      if (durationType === 'permanent') {
        updateData.pro_export_expires_at = null;
      } else {
        const expirationDate = addDays(new Date(), parseInt(days) || 30);
        updateData.pro_export_expires_at = expirationDate.toISOString();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', seller.id);

      if (error) throw error;

      const durationText = durationType === 'permanent' 
        ? 'permanentemente' 
        : `por ${days} dias`;
      
      toast.success(`Pro Export ativado ${durationText} para ${seller.full_name || seller.email}!`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error activating pro:', error);
      toast.error('Erro ao ativar Pro Export');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!seller) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          has_pro_export: false,
          pro_export_expires_at: null
        })
        .eq('id', seller.id);

      if (error) throw error;

      toast.success(`Pro Export desativado para ${seller.full_name || seller.email}`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deactivating pro:', error);
      toast.error('Erro ao desativar Pro Export');
    } finally {
      setSubmitting(false);
    }
  };

  if (!seller) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            Gerenciar Pro Export
          </DialogTitle>
          <DialogDescription>
            {currentProStatus.hasPro 
              ? `${seller.full_name || seller.email} possui acesso ao Pro Export`
              : `Ativar Pro Export para ${seller.full_name || seller.email}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Feature List */}
          <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              Recursos do Pro Export:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-500" />
                Links diretos para WhatsApp na planilha
              </li>
              <li className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                Templates de mensagens incluídos
              </li>
              <li className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                Resumo executivo automático
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                Status visual dos clientes
              </li>
            </ul>
          </div>

          {/* Current Status */}
          {currentProStatus.hasPro && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm">Status atual:</span>
              <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black">
                <Crown className="w-3 h-3 mr-1" />
                {currentProStatus.expiresAt 
                  ? `Expira em ${format(new Date(currentProStatus.expiresAt), 'dd/MM/yyyy')}`
                  : 'Permanente'
                }
              </Badge>
            </div>
          )}

          {/* Duration Selection */}
          <div className="space-y-3">
            <Label>Duração do acesso:</Label>
            <RadioGroup 
              value={durationType} 
              onValueChange={(value) => setDurationType(value as 'days' | 'permanent')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="days" id="days" />
                <Label htmlFor="days" className="flex-1 cursor-pointer flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Por período de dias
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="permanent" id="permanent" />
                <Label htmlFor="permanent" className="flex-1 cursor-pointer flex items-center gap-2">
                  <Infinity className="w-4 h-4 text-primary" />
                  Acesso permanente
                </Label>
              </div>
            </RadioGroup>
          </div>

          {durationType === 'days' && (
            <div className="space-y-2">
              <Label htmlFor="days-input">Número de dias:</Label>
              <Input
                id="days-input"
                type="number"
                min="1"
                max="365"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground">
                Expira em: {format(addDays(new Date(), parseInt(days) || 30), 'dd/MM/yyyy')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentProStatus.hasPro && (
            <Button 
              variant="destructive" 
              onClick={handleDeactivate}
              disabled={submitting}
              className="sm:mr-auto"
            >
              Desativar Pro
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant="gradient" 
            onClick={handleActivate}
            disabled={submitting}
            className="gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Crown className="w-4 h-4" />
                {currentProStatus.hasPro ? 'Atualizar Pro' : 'Ativar Pro'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
