import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to defects changes
    const defectsChannel = supabase
      .channel('defects-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'defects',
        },
        (payload) => {
          // Invalidate defects queries
          queryClient.invalidateQueries({ queryKey: ['defects'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-defects'] });

          if (payload.eventType === 'INSERT') {
            toast.info('New Defect', {
              description: `A new defect has been reported`,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to test executions changes
    const executionsChannel = supabase
      .channel('executions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'test_executions',
        },
        (payload) => {
          // Invalidate executions queries
          queryClient.invalidateQueries({ queryKey: ['executions'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-executions'] });

          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as { status: string };
            if (newData.status === 'passed') {
              toast.success('Test Passed', {
                description: 'A test execution has completed successfully',
              });
            } else if (newData.status === 'failed') {
              toast.error('Test Failed', {
                description: 'A test execution has failed',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(defectsChannel);
      supabase.removeChannel(executionsChannel);
    };
  }, [queryClient]);
}