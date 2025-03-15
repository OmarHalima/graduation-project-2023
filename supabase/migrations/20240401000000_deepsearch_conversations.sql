-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create deepsearch_conversations table
CREATE TABLE IF NOT EXISTS public.deepsearch_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id)
);

-- Create deepsearch_messages table
CREATE TABLE IF NOT EXISTS public.deepsearch_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.deepsearch_conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('user', 'assistant')),
    timestamp TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_deepsearch_conversations_user_id ON public.deepsearch_conversations(user_id);
CREATE INDEX idx_deepsearch_conversations_session_id ON public.deepsearch_conversations(session_id);
CREATE INDEX idx_deepsearch_messages_conversation_id ON public.deepsearch_messages(conversation_id);
CREATE INDEX idx_deepsearch_messages_timestamp ON public.deepsearch_messages(timestamp);

-- Enable Row Level Security
ALTER TABLE public.deepsearch_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deepsearch_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for deepsearch_conversations
CREATE POLICY "Users can view their own conversations"
    ON public.deepsearch_conversations
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
    ON public.deepsearch_conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
    ON public.deepsearch_conversations
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
    ON public.deepsearch_conversations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create RLS policies for deepsearch_messages
CREATE POLICY "Users can view messages from their conversations"
    ON public.deepsearch_messages
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.deepsearch_conversations
        WHERE deepsearch_conversations.id = deepsearch_messages.conversation_id
        AND deepsearch_conversations.user_id = auth.uid()
    ));

CREATE POLICY "Users can create messages in their conversations"
    ON public.deepsearch_messages
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.deepsearch_conversations
        WHERE deepsearch_conversations.id = conversation_id
        AND deepsearch_conversations.user_id = auth.uid()
    ));

CREATE POLICY "Users can update messages in their conversations"
    ON public.deepsearch_messages
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.deepsearch_conversations
        WHERE deepsearch_conversations.id = deepsearch_messages.conversation_id
        AND deepsearch_conversations.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.deepsearch_conversations
        WHERE deepsearch_conversations.id = deepsearch_messages.conversation_id
        AND deepsearch_conversations.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete messages in their conversations"
    ON public.deepsearch_messages
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.deepsearch_conversations
        WHERE deepsearch_conversations.id = deepsearch_messages.conversation_id
        AND deepsearch_conversations.user_id = auth.uid()
    ));

-- Grant necessary permissions
GRANT ALL ON public.deepsearch_conversations TO authenticated;
GRANT ALL ON public.deepsearch_messages TO authenticated; 