import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, FileText } from 'lucide-react';

interface MessageTypeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: 'whatsapp' | 'telegram';
  onSelect: (useTemplate: boolean) => void;
}

export default function MessageTypeSelector({ 
  open, 
  onOpenChange, 
  platform,
  onSelect 
}: MessageTypeSelectorProps) {
  const platformName = platform === 'whatsapp' ? 'WhatsApp' : 'Telegram';
  const platformColor = platform === 'whatsapp' ? 'green' : 'sky';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Tipo de Mensagem</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Como deseja enviar a mensagem via {platformName}?
        </p>
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className={`h-16 justify-start gap-3 bg-${platformColor}-500/10 border-${platformColor}-500/20 text-${platformColor}-500 hover:bg-${platformColor}-500/20`}
            onClick={() => {
              onSelect(false);
              onOpenChange(false);
            }}
          >
            <MessageCircle className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Mensagem Normal</div>
              <div className="text-xs opacity-70">Abrir conversa vazia</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className={`h-16 justify-start gap-3 bg-${platformColor}-500/10 border-${platformColor}-500/20 text-${platformColor}-500 hover:bg-${platformColor}-500/20`}
            onClick={() => {
              onSelect(true);
              onOpenChange(false);
            }}
          >
            <FileText className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Mensagem Personalizada</div>
              <div className="text-xs opacity-70">Usar template salvo</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
