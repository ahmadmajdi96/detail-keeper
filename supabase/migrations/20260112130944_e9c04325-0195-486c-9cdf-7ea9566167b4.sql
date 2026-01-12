-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications for any user
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (TRUE);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable realtime for notifications, defects, and test_executions
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.defects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_executions;

-- Create function to auto-create notification when defect is assigned
CREATE OR REPLACE FUNCTION public.notify_defect_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to) THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.assigned_to,
      'defect_assigned',
      'Defect Assigned to You',
      'You have been assigned defect: ' || NEW.title,
      jsonb_build_object('defect_id', NEW.id, 'severity', NEW.severity, 'priority', NEW.priority)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for defect assignment notifications
CREATE TRIGGER on_defect_assigned
AFTER INSERT OR UPDATE ON public.defects
FOR EACH ROW
EXECUTE FUNCTION public.notify_defect_assignment();

-- Create function to notify on execution completion
CREATE OR REPLACE FUNCTION public.notify_execution_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('passed', 'failed', 'blocked') AND OLD.status = 'in_progress' THEN
    IF NEW.executor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        NEW.executor_id,
        'execution_completed',
        'Test Execution Completed',
        'Test execution has ' || NEW.status,
        jsonb_build_object('execution_id', NEW.id, 'status', NEW.status, 'test_case_id', NEW.test_case_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for execution completion notifications
CREATE TRIGGER on_execution_completed
AFTER UPDATE ON public.test_executions
FOR EACH ROW
EXECUTE FUNCTION public.notify_execution_completion();