import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountCategories, DEFAULT_CATEGORIES } from '@/hooks/useAccountCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, MessageCircle, Star, Info, Lightbulb, Crown, Terminal, Tv, Radio, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WhatsAppTemplate {
  id: string;
  seller_id: string;
  name: string;
  type: 'billing' | 'welcome' | 'renewal' | 'reminder' | 'unpaid' | 'custom' | 'user_password' | 'email_password' | 'reminder_only';
  message: string;
  is_default: boolean;
  created_at: string;
  category?: string; // Account category for the template
}

const templateTypes = [
  { value: 'billing', label: 'Cobrança' },
  { value: 'welcome', label: 'Boas-vindas' },
  { value: 'renewal', label: 'Renovação' },
  { value: 'reminder', label: 'Lembrete' },
  { value: 'unpaid', label: 'Inadimplente' },
  { value: 'user_password', label: 'Usuário e Senha' },
  { value: 'email_password', label: 'E-mail e Senha' },
  { value: 'reminder_only', label: 'Apenas Lembrete' },
  { value: 'custom', label: 'Personalizado' },
];

// Category icons mapping
const categoryIcons: Record<string, any> = {
  crown: Crown,
  terminal: Terminal,
  tv: Tv,
  radio: Radio,
  tag: Tag,
};

