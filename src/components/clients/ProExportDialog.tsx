import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Crown, Download, MessageCircle, FileSpreadsheet, Sparkles, Lock } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Client {
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
  server_id: string | null;
  created_at: string | null;
  notes?: string | null;
}

interface WhatsAppTemplate {
  id: string;
  type: string;
  name: string;
  message: string;
  is_default: boolean;
}

interface ProExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  templates: WhatsAppTemplate[];
  hasProAccess: boolean;
  sellerName?: string;
}

export default function ProExportDialog({ 
  open, 
  onOpenChange, 
  clients, 
  templates,
  hasProAccess,
  sellerName = 'Vendedor'
}: ProExportDialogProps) {
  const [includeWhatsAppLinks, setIncludeWhatsAppLinks] = useState(true);
  const [includeTemplates, setIncludeTemplates] = useState(true);
  const [includeStatus, setIncludeStatus] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [exporting, setExporting] = useState(false);

  const getClientStatus = (expDate: string): string => {
    const date = new Date(expDate);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return '🔴 Expirado';
    if (diffDays <= 3) return '🟠 Expirando Hoje';
    if (diffDays <= 7) return '🟡 Expirando em Breve';
    return '🟢 Ativo';
  };

  const formatWhatsAppLink = (phone: string | null): string => {
    if (!phone) return '';
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}`;
  };

  const generateMessage = (client: Client, template: WhatsAppTemplate): string => {
    let message = template.message;
    message = message.replace(/{nome}/gi, client.name);
    message = message.replace(/{vencimento}/gi, format(new Date(client.expiration_date), 'dd/MM/yyyy'));
    message = message.replace(/{plano}/gi, client.plan_name || 'Não definido');
    message = message.replace(/{valor}/gi, client.plan_price ? `R$ ${client.plan_price.toFixed(2)}` : 'Não definido');
    message = message.replace(/{app}/gi, client.app_name || '');
    message = message.replace(/{servidor}/gi, client.server_name || '');
    return message;
  };

  const handleExport = async () => {
    if (!hasProAccess) {
      toast.error('Você não tem acesso ao Exportar Pro. Contate o administrador.');
      return;
    }

    setExporting(true);

    try {
      // Prepare main data
      const exportData = clients.map((client) => {
        const baseData: Record<string, string | number> = {
          'Nome': client.name,
          'Telefone': client.phone || '',
          'Plano': client.plan_name || '',
          'Valor (R$)': client.plan_price || 0,
          'Vencimento': format(new Date(client.expiration_date), 'dd/MM/yyyy'),
          'Dispositivo': client.device || '',
          'Login': client.login || '',
          'Senha': client.password || '',
          'Aplicativo': client.app_name || '',
          'MAC Address': client.mac_address || '',
          'Servidor': client.server_name || '',
          'Cadastrado em': client.created_at ? format(new Date(client.created_at), 'dd/MM/yyyy') : '',
        };

        if (includeStatus) {
          baseData['Status'] = getClientStatus(client.expiration_date);
        }

        if (includeWhatsAppLinks && client.phone) {
          baseData['Link WhatsApp'] = formatWhatsAppLink(client.phone);
        }

        if (includeNotes) {
          baseData['Observações'] = client.notes || '';
        }

        return baseData;
      });

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Main clients sheet with styling
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 25 }, // Nome
        { wch: 18 }, // Telefone
        { wch: 15 }, // Plano
        { wch: 12 }, // Valor
        { wch: 12 }, // Vencimento
        { wch: 15 }, // Dispositivo
        { wch: 15 }, // Login
        { wch: 15 }, // Senha
        { wch: 15 }, // Aplicativo
        { wch: 18 }, // MAC
        { wch: 15 }, // Servidor
        { wch: 12 }, // Cadastrado
        { wch: 15 }, // Status
        { wch: 40 }, // Link WhatsApp
        { wch: 30 }, // Observações
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

      // Add templates sheet if selected
      if (includeTemplates && templates.length > 0) {
        const templatesData = templates.map((t) => ({
          'Tipo': t.type === 'expiring' ? 'Vencendo' : t.type === 'expired' ? 'Expirado' : t.type === 'renewal' ? 'Renovação' : t.type,
          'Nome': t.name,
          'Mensagem': t.message,
          'Padrão': t.is_default ? 'Sim' : 'Não',
        }));
        
        const wsTemplates = XLSX.utils.json_to_sheet(templatesData);
        wsTemplates['!cols'] = [
          { wch: 15 },
          { wch: 20 },
          { wch: 80 },
          { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(wb, wsTemplates, 'Templates WhatsApp');
      }

      // Add summary sheet
      const activeClients = clients.filter(c => {
        const date = new Date(c.expiration_date);
        return date >= new Date();
      });
      const expiringClients = clients.filter(c => {
        const date = new Date(c.expiration_date);
        const diffDays = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      });
      const expiredClients = clients.filter(c => {
        const date = new Date(c.expiration_date);
        return date < new Date();
      });
      const totalRevenue = clients.reduce((sum, c) => sum + (c.plan_price || 0), 0);

      const summaryData = [
        { 'Métrica': 'Total de Clientes', 'Valor': clients.length },
        { 'Métrica': 'Clientes Ativos', 'Valor': activeClients.length },
        { 'Métrica': 'Clientes Expirando (7 dias)', 'Valor': expiringClients.length },
        { 'Métrica': 'Clientes Expirados', 'Valor': expiredClients.length },
        { 'Métrica': 'Receita Mensal Total', 'Valor': `R$ ${totalRevenue.toFixed(2)}` },
        { 'Métrica': 'Exportado por', 'Valor': sellerName },
        { 'Métrica': 'Data de Exportação', 'Valor': format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) },
      ];

      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [
        { wch: 30 },
        { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

      // Generate filename with date
      const fileName = `clientes_pro_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, fileName);
      
      toast.success('Planilha Pro exportada com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar planilha');
    } finally {
      setExporting(false);
    }
  };

  if (!hasProAccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-muted-foreground" />
              Exportar Pro
              <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black">
                <Crown className="w-3 h-3 mr-1" />
                PRO
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Você não tem acesso a esta funcionalidade.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Crown className="w-10 h-10 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Recurso Pro Bloqueado</h3>
              <p className="text-sm text-muted-foreground">
                Para ativar o Exportar Pro, entre em contato com o administrador.
              </p>
            </div>
            <div className="text-left bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">O que você ganha com o Pro:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  Links diretos para WhatsApp
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  Templates de mensagens incluídos
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  Resumo executivo automático
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  Status visual dos clientes
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Exportar Pro
            <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black">
              <Crown className="w-3 h-3 mr-1" />
              PRO
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Exporte uma planilha profissional com links de WhatsApp e resumo executivo.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Clientes a exportar:</p>
            <p className="text-2xl font-bold text-primary">{clients.length} clientes</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Incluir na planilha:</p>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="whatsapp-links" 
                checked={includeWhatsAppLinks}
                onCheckedChange={(checked) => setIncludeWhatsAppLinks(!!checked)}
              />
              <Label htmlFor="whatsapp-links" className="flex items-center gap-2 cursor-pointer">
                <MessageCircle className="w-4 h-4 text-green-500" />
                Links diretos para WhatsApp
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="templates" 
                checked={includeTemplates}
                onCheckedChange={(checked) => setIncludeTemplates(!!checked)}
              />
              <Label htmlFor="templates" className="flex items-center gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                Aba com templates de mensagens ({templates.length} templates)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="status" 
                checked={includeStatus}
                onCheckedChange={(checked) => setIncludeStatus(!!checked)}
              />
              <Label htmlFor="status" className="flex items-center gap-2 cursor-pointer">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                Status visual dos clientes (🟢🟡🔴)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="notes" 
                checked={includeNotes}
                onCheckedChange={(checked) => setIncludeNotes(!!checked)}
              />
              <Label htmlFor="notes" className="flex items-center gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-purple-500" />
                Observações dos clientes
              </Label>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <p>A planilha incluirá automaticamente:</p>
            <ul className="mt-1 space-y-0.5 ml-4 list-disc">
              <li>Todos os dados dos clientes</li>
              <li>Aba de resumo executivo</li>
              <li>Data e hora da exportação</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant="gradient" 
            onClick={handleExport}
            disabled={exporting}
            className="gap-2"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Exportar Planilha Pro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
