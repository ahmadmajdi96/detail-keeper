import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const defectsChannel = supabase
      .channel('defects-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'defects' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['defects'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-defects'] });
        if (payload.eventType === 'INSERT') toast.info('New Defect', { description: 'A new defect has been reported' });
      })
      .subscribe();

    const executionsChannel = supabase
      .channel('executions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'test_executions' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['executions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-executions'] });
        if (payload.eventType === 'UPDATE') {
          const n = payload.new as { status: string };
          if (n.status === 'passed') toast.success('Test Passed');
          else if (n.status === 'failed') toast.error('Test Failed');
        }
      })
      .subscribe();

    const buildsChannel = supabase
      .channel('builds-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'builds' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['builds'] });
        queryClient.invalidateQueries({ queryKey: ['releases'] });
        if (payload.eventType === 'UPDATE') {
          const n = payload.new as { status: string; name?: string };
          if (n.status === 'success') toast.success(`Build succeeded${n.name ? ': ' + n.name : ''}`);
          else if (n.status === 'failed') toast.error(`Build failed${n.name ? ': ' + n.name : ''}`);
        }
      })
      .subscribe();

    const cycleRunsChannel = supabase
      .channel('cycle-runs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cycle_runs' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['cycle-runs'] });
        queryClient.invalidateQueries({ queryKey: ['cycles'] });
        if (payload.eventType === 'UPDATE') {
          const n = payload.new as { status: string; name?: string };
          if (n.status === 'completed') toast.success(`Run completed${n.name ? ': ' + n.name : ''}`);
        }
      })
      .subscribe();

    const cycleItemsChannel = supabase
      .channel('cycle-run-items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cycle_run_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['cycle-run-items'] });
        queryClient.invalidateQueries({ queryKey: ['cycle-runs'] });
      })
      .subscribe();

    const jobsChannel = supabase
      .channel('jobs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        if (payload.eventType === 'UPDATE') {
          const n = payload.new as { status: string; kind: string };
          if (n.status === 'completed') toast.success(`Job done: ${n.kind}`);
          else if (n.status === 'dead_letter') toast.error(`Job failed permanently: ${n.kind}`);
        }
      })
      .subscribe();

    const runnerJobsChannel = supabase
      .channel('runner-jobs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'runner_jobs' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['runner-jobs'] });
        queryClient.invalidateQueries({ queryKey: ['runners'] });
        if (payload.eventType === 'UPDATE') {
          const n = payload.new as { status: string };
          if (n.status === 'succeeded') toast.success('Runner job succeeded');
          else if (n.status === 'failed') toast.error('Runner job failed');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(defectsChannel);
      supabase.removeChannel(executionsChannel);
      supabase.removeChannel(buildsChannel);
      supabase.removeChannel(cycleRunsChannel);
      supabase.removeChannel(cycleItemsChannel);
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(runnerJobsChannel);
    };
  }, [queryClient]);
}
