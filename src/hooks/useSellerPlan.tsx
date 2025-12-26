import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SellerPlan {
  id: string;
  name: string;
  slug: string;
  max_clients: number | null;
  price_monthly: number;
  is_best_value: boolean;
  is_active: boolean;
}

interface UseSellerPlanReturn {
  currentPlan: SellerPlan | null;
  allPlans: SellerPlan[];
  clientCount: number;
  hasUnlimitedClients: boolean;
  canAddClient: boolean;
  remainingClients: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useSellerPlan(): UseSellerPlanReturn {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<SellerPlan | null>(null);
  const [allPlans, setAllPlans] = useState<SellerPlan[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [hasUnlimitedClients, setHasUnlimitedClients] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all active plans
      const { data: plans } = await supabase
        .from('seller_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (plans) {
        setAllPlans(plans as SellerPlan[]);
      }

      // Fetch user's profile with plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('seller_plan_id, has_unlimited_clients')
        .eq('id', user.id)
        .single();

      if (profile) {
        setHasUnlimitedClients(profile.has_unlimited_clients || false);

        // Find current plan
        if (profile.seller_plan_id && plans) {
          const plan = plans.find(p => p.id === profile.seller_plan_id);
          setCurrentPlan(plan as SellerPlan || null);
        } else if (plans) {
          // Default to trial
          const trialPlan = plans.find(p => p.slug === 'trial');
          setCurrentPlan(trialPlan as SellerPlan || null);
        }
      }

      // Count current clients
      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id);

      setClientCount(count || 0);
    } catch (error) {
      console.error('Error fetching seller plan:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate if user can add more clients
  const canAddClient = hasUnlimitedClients || 
    !currentPlan?.max_clients || 
    clientCount < currentPlan.max_clients;

  // Calculate remaining clients
  const remainingClients = hasUnlimitedClients || !currentPlan?.max_clients 
    ? null 
    : Math.max(0, currentPlan.max_clients - clientCount);

  return {
    currentPlan,
    allPlans,
    clientCount,
    hasUnlimitedClients,
    canAddClient,
    remainingClients,
    loading,
    refresh: fetchData,
  };
}