// Default messages for each category
export const getDefaultCategoryMessage = (categoryId: string, type: 'billing' | 'welcome' | 'renewal' | 'reminder') => {
  // Premium accounts use email
  if (categoryId === 'premium') {
    const messages = {
      billing: `Olá {nome}! 👋

*{empresa}* informa: Seu plano *{plano}* vence em *{vencimento_dinamico}*.

💰 *Valor: {preco}*

Deseja renovar? Entre em contato para garantir sua experiência premium!

🎬 *{empresa}* - Sua melhor experiência!`,
      welcome: `Olá {nome}! 🎉

Seja bem-vindo(a) à *{empresa}*!

Seu plano: *{plano}*
📅 Vencimento: *{vencimento}*
💰 Valor: *{preco}*

Seus dados de acesso:
📧 E-mail: *{email}*
🔑 Senha: *{senha}*

Qualquer dúvida, estamos à disposição!

🎬 *{empresa}* - Sua melhor experiência!`,
      renewal: `Olá {nome}! ✅

*{empresa}* informa: Seu plano *{plano}* foi renovado!

📅 Novo vencimento: *{vencimento}*
💰 Valor: *{preco}*

Seus dados de acesso:
📧 E-mail: *{email}*
🔑 Senha: *{senha}*

Agradecemos pela confiança!

🎬 *{empresa}* - Sua melhor experiência!`,
      reminder: `Olá {nome}! ⏰

*{empresa}* lembra: Seu plano *{plano}* vence em *{vencimento_dinamico}*.

💰 *Valor: {preco}*

Seus dados de acesso:
📧 E-mail: *{email}*
🔑 Senha: *{senha}*

Evite a interrupção do serviço renovando antecipadamente!

🎬 *{empresa}* - Sua melhor experiência!`,
    };
    return messages[type];
  }
  
  // SSH accounts - technical users
  if (categoryId === 'ssh') {
    const messages = {
      billing: `Olá {nome}! 👋

*{empresa}* informa: Sua conta SSH vence em *{vencimento_dinamico}*.

💰 *Valor: {preco}*

Renove para continuar com acesso total!

💻 *{empresa}* - Conexão de qualidade!`,
      welcome: `Olá {nome}! 🎉

Bem-vindo(a) à *{empresa}*!

📅 Vencimento: *{vencimento}*
💰 Valor: *{preco}*

Dados SSH:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

💻 *{empresa}* - Conexão de qualidade!`,
      renewal: `Olá {nome}! ✅

*{empresa}* informa: Sua conta SSH foi renovada!

📅 Novo vencimento: *{vencimento}*
💰 Valor: *{preco}*

Dados SSH:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

💻 *{empresa}* - Conexão de qualidade!`,
      reminder: `Olá {nome}! ⏰

*{empresa}* lembra: Sua conta SSH vence em *{vencimento_dinamico}*.

💰 *Valor: {preco}*

Dados SSH:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

💻 *{empresa}* - Conexão de qualidade!`,
    };
    return messages[type];
  }
  
  // IPTV accounts
  if (categoryId === 'iptv') {
    const messages = {
      billing: `Olá {nome}! 👋

*{empresa}* informa: Seu plano IPTV *{plano}* vence em *{vencimento_dinamico}*.

💰 *Valor: {preco}*

Renove e continue assistindo seus canais favoritos!

📺 *{empresa}* - Entretenimento de qualidade!`,
      welcome: `Olá {nome}! 🎉

Seja bem-vindo(a) à *{empresa}*!

Plano IPTV: *{plano}*
📅 Vencimento: *{vencimento}*
💰 Valor: *{preco}*

Dados de acesso:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

📺 *{empresa}* - Entretenimento de qualidade!`,
      renewal: `Olá {nome}! ✅

*{empresa}* informa: Seu plano IPTV foi renovado!

📅 Novo vencimento: *{vencimento}*
💰 Valor: *{preco}*

Dados de acesso:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

📺 *{empresa}* - Entretenimento de qualidade!`,
      reminder: `Olá {nome}! ⏰

*{empresa}* lembra: Seu plano IPTV vence em *{vencimento_dinamico}*.

💰 *Valor: {preco}*

Dados de acesso:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

📺 *{empresa}* - Entretenimento de qualidade!`,
    };
    return messages[type];
  }
  
  // P2P accounts
  if (categoryId === 'p2p') {
    const messages = {
      billing: `Olá {nome}! 👋

*{empresa}* informa: Seu plano P2P *{plano}* vence em *{vencimento_dinamico}*.

💰 *Valor: {preco}*

Renove e continue conectado!

📡 *{empresa}* - Sua conexão P2P!`,
      welcome: `Olá {nome}! 🎉

Seja bem-vindo(a) à *{empresa}*!

Plano P2P: *{plano}*
📅 Vencimento: *{vencimento}*
💰 Valor: *{preco}*

Dados de acesso:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

📡 *{empresa}* - Sua conexão P2P!`,
      renewal: `Olá {nome}! ✅

*{empresa}* informa: Seu plano P2P foi renovado!

📅 Novo vencimento: *{vencimento}*
💰 Valor: *{preco}*

Dados de acesso:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

📡 *{empresa}* - Sua conexão P2P!`,
      reminder: `Olá {nome}! ⏰

*{empresa}* lembra: Seu plano P2P vence em *{vencimento_dinamico}*.

💰 *Valor: {preco}*

Dados de acesso:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

📡 *{empresa}* - Sua conexão P2P!`,
    };
    return messages[type];
  }
  
  // Default/Generic message for custom categories
  const messages = {
    billing: `Olá {nome}! 👋

*{empresa}* informa: Seu plano *{plano}* vence em *{vencimento_dinamico}*.

💰 *Valor: {preco}*

Deseja renovar? Entre em contato!

🎬 *{empresa}* - Sua melhor experiência!`,
    welcome: `Olá {nome}! 🎉

Seja bem-vindo(a) à *{empresa}*!

Plano: *{plano}*
📅 Vencimento: *{vencimento}*
💰 Valor: *{preco}*

Dados de acesso:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

🎬 *{empresa}* - Sua melhor experiência!`,
    renewal: `Olá {nome}! ✅

*{empresa}* informa: Seu plano *{plano}* foi renovado!

📅 Novo vencimento: *{vencimento}*
💰 Valor: *{preco}*

Dados de acesso:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

🎬 *{empresa}* - Sua melhor experiência!`,
    reminder: `Olá {nome}! ⏰

*{empresa}* lembra: Seu plano *{plano}* vence em *{vencimento_dinamico}*.

💰 *Valor: {preco}*

Dados de acesso:
👤 Usuário: *{usuario}*
🔑 Senha: *{senha}*

🎬 *{empresa}* - Sua melhor experiência!`,
  };
  return messages[type];
};

