import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MessageHistory {
  id: string;
  seller_id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  message_type: string;
  message_content: string;
  delivery_status: 'sent' | 'delivered' | 'failed' | 'pending';
  sent_at: string;
  delivered_at: string | null;
  created_at: string;
}

export function useMessageHistory() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('message_history')
        .select('*')
        .eq('seller_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMessages((data as MessageHistory[]) || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const addMessage = useCallback(async (
    clientId: string | null,
    clientName: string,
    clientPhone: string | null,
    messageType: string,
    messageContent: string,
    status: 'sent' | 'delivered' | 'failed' | 'pending' = 'sent'
  ) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('message_history')
        .insert({
          seller_id: user.id,
          client_id: clientId,
          client_name: clientName,
          client_phone: clientPhone,
          message_type: messageType,
          message_content: messageContent,
          delivery_status: status,
        })
        .select()
        .single();

      if (error) throw error;
      
      setMessages(prev => [data as MessageHistory, ...prev]);
      return data;
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
      return null;
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    loading,
    fetchMessages,
    addMessage,
  };
}
