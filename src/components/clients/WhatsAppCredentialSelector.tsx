import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MessageCircle, User, Lock, Server } from 'lucide-react';

interface Credential {
  index: number;
  serverName: string | null;
  login: string | null;
  password: string | null;
}

interface WhatsAppCredentialSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentials: Credential[];
  messageType: 'billing' | 'welcome' | 'renewal' | 'reminder';
  onSelect: (credential: Credential) => void;
}

const messageTypeLabels = {
  billing: 'Cobrança',
  welcome: 'Boas-vindas',
  renewal: 'Renovação',
  reminder: 'Lembrete',
};

export default function WhatsAppCredentialSelector({
  open,
  onOpenChange,
  credentials,
  messageType,
  onSelect,
}: WhatsAppCredentialSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const handleSend = () => {
    const selected = credentials.find((c) => c.index === selectedIndex);
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-500" />
            Selecionar Credencial - {messageTypeLabels[messageType]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Este cliente possui múltiplas credenciais. Selecione qual deseja enviar na mensagem:
          </p>

          <RadioGroup
            value={selectedIndex.toString()}
            onValueChange={(value) => setSelectedIndex(parseInt(value))}
            className="space-y-3"
          >
            {credentials.map((cred) => (
              <div
                key={cred.index}
                className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <RadioGroupItem value={cred.index.toString()} id={`cred-${cred.index}`} />
                <Label
                  htmlFor={`cred-${cred.index}`}
                  className="flex-1 cursor-pointer space-y-1"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Server className="w-4 h-4 text-primary" />
                    {cred.serverName || `Servidor ${cred.index + 1}`}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {cred.login && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {cred.login}
                      </span>
                    )}
                    {cred.password && (
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {cred.password}
                      </span>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="whatsapp"
            onClick={handleSend}
            className="gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
