import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, Calendar, DollarSign, Edit, Trash2, Check, Filter, Send, Copy } from "lucide-react";
import { format, differenceInDays, addDays, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import BillDialog from "@/components/bills/BillDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Bill {
  id: string;
  seller_id: string;
  description: string;
  recipient_name: string;
  recipient_whatsapp: string | null;
  recipient_telegram: string | null;
  recipient_pix: string | null;
  amount: number;
  due_date: string;
  is_paid: boolean;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function Bills() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ["bills", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills_to_pay")
        .select("*")
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as Bill[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills_to_pay").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      toast.success("Conta excluída com sucesso!");
      setDeletingBill(null);
    },
    onError: () => {
      toast.error("Erro ao excluir conta");
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bills_to_pay")
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      toast.success("Conta marcada como paga!");
    },
    onError: () => {
      toast.error("Erro ao atualizar conta");
    },
  });

  const filteredBills = bills.filter((bill) => {
    if (filter === "all") return true;
    if (filter === "paid") return bill.is_paid;
    if (filter === "unpaid") return !bill.is_paid;

    const daysUntilDue = differenceInDays(new Date(bill.due_date), new Date());
    const filterDays = parseInt(filter);

    if (!bill.is_paid && daysUntilDue <= filterDays && daysUntilDue >= 0) {
      return true;
    }
    return false;
  });

  const getStatusBadge = (bill: Bill) => {
    if (bill.is_paid) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Pago</Badge>;
    }

    const dueDate = new Date(bill.due_date);
    const today = new Date();
    const daysUntilDue = differenceInDays(dueDate, today);

    if (isBefore(dueDate, today) && !isToday(dueDate)) {
      return <Badge variant="destructive">Vencida</Badge>;
    }
    if (isToday(dueDate)) {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Vence Hoje</Badge>;
    }
    if (daysUntilDue <= 3) {
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Urgente ({daysUntilDue}d)</Badge>;
    }
    if (daysUntilDue <= 7) {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Atenção ({daysUntilDue}d)</Badge>;
    }
    return <Badge variant="secondary">{daysUntilDue} dias</Badge>;
  };

  const handleWhatsAppClick = (whatsapp: string, bill: Bill) => {
    const phone = whatsapp.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá ${bill.recipient_name}! Gostaria de tratar sobre o pagamento de R$ ${bill.amount.toFixed(2).replace(".", ",")} referente a: ${bill.description}`
    );
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  const handleTelegramClick = (telegram: string, bill: Bill) => {
    const username = telegram.replace(/^@/, '');
    const formattedDate = format(new Date(bill.due_date), "dd/MM/yyyy");
    const message = encodeURIComponent(
      `Olá ${bill.recipient_name}, tenho que te pagar dia ${formattedDate} referente a: ${bill.description} - R$ ${bill.amount.toFixed(2).replace(".", ",")}`
    );
    window.open(`https://t.me/${username}?text=${message}`, "_blank");
  };

  const handleCopyPix = (pix: string) => {
    navigator.clipboard.writeText(pix);
    toast.success("Chave PIX copiada!");
  };

  const handleEdit = (bill: Bill) => {
    setEditingBill(bill);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingBill(null);
  };

  const unpaidTotal = bills
    .filter((b) => !b.is_paid)
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const upcomingBills = bills.filter((b) => {
    if (b.is_paid) return false;
    const daysUntilDue = differenceInDays(new Date(b.due_date), new Date());
    return daysUntilDue <= 7 && daysUntilDue >= 0;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Contas a Pagar</h1>
            <p className="text-muted-foreground">
              Gerencie suas contas e lembretes de pagamento
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total a Pagar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                R$ {unpaidTotal.toFixed(2).replace(".", ",")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bills.filter((b) => !b.is_paid).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vencendo em 7 dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {upcomingBills.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unpaid">Não Pagas</SelectItem>
              <SelectItem value="paid">Pagas</SelectItem>
              <SelectItem value="3">Próximos 3 dias</SelectItem>
              <SelectItem value="6">Próximos 6 dias</SelectItem>
              <SelectItem value="15">Próximos 15 dias</SelectItem>
              <SelectItem value="30">Próximos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bills List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando...
          </div>
        ) : filteredBills.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {filter === "all"
                ? "Nenhuma conta cadastrada"
                : "Nenhuma conta encontrada com este filtro"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBills.map((bill) => (
              <Card
                key={bill.id}
                className={`transition-all ${
                  bill.is_paid ? "opacity-60" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{bill.description}</h3>
                        {getStatusBadge(bill)}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          R$ {Number(bill.amount).toFixed(2).replace(".", ",")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(bill.due_date), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </span>
                        <span>{bill.recipient_name}</span>
                      </div>
                      {bill.notes && (
                        <p className="text-sm text-muted-foreground">
                          {bill.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {bill.recipient_whatsapp && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleWhatsAppClick(bill.recipient_whatsapp!, bill)
                          }
                          className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                          title="Enviar WhatsApp"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      )}
                      {bill.recipient_telegram && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleTelegramClick(bill.recipient_telegram!, bill)
                          }
                          className="text-sky-500 border-sky-500/30 hover:bg-sky-500/10"
                          title="Enviar Telegram"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {bill.recipient_pix && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyPix(bill.recipient_pix!)}
                          className="text-purple-500 border-purple-500/30 hover:bg-purple-500/10"
                          title={`Copiar PIX: ${bill.recipient_pix}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {!bill.is_paid && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => markAsPaidMutation.mutate(bill.id)}
                          className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(bill)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingBill(bill)}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BillDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        bill={editingBill}
      />

      <AlertDialog
        open={!!deletingBill}
        onOpenChange={() => setDeletingBill(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A conta "{deletingBill?.description}" será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBill && deleteMutation.mutate(deletingBill.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
