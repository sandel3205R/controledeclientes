import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, FileText, Loader2 } from 'lucide-react';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  servers: { id: string; name: string }[];
}

interface ParsedClient {
  name: string;
  app_name: string | null;
  login: string | null;
  expiration_date: string;
  phone: string | null;
}

const EXAMPLE_FORMAT = `Nome: Maria Santos
Servidor: ULTRA TV PLUS
Usuário: 123456789
Vencimento: 20/01/2026
WhatsApp: +55 11 91234-5678

Nome: Carlos Oliveira
Servidor: MEGA PLAY HD
Usuário: 987654321
Vencimento: 15/02/2026
WhatsApp: +55 21 98765-4321`;

export default function BulkImportDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  servers 
}: BulkImportDialogProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ParsedClient[]>([]);

  const parseDate = (dateStr: string): string => {
    // Handle DD/MM/YYYY or DD-MM-YYYY format
    const parts = dateStr.trim().split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${month}-${day}`;
    }
    // Default to 30 days from now
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  const parseClients = (inputText: string): ParsedClient[] => {
    const clients: ParsedClient[] = [];
    
    // Split by double line breaks or by "Nome:" to separate clients
    const blocks = inputText.split(/\n\s*\n|(?=Nome:)/gi).filter(block => block.trim());
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const client: ParsedClient = {
        name: '',
        app_name: null,
        login: null,
        expiration_date: '',
        phone: null,
      };

      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        
        if (!key || !value) continue;

        const keyLower = key.trim().toLowerCase();

        if (keyLower === 'nome' || keyLower === 'name' || keyLower === 'cliente') {
          client.name = value;
        } else if (keyLower === 'servidor' || keyLower === 'server' || keyLower === 'app' || keyLower === 'aplicativo') {
          client.app_name = value;
        } else if (keyLower === 'usuário' || keyLower === 'usuario' || keyLower === 'user' || keyLower === 'login') {
          client.login = value;
        } else if (keyLower === 'vencimento' || keyLower === 'expiration' || keyLower === 'data' || keyLower === 'validade') {
          client.expiration_date = parseDate(value);
        } else if (keyLower === 'whatsapp' || keyLower === 'telefone' || keyLower === 'phone' || keyLower === 'celular') {
          client.phone = value;
        }
      }

      if (client.name) {
        // If no expiration date, set default 30 days
        if (!client.expiration_date) {
          const date = new Date();
          date.setDate(date.getDate() + 30);
          client.expiration_date = date.toISOString().split('T')[0];
        }
        clients.push(client);
      }
    }

    return clients;
  };

  const handlePreview = () => {
    const parsed = parseClients(text);
    setPreview(parsed);
    if (parsed.length === 0) {
      toast.error('Nenhum cliente encontrado. Verifique o formato.');
    } else {
      toast.success(`${parsed.length} cliente(s) detectado(s)`);
    }
  };

  const handleImport = async () => {
    const clients = parseClients(text);
    
    if (clients.length === 0) {
      toast.error('Nenhum cliente para importar');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let successCount = 0;
      let errorCount = 0;

      for (const client of clients) {
        // Try to match server by name
        let serverId: string | null = null;
        let serverName = client.app_name;
        
        if (client.app_name) {
          const matchedServer = servers.find(s => 
            s.name.toLowerCase().includes(client.app_name!.toLowerCase()) ||
            client.app_name!.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedServer) {
            serverId = matchedServer.id;
            serverName = matchedServer.name;
          }
        }

        const { error } = await supabase.from('clients').insert({
          seller_id: user.id,
          name: client.name,
          app_name: client.app_name,
          login: client.login,
          expiration_date: client.expiration_date,
          phone: client.phone,
          server_id: serverId,
          server_name: serverName,
        });

        if (error) {
          console.error('Error importing client:', client.name, error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} cliente(s) importado(s) com sucesso!`);
        onSuccess();
        onOpenChange(false);
        setText('');
        setPreview([]);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} cliente(s) falharam na importação`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao importar clientes');
    } finally {
      setLoading(false);
    }
  };

  const copyExample = () => {
    navigator.clipboard.writeText(EXAMPLE_FORMAT);
    toast.success('Formato copiado!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Clientes em Massa
          </DialogTitle>
          <DialogDescription>
            Cole os dados dos clientes no formato abaixo. Cada cliente deve ser separado por uma linha em branco.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Example format */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Formato:</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={copyExample}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copiar
              </Button>
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-background/50 p-2 rounded">
{EXAMPLE_FORMAT}
            </pre>
          </div>

          {/* Text input */}
          <div className="space-y-2">
            <Label htmlFor="bulk-text">Cole os dados aqui:</Label>
            <Textarea
              id="bulk-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPreview([]);
              }}
              placeholder={EXAMPLE_FORMAT}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preview ({preview.length} clientes):</Label>
              <div className="max-h-[150px] overflow-y-auto rounded-lg border bg-muted/30 p-2 space-y-2">
                {preview.map((client, index) => (
                  <div key={index} className="text-xs p-2 rounded bg-background border">
                    <div className="font-medium">{client.name}</div>
                    <div className="text-muted-foreground">
                      {client.app_name && <span>{client.app_name} • </span>}
                      {client.login && <span>User: {client.login} • </span>}
                      <span>Venc: {new Date(client.expiration_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      {client.phone && <span> • {client.phone}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handlePreview}
              disabled={!text.trim() || loading}
            >
              Visualizar
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleImport}
              disabled={!text.trim() || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                'Importar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
