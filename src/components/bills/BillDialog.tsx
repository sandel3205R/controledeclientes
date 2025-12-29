import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, addMonths, addYears } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const billSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  recipient_name: z.string().min(1, "Nome do destinatário é obrigatório").max(100),
  recipient_whatsapp: z.string().optional(),
  recipient_telegram: z.string().optional(),
  amount: z.string().min(1, "Valor é obrigatório"),
  due_date: z.date({ required_error: "Data de vencimento é obrigatória" }),
  notes: z.string().optional(),
});

type BillFormData = z.infer<typeof billSchema>;

interface Bill {
  id: string;
  description: string;
  recipient_name: string;
  recipient_whatsapp: string | null;
  recipient_telegram: string | null;
  amount: number;
  due_date: string;
  notes: string | null;
  is_paid: boolean;
}

interface BillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Bill | null;
}

export default function BillDialog({ open, onOpenChange, bill }: BillDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      description: "",
      recipient_name: "",
      recipient_whatsapp: "",
      recipient_telegram: "",
      amount: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (bill) {
      form.reset({
        description: bill.description,
        recipient_name: bill.recipient_name,
        recipient_whatsapp: bill.recipient_whatsapp || "",
        recipient_telegram: bill.recipient_telegram || "",
        amount: bill.amount.toString(),
        due_date: new Date(bill.due_date),
        notes: bill.notes || "",
      });
    } else {
      form.reset({
        description: "",
        recipient_name: "",
        recipient_whatsapp: "",
        recipient_telegram: "",
        amount: "",
        notes: "",
      });
    }
  }, [bill, form, open]);

  const mutation = useMutation({
    mutationFn: async (data: BillFormData) => {
      const payload = {
        seller_id: user!.id,
        description: data.description.trim(),
        recipient_name: data.recipient_name.trim(),
        recipient_whatsapp: data.recipient_whatsapp?.trim() || null,
        recipient_telegram: data.recipient_telegram?.trim().replace(/^@/, '') || null,
        amount: parseFloat(data.amount.replace(",", ".")),
        due_date: format(data.due_date, "yyyy-MM-dd"),
        notes: data.notes?.trim() || null,
      };

      if (bill) {
        const { error } = await supabase
          .from("bills_to_pay")
          .update(payload)
          .eq("id", bill.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bills_to_pay").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      toast.success(bill ? "Conta atualizada!" : "Conta cadastrada!");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao salvar conta");
    },
  });

  const onSubmit = (data: BillFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {bill ? "Editar Conta" : "Nova Conta a Pagar"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Pagamento servidor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="recipient_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Destinatário</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recipient_whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="recipient_telegram"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telegram</FormLabel>
                  <FormControl>
                    <Input placeholder="@usuario" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input placeholder="0,00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Vencimento</FormLabel>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => field.onChange(addMonths(new Date(), 1))}
                    >
                      +1 mês
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => field.onChange(addMonths(new Date(), 3))}
                    >
                      +3 meses
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => field.onChange(addMonths(new Date(), 6))}
                    >
                      +6 meses
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => field.onChange(addYears(new Date(), 1))}
                    >
                      +1 ano
                    </Button>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy")
                          ) : (
                            <span>Selecione</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações adicionais..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : bill ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