// Default message for unpaid clients template
const defaultUnpaidMessage = `Olá {nome}! 👋

Notamos que seu pagamento do plano {plano} (*{preco}*) ainda está pendente.

⚠️ *Atenção:* Se o pagamento não for realizado até o vencimento, será necessário pagar 2 meses no próximo mês.

📅 Vencimento: {vencimento}

Por favor, regularize sua situação para evitar a interrupção do serviço.

Qualquer dúvida, estamos à disposição! 🙏`;

// Default template for user + password clients
const defaultUserPasswordMessage = `Olá querido(a) cliente *{nome}*,

Seu plano vence em:

*{vencimento_dinamico}*

💰 *Valor: {preco}*

Usuário: *{usuario}*
Senha: *{senha}*

Evite o bloqueio automático do seu sinal

É sempre um prazer te atender.`;

// Default template for email + password clients
const defaultEmailPasswordMessage = `Olá querido(a) cliente *{nome}*,

Seu plano vence em:

*{vencimento_dinamico}*

💰 *Valor: {preco}*

E-mail: *{email}*
Senha: *{senha}*

Evite o bloqueio automático do seu sinal

É sempre um prazer te atender.`;

// Default template for reminder only (no credentials)
const defaultReminderOnlyMessage = `Olá querido(a) cliente *{nome}*,

Seu plano vence em:

*{vencimento_dinamico}*

💰 *Valor: {preco}*

Evite o bloqueio automático do seu sinal

É sempre um prazer te atender.`;

const availableVariables = [
  { var: '{nome}', desc: 'Nome do cliente' },
  { var: '{plano}', desc: 'Nome do plano' },
  { var: '{vencimento}', desc: 'Data de vencimento' },
  { var: '{vencimento_dinamico}', desc: 'Vencimento dinâmico (7 dias, 3 dias, amanhã ou data)' },
  { var: '{dispositivo}', desc: 'Dispositivo' },
  { var: '{usuario}', desc: 'Usuário/Login' },
  { var: '{senha}', desc: 'Senha' },
  { var: '{email}', desc: 'E-mail do cliente' },
  { var: '{preco}', desc: 'Preço do plano' },
  { var: '{empresa}', desc: 'Seu nome/empresa' },
];

