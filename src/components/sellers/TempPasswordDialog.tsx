import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Key, MessageCircle, Copy, Clock, AlertTriangle } from 'lucide-react';

interface TempPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: {
    id: string;
    full_name: string | null;
    email: string;
    whatsapp?: string | null;
  } | null;
  onSuccess?: () => void;
}

export function TempPasswordDialog({ open, onOpenChange, seller, onSuccess }: TempPasswordDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const generateTempPassword = async () => {
    if (!seller) return;

    setGenerating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-temp-password', {
        body: {
          seller_id: seller.id,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      setTempPassword(result.temp_password);
      setExpiresAt(result.expires_at);
      toast.success('Senha temporária gerada com sucesso!');
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar senha temporária';
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      toast.success('Senha copiada!');
    }
  };

  const sendWhatsApp = () => {
    if (!seller?.whatsapp || !tempPassword) return;
    
    const phone = seller.whatsapp.replace(/\D/g, '');
    const sellerName = seller.full_name || 'Vendedor';
    const expirationTime = expiresAt ? new Date(expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    
    const message = `🔐 *SENHA TEMPORÁRIA*

Olá ${sellerName}!

Sua senha temporária foi gerada com sucesso.

📧 *E-mail:* ${seller.email}
🔑 *Senha:* ${tempPassword}

⚠️ *IMPORTANTE:*
• Esta senha expira em 4 horas (até ${expirationTime})
• Faça login e altere sua senha imediatamente
• Por segurança, não compartilhe esta senha

Qualquer dúvida, estamos à disposição!
SANDEL`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleClose = () => {
    setTempPassword(null);
    setExpiresAt(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-yellow-500" />
            Gerar Senha Temporária
          </DialogTitle>
          <DialogDescription>
            Gerar senha temporária para: <strong>{seller?.full_name || seller?.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!tempPassword ? (
            <>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 space-y-2">
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Atenção</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Uma senha temporária será gerada e enviada ao vendedor. 
                  Esta senha expira automaticamente em <strong>4 horas</strong>.
                </p>
                <p className="text-sm text-muted-foreground">
                  O vendedor deverá fazer login e alterar a senha imediatamente.
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={generateTempPassword}
                  disabled={generating}
                >
                  {generating ? 'Gerando...' : 'Gerar Senha'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Senha Temporária:</span>
                  <Badge variant="secondary" className="font-mono text-lg px-3 py-1">
                    {tempPassword}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expira em:</span>
                  <Badge className="bg-yellow-500/20 text-yellow-600">
                    <Clock className="w-3 h-3 mr-1" />
                    4 horas
                  </Badge>
                </div>
                {expiresAt && (
                  <p className="text-xs text-muted-foreground text-center">
                    Válida até: {new Date(expiresAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={copyPassword}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Senha
                </Button>
                
                {seller?.whatsapp && (
                  <Button variant="whatsapp" onClick={sendWhatsApp}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Enviar por WhatsApp
                  </Button>
                )}
                
                {!seller?.whatsapp && (
                  <p className="text-xs text-muted-foreground text-center">
                    Vendedor sem WhatsApp cadastrado. Copie a senha e envie manualmente.
                  </p>
                )}
              </div>

              <Button variant="outline" className="w-full" onClick={handleClose}>
                Fechar
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
