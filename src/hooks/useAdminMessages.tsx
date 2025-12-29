import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AdminMessage {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export function useAdminMessages() {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = role === 'admin';

  const fetchMessages = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('admin_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages((data || []) as AdminMessage[]);
    } catch (error) {
      console.error('Error fetching admin messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const createMessage = async (data: {
    title: string;
    message: string;
    priority?: string;
    expires_at?: string | null;
  }) => {
    if (!isAdmin) return null;

    try {
      const { data: newMessage, error } = await supabase
        .from('admin_messages')
        .insert([{
          title: data.title,
          message: data.message,
          priority: data.priority || 'normal',
          expires_at: data.expires_at || null,
        }])
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [newMessage as AdminMessage, ...prev]);
      toast.success('Mensagem enviada com sucesso!');
      return newMessage;
    } catch (error: any) {
      toast.error('Erro ao enviar mensagem');
      console.error(error);
      return null;
    }
  };

  const updateMessage = async (id: string, data: Partial<AdminMessage>) => {
    if (!isAdmin) return false;

    try {
      const { error } = await supabase
        .from('admin_messages')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, ...data } : msg));
      toast.success('Mensagem atualizada!');
      return true;
    } catch (error: any) {
      toast.error('Erro ao atualizar mensagem');
      console.error(error);
      return false;
    }
  };

  const deleteMessage = async (id: string) => {
    if (!isAdmin) return false;

    try {
      const { error } = await supabase
        .from('admin_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== id));
      toast.success('Mensagem removida!');
      return true;
    } catch (error: any) {
      toast.error('Erro ao remover mensagem');
      console.error(error);
      return false;
    }
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    return updateMessage(id, { is_active });
  };

  // Get only active messages (for sellers)
  const activeMessages = messages.filter(msg => {
    if (!msg.is_active) return false;
    if (msg.expires_at && new Date(msg.expires_at) < new Date()) return false;
    return true;
  });

  return {
    messages,
    activeMessages,
    loading,
    isAdmin,
    createMessage,
    updateMessage,
    deleteMessage,
    toggleActive,
    refetch: fetchMessages,
  };
}