export default function WhatsAppTemplatesManager() {
  const { user } = useAuth();
  const { allCategories } = useAccountCategories();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDefaultTemplates, setShowDefaultTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'custom' as WhatsAppTemplate['type'],
    message: '',
    is_default: false,
  });

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setTemplates((data || []) as WhatsAppTemplate[]);
    } catch (error: any) {
      toast.error('Erro ao carregar templates');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template?: WhatsAppTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        type: template.type,
        message: template.message,
        is_default: template.is_default,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        type: 'custom',
        message: '',
        is_default: false,
      });
    }
    setDialogOpen(true);
  };

  const handleCreateFromDefault = (categoryId: string, categoryName: string, type: 'billing' | 'welcome' | 'renewal' | 'reminder') => {
    const message = getDefaultCategoryMessage(categoryId, type);
    const typeLabels = {
      billing: 'Cobrança',
      welcome: 'Boas-vindas',
      renewal: 'Renovação',
      reminder: 'Lembrete',
    };
    
    setEditingTemplate(null);
    setFormData({
      name: `${categoryName} - ${typeLabels[type]}`,
      type: type,
      message: message,
      is_default: false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.message.trim()) {
      toast.error('Preencha nome e mensagem');
      return;
    }

    setSaving(true);
    try {
      if (formData.is_default) {
        // Remove default from other templates of the same type
        await supabase
          .from('whatsapp_templates')
          .update({ is_default: false })
          .eq('seller_id', user?.id)
          .eq('type', formData.type);
      }

      if (editingTemplate) {
        const { error } = await supabase
          .from('whatsapp_templates')
          .update({
            name: formData.name,
            type: formData.type,
            message: formData.message,
            is_default: formData.is_default,
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template atualizado!');
      } else {
        const { error } = await supabase
          .from('whatsapp_templates')
          .insert({
            seller_id: user?.id,
            name: formData.name,
            type: formData.type,
            message: formData.message,
            is_default: formData.is_default,
          });

        if (error) throw error;
        toast.success('Template criado!');
      }

      setDialogOpen(false);
      fetchTemplates();
    } catch (error: any) {
      toast.error('Erro ao salvar template');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', templateToDelete);

      if (error) throw error;
      toast.success('Template excluído!');
      fetchTemplates();
    } catch (error: any) {
      toast.error('Erro ao excluir template');
      console.error(error);
    } finally {
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleSetDefault = async (template: WhatsAppTemplate) => {
    try {
      // Remove default from other templates of the same type
      await supabase
        .from('whatsapp_templates')
        .update({ is_default: false })
        .eq('seller_id', user?.id)
        .eq('type', template.type);

      // Set this template as default
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({ is_default: true })
        .eq('id', template.id);

      if (error) throw error;
      toast.success('Template definido como padrão!');
      fetchTemplates();
    } catch (error: any) {
      toast.error('Erro ao definir padrão');
      console.error(error);
    }
  };

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      message: prev.message + variable,
    }));
  };

  const getTypeLabel = (type: string) => {
    return templateTypes.find(t => t.value === type)?.label || type;
  };

  const getCategoryIcon = (iconName: string) => {
    const IconComponent = categoryIcons[iconName] || Tag;
    return <IconComponent className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Templates WhatsApp</h2>
          <p className="text-muted-foreground">Personalize suas mensagens de WhatsApp</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="border-primary/20 bg-primary/5">
        <Lightbulb className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Dica:</strong> Cada categoria de conta possui mensagens padrão. Você pode criar seus próprios templates personalizados ou usar os modelos padrão como base. 
          A variável <code className="bg-muted px-1 rounded">{'{preco}'}</code> inclui o valor do plano nas mensagens de cobrança.
        </AlertDescription>
      </Alert>

      {/* Variables Info */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4" />
            Variáveis disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map(v => (
              <Badge key={v.var} variant="secondary" className="text-xs">
                {v.var} = {v.desc}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Default Templates by Category */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowDefaultTemplates(!showDefaultTemplates)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Templates Padrão por Categoria
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                Modelos prontos para cada tipo de conta - clique para expandir
              </CardDescription>
            </div>
            <Badge variant="outline">{allCategories.length} categorias</Badge>
          </div>
        </CardHeader>
        {showDefaultTemplates && (
          <CardContent className="pt-0">
            <div className="space-y-4">
              {allCategories.map(category => (
                <div key={category.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {getCategoryIcon(category.icon)}
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(['billing', 'welcome', 'renewal', 'reminder'] as const).map(type => (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleCreateFromDefault(category.id, category.name, type)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {{
                          billing: 'Cobrança',
                          welcome: 'Boas-vindas',
                          renewal: 'Renovação',
                          reminder: 'Lembrete',
                        }[type]}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* My Templates */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Meus Templates</h3>
        {templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">Nenhum template criado</p>
              <p className="text-sm text-muted-foreground mb-4">
                Crie templates personalizados ou use os modelos padrão acima
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Criar primeiro template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => (
              <Card key={template.id} variant="gradient">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{template.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(template.type)}
                        </Badge>
                        {template.is_default && (
                          <Badge className="text-xs bg-primary/20 text-primary">
                            <Star className="w-3 h-3 mr-1" />
                            Padrão
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {template.message}
                  </p>
                  <div className="flex gap-2 pt-2 border-t border-border">
                    {!template.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(template)}
                        className="flex-1"
                      >
                        <Star className="w-4 h-4 mr-1" />
                        Padrão
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(template)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setTemplateToDelete(template.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do template</label>
              <Input
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Cobrança personalizada"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={formData.type}
                onValueChange={value => setFormData(prev => ({ ...prev, type: value as WhatsAppTemplate['type'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Variáveis (clique para inserir)</label>
              <div className="flex flex-wrap gap-1 mt-1 mb-2">
                {availableVariables.map(v => (
                  <Button
                    key={v.var}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => insertVariable(v.var)}
                  >
                    {v.var}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <Textarea
                value={formData.message}
                onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Olá {nome}! 👋..."
                rows={6}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={e => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                className="rounded border-border"
              />
              <label htmlFor="is_default" className="text-sm">
                Definir como padrão para este tipo
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
