import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SharedPanel {
  id: string;
  name: string;
  total_slots: number;
  seller_id: string;
  created_at: string;
  filled_slots?: number;
}

export function useSharedPanels() {
  const { user } = useAuth();
  const [panels, setPanels] = useState<SharedPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState(0);

  const fetchPanels = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch panels
      const { data: panelsData, error: panelsError } = await supabase
        .from('shared_panels')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (panelsError) {
        console.error('Error fetching panels:', panelsError);
        return;
      }

      // Fetch client counts per panel
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('shared_panel_id')
        .eq('seller_id', user.id)
        .not('shared_panel_id', 'is', null);

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        return;
      }

      // Count clients per panel
      const panelCounts: { [key: string]: number } = {};
      clientsData?.forEach(client => {
        if (client.shared_panel_id) {
          panelCounts[client.shared_panel_id] = (panelCounts[client.shared_panel_id] || 0) + 1;
        }
      });

      // Add filled_slots to panels
      const panelsWithCounts = panelsData?.map(panel => ({
        ...panel,
        filled_slots: panelCounts[panel.id] || 0
      })) || [];

      setPanels(panelsWithCounts);

      // Calculate total available slots
      const totalAvailable = panelsWithCounts.reduce((acc, panel) => {
        const available = panel.total_slots - (panel.filled_slots || 0);
        return acc + Math.max(0, available);
      }, 0);
      setAvailableSlots(totalAvailable);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPanels();
  }, [fetchPanels]);

  const createPanel = async (name: string, totalSlots: number = 3) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('shared_panels')
      .insert([{ name, total_slots: totalSlots, seller_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error('Error creating panel:', error);
      return null;
    }

    await fetchPanels();
    return data;
  };

  const updatePanel = async (id: string, name: string, totalSlots: number) => {
    const { error } = await supabase
      .from('shared_panels')
      .update({ name, total_slots: totalSlots })
      .eq('id', id);

    if (error) {
      console.error('Error updating panel:', error);
      return false;
    }

    await fetchPanels();
    return true;
  };

  const deletePanel = async (id: string) => {
    const { error } = await supabase
      .from('shared_panels')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting panel:', error);
      return false;
    }

    await fetchPanels();
    return true;
  };

  return {
    panels,
    loading,
    availableSlots,
    fetchPanels,
    createPanel,
    updatePanel,
    deletePanel
  };
}
