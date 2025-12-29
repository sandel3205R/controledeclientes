import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AccountCategory {
  id: string;
  seller_id: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

// Default categories that are always available
export const DEFAULT_CATEGORIES = [
  { id: 'premium', name: 'Contas Premium', icon: 'crown', color: 'yellow' },
  { id: 'ssh', name: 'SSH', icon: 'terminal', color: 'green' },
  { id: 'iptv', name: 'IPTV', icon: 'tv', color: 'purple' },
  { id: 'p2p', name: 'P2P', icon: 'radio', color: 'blue' },
];

export function useAccountCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('account_categories')
        .select('*')
        .eq('seller_id', user.id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = async (name: string, icon: string = 'tag', color: string = 'gray') => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('account_categories')
        .insert([{ seller_id: user.id, name, icon, color }])
        .select()
        .single();

      if (error) throw error;
      
      setCategories(prev => [...prev, data]);
      toast.success('Categoria criada com sucesso!');
      return data;
    } catch (error: any) {
      toast.error('Erro ao criar categoria');
      console.error(error);
      return null;
    }
  };

  const updateCategory = async (id: string, updates: Partial<Pick<AccountCategory, 'name' | 'icon' | 'color'>>) => {
    try {
      const { error } = await supabase
        .from('account_categories')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...updates } : cat));
      toast.success('Categoria atualizada!');
      return true;
    } catch (error: any) {
      toast.error('Erro ao atualizar categoria');
      console.error(error);
      return false;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('account_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setCategories(prev => prev.filter(cat => cat.id !== id));
      toast.success('Categoria removida!');
      return true;
    } catch (error: any) {
      toast.error('Erro ao remover categoria');
      console.error(error);
      return false;
    }
  };

  // Combine default categories with custom ones
  const allCategories = [
    ...DEFAULT_CATEGORIES,
    ...categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
    })),
  ];

  return {
    categories,
    allCategories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    refetch: fetchCategories,
  };
}
