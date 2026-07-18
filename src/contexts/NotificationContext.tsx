import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markManyAsRead: (ids: string[]) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteMany: (ids: string[]) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
      return;
    }

    // Fetch initial notifications
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    };

    fetchNotifications();

    // Subscribe to realtime notifications (INSERT + UPDATE + DELETE)
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) =>
            prev.some((n) => n.id === newNotification.id) ? prev : [newNotification, ...prev]
          );
          toast(newNotification.title, {
            description: newNotification.message,
            action: {
              label: 'View',
              onClick: () => {
                if (newNotification.type === 'defect_assigned') window.location.href = '/defects';
                else if (newNotification.type === 'execution_completed') window.location.href = '/executions';
              },
            },
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const removed = payload.old as Notification;
          setNotifications((prev) => prev.filter((n) => n.id !== removed.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    // Optimistic
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    }
  };

  const markManyAsRead = async (ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setNotifications((prev) => prev.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n)));
    const { error } = await supabase.from('notifications').update({ read: true }).in('id', ids);
    if (error) toast.error('Could not mark as read');
  };

  const deleteMany = async (ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const snapshot = notifications;
    setNotifications((prev) => prev.filter((n) => !idSet.has(n.id)));
    const { error } = await supabase.from('notifications').delete().in('id', ids);
    if (error) {
      setNotifications(snapshot);
      toast.error('Could not delete');
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const clearAll = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);

    if (!error) {
      setNotifications([]);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        markManyAsRead,
        deleteNotification,
        deleteMany,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}