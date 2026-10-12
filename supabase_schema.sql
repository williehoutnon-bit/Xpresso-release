-- Supabase Schema Setup Script
-- Copy and paste this script into the Supabase SQL Editor to create the necessary tables.

-- Storage Buckets Migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('chat_media', 'chat_media', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Policies for storage.objects (if storage exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='objects') THEN
    DROP POLICY IF EXISTS "Allow public read access to chat_media" ON storage.objects;
    CREATE POLICY "Allow public read access to chat_media" ON storage.objects FOR SELECT USING ( bucket_id = 'chat_media' );
    
    DROP POLICY IF EXISTS "Allow public upload to chat_media" ON storage.objects;
    CREATE POLICY "Allow public upload to chat_media" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'chat_media' );
    
    DROP POLICY IF EXISTS "Allow public update to chat_media" ON storage.objects;
    CREATE POLICY "Allow public update to chat_media" ON storage.objects FOR UPDATE USING ( bucket_id = 'chat_media' );
    
    DROP POLICY IF EXISTS "Allow public delete to chat_media" ON storage.objects;
    CREATE POLICY "Allow public delete to chat_media" ON storage.objects FOR DELETE USING ( bucket_id = 'chat_media' );
  END IF;
END $$;

-- Optional Migration: patch previously created tables without destroying data
DO $$
BEGIN
  -- Add updated_at to presence if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='presence') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='presence' AND column_name='updated_at') THEN
      ALTER TABLE public.presence ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='presence' AND column_name='session_id') THEN
      ALTER TABLE public.presence ADD COLUMN session_id TEXT;
      ALTER TABLE public.presence ADD COLUMN display_name TEXT;
      ALTER TABLE public.presence ADD COLUMN avatar_color TEXT;
      ALTER TABLE public.presence ADD COLUMN x NUMERIC;
      ALTER TABLE public.presence ADD COLUMN y NUMERIC;
      ALTER TABLE public.presence ADD COLUMN tool TEXT;
      ALTER TABLE public.presence ADD COLUMN is_chalk_holder BOOLEAN DEFAULT false;
    END IF;
  END IF;

  -- Rename camelCase to snake_case in friendships if they exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='friendships' AND column_name='userId') THEN
    ALTER TABLE public.friendships RENAME COLUMN "userId" TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='friendships' AND column_name='friendId') THEN
    ALTER TABLE public.friendships RENAME COLUMN "friendId" TO friend_id;
  END IF;
  
  -- Handle all lowercase variants
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='friendships' AND column_name='userid') THEN
    ALTER TABLE public.friendships RENAME COLUMN userid TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='friendships' AND column_name='friendid') THEN
    ALTER TABLE public.friendships RENAME COLUMN friendid TO friend_id;
  END IF;

  -- Add missing columns in case table was created with only some columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='friendships') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='friendships' AND column_name='user_id') THEN
      ALTER TABLE public.friendships ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='friendships' AND column_name='friend_id') THEN
      ALTER TABLE public.friendships ADD COLUMN friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='friendships' AND column_name='status') THEN
      ALTER TABLE public.friendships ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
  END IF;

  -- Fix potential camelCase in other tables just in case they were created that way
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='lastMessageId') THEN
    ALTER TABLE public.conversations RENAME COLUMN "lastMessageId" TO last_message_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='lastmessageid') THEN
    ALTER TABLE public.conversations RENAME COLUMN lastmessageid TO last_message_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='lastMessageAt') THEN
    ALTER TABLE public.conversations RENAME COLUMN "lastMessageAt" TO last_message_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='lastmessageat') THEN
    ALTER TABLE public.conversations RENAME COLUMN lastmessageat TO last_message_at;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='participants' AND column_name='conversationId') THEN
    ALTER TABLE public.participants RENAME COLUMN "conversationId" TO conversation_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='participants' AND column_name='conversationid') THEN
    ALTER TABLE public.participants RENAME COLUMN conversationid TO conversation_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='participants' AND column_name='userId') THEN
    ALTER TABLE public.participants RENAME COLUMN "userId" TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='participants' AND column_name='userid') THEN
    ALTER TABLE public.participants RENAME COLUMN userid TO user_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='conversationId') THEN
    ALTER TABLE public.messages RENAME COLUMN "conversationId" TO conversation_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='conversationid') THEN
    ALTER TABLE public.messages RENAME COLUMN conversationid TO conversation_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='senderId') THEN
    ALTER TABLE public.messages RENAME COLUMN "senderId" TO sender_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='senderid') THEN
    ALTER TABLE public.messages RENAME COLUMN senderid TO sender_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='replyTo') THEN
    ALTER TABLE public.messages RENAME COLUMN "replyTo" TO reply_to;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='replyto') THEN
    ALTER TABLE public.messages RENAME COLUMN replyto TO reply_to;
  END IF;

  -- Add missing columns to messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='messages') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='conversation_id') THEN
      ALTER TABLE public.messages ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='sender_id') THEN
      ALTER TABLE public.messages ADD COLUMN sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='content') THEN
      ALTER TABLE public.messages ADD COLUMN content TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='message_type') THEN
      ALTER TABLE public.messages ADD COLUMN message_type TEXT DEFAULT 'text';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='ip') THEN
      ALTER TABLE public.messages ADD COLUMN ip TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='is_pinned') THEN
      ALTER TABLE public.messages ADD COLUMN is_pinned BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='attachments') THEN
      ALTER TABLE public.messages ADD COLUMN attachments JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='math_meta') THEN
      ALTER TABLE public.messages ADD COLUMN math_meta JSONB;
    END IF;
  END IF;

  -- Add missing columns to profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_online') THEN
      ALTER TABLE public.profiles ADD COLUMN is_online BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='last_seen_at') THEN
      ALTER TABLE public.profiles ADD COLUMN last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='full_name') THEN
      ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='ip_addresses') THEN
      ALTER TABLE public.profiles ADD COLUMN ip_addresses TEXT[];
    END IF;
  END IF;

  -- Add missing columns to conversations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='conversations') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='name') THEN
      ALTER TABLE public.conversations ADD COLUMN name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='is_group') THEN
      ALTER TABLE public.conversations ADD COLUMN is_group BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='ip') THEN
      ALTER TABLE public.conversations ADD COLUMN ip TEXT;
    END IF;
    -- Set default for 'type' column to prevent null value constraint violations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='type') THEN
      ALTER TABLE public.conversations ALTER COLUMN type SET DEFAULT 'direct';
    END IF;
  END IF;

  -- Add missing columns to participants
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='participants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='participants' AND column_name='conversation_id') THEN
      ALTER TABLE public.participants ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='participants' AND column_name='user_id') THEN
      ALTER TABLE public.participants ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Add missing columns to canvas_sessions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='canvas_sessions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='canvas_sessions' AND column_name='version_audios') THEN
      ALTER TABLE public.canvas_sessions ADD COLUMN version_audios TEXT[];
    END IF;
  END IF;
END $$;

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    surname TEXT,
    middle_name TEXT,
    last_name TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'student',
    age INTEGER,
    school TEXT,
    district TEXT,
    country TEXT DEFAULT 'Uganda',
    grade_class TEXT,
    exup_code TEXT,
    student_nin TEXT,
    student_lin TEXT,
    parent_nin TEXT,
    student_contact TEXT,
    parent_contact TEXT,
    whatsapp_contact TEXT,
    bio TEXT,
    avatar_url TEXT,
    points INTEGER DEFAULT 0,
    preferred_subjects TEXT[],
    subject_combination TEXT,
    house TEXT,
    clubs TEXT[],
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ip_addresses TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_id UNIQUE(user_id)
);

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'direct', -- 'direct' or 'group'
    title TEXT,
    name TEXT,
    is_group BOOLEAN DEFAULT false,
    ip TEXT,
    last_message_id TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Participants Table
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    has_unreads BOOLEAN DEFAULT false,
    role TEXT DEFAULT 'member',
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    cleared_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'text',
    message_type TEXT DEFAULT 'text',
    body TEXT,
    content TEXT,
    ip TEXT,
    is_pinned BOOLEAN DEFAULT false,
    attachments JSONB,
    math_meta JSONB,
    reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    forwarded BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 4b. Trigger to restore conversation participant upon new message
CREATE OR REPLACE FUNCTION restore_participant_on_new_message()
RETURNS TRIGGER AS $
BEGIN
    UPDATE public.participants
    SET is_deleted = false,
        updated_at = timezone('utc'::text, now())
    WHERE conversation_id = NEW.conversation_id;
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restore_participant_trigger ON public.messages;
CREATE TRIGGER restore_participant_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE PROCEDURE restore_participant_on_new_message();


-- 5. Friendships Table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_friendship UNIQUE(user_id, friend_id)
);

-- 6. Attachments Table
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    type TEXT,
    name TEXT,
    size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Message Status Table (for delivery/read receipts)
CREATE TABLE IF NOT EXISTS public.message_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT, -- 'delivered', 'read'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_message_status UNIQUE(message_id, user_id, status)
);

-- 8. Presence Table
CREATE TABLE IF NOT EXISTS public.presence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    session_id TEXT,
    display_name TEXT,
    avatar_color TEXT,
    x NUMERIC,
    y NUMERIC,
    tool TEXT,
    is_chalk_holder BOOLEAN DEFAULT false
);

-- 9. Schools Table
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT,
    district TEXT,
    region TEXT,
    description TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Canvas Sessions Table
CREATE TABLE IF NOT EXISTS public.canvas_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT,
    message_id TEXT,
    parent_session_id TEXT,
    subject TEXT,
    curriculum_level TEXT,
    created_by TEXT,
    chalk_holder TEXT,
    chalk_holder_name TEXT,
    chalk_acquired_at TIMESTAMP WITH TIME ZONE,
    active_users TEXT[],
    edit_chain TEXT[],
    version_audios TEXT[],
    operation_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Element Operations Table
CREATE TABLE IF NOT EXISTS public.element_operations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT,
    element_id TEXT,
    operation_type TEXT,
    user_id TEXT,
    user_name TEXT,
    timestamp TEXT,
    patch TEXT,
    previous_patch TEXT,
    session_version INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Math Elements Table
CREATE TABLE IF NOT EXISTS public.math_elements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT,
    type TEXT,
    x NUMERIC,
    y NUMERIC,
    width NUMERIC,
    height NUMERIC,
    rotation NUMERIC DEFAULT 0,
    z_index INTEGER,
    content TEXT,
    style TEXT,
    created_by TEXT,
    last_edited_by TEXT,
    last_edited_at TEXT,
    version INTEGER,
    is_deleted BOOLEAN DEFAULT false,
    is_annotation BOOLEAN DEFAULT false,
    annotation_target_id TEXT,
    locked_by TEXT,
    locked_at TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Live Canvas Messages Table
CREATE TABLE IF NOT EXISTS public.live_canvas_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id TEXT NOT NULL,
    session_id TEXT,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    text_content TEXT,
    message_type TEXT DEFAULT 'text',
    attachments JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_canvas_messages_document_id ON public.live_canvas_messages(document_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.element_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.math_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_canvas_messages ENABLE ROW LEVEL SECURITY;

-- Create Policies (Allowing total access for development. In production, tighten these!)
DROP POLICY IF EXISTS "Allow all actions for profiles" ON public.profiles;
CREATE POLICY "Allow all actions for profiles" ON public.profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for conversations" ON public.conversations;
CREATE POLICY "Allow all actions for conversations" ON public.conversations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for participants" ON public.participants;
CREATE POLICY "Allow all actions for participants" ON public.participants FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for messages" ON public.messages;
CREATE POLICY "Allow all actions for messages" ON public.messages FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for friendships" ON public.friendships;
CREATE POLICY "Allow all actions for friendships" ON public.friendships FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for attachments" ON public.attachments;
CREATE POLICY "Allow all actions for attachments" ON public.attachments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for message_status" ON public.message_status;
CREATE POLICY "Allow all actions for message_status" ON public.message_status FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for presence" ON public.presence;
CREATE POLICY "Allow all actions for presence" ON public.presence FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for schools" ON public.schools;
CREATE POLICY "Allow all actions for schools" ON public.schools FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for canvas_sessions" ON public.canvas_sessions;
CREATE POLICY "Allow all actions for canvas_sessions" ON public.canvas_sessions FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for element_operations" ON public.element_operations;
CREATE POLICY "Allow all actions for element_operations" ON public.element_operations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for math_elements" ON public.math_elements;
CREATE POLICY "Allow all actions for math_elements" ON public.math_elements FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for live_canvas_messages" ON public.live_canvas_messages;
CREATE POLICY "Allow all actions for live_canvas_messages" ON public.live_canvas_messages FOR ALL USING (true);

-- Functions and Triggers for automatically updating timestamps
CREATE OR REPLACE FUNCTION update_modified_column()   
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_conversations_modtime ON public.conversations;
CREATE TRIGGER update_conversations_modtime BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_participants_modtime ON public.participants;
CREATE TRIGGER update_participants_modtime BEFORE UPDATE ON public.participants FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_messages_modtime ON public.messages;
CREATE TRIGGER update_messages_modtime BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_friendships_modtime ON public.friendships;
CREATE TRIGGER update_friendships_modtime BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_canvas_sessions_modtime ON public.canvas_sessions;
CREATE TRIGGER update_canvas_sessions_modtime BEFORE UPDATE ON public.canvas_sessions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_element_operations_modtime ON public.element_operations;
CREATE TRIGGER update_element_operations_modtime BEFORE UPDATE ON public.element_operations FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_math_elements_modtime ON public.math_elements;
CREATE TRIGGER update_math_elements_modtime BEFORE UPDATE ON public.math_elements FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_live_canvas_messages_modtime ON public.live_canvas_messages;
CREATE TRIGGER update_live_canvas_messages_modtime BEFORE UPDATE ON public.live_canvas_messages FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


-- 14. Annotations Table
CREATE TABLE IF NOT EXISTS public.annotations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    color TEXT NOT NULL,
    note TEXT,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
    user_id UUID PRIMARY KEY,
    email TEXT,
    account_status TEXT,
    registration_date TEXT,
    last_login TEXT,
    membership_level TEXT,
    student_lin TEXT,
    parent_nin TEXT,
    student_nin TEXT,
    text TEXT,
    color TEXT,
    note TEXT,
    timestamp BIGINT,
    surname TEXT,
    middle_name TEXT,
    last_name TEXT,
    role TEXT,
    age INT,
    country TEXT,
    district TEXT,
    school TEXT,
    class TEXT,
    parent_contact TEXT,
    whatsapp_contact TEXT,
    exup_code TEXT,
    ip TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Security Policies
DROP POLICY IF EXISTS "Allow all actions for annotations" ON public.annotations;
CREATE POLICY "Allow all actions for annotations" ON public.annotations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all actions for accounts" ON public.accounts;
CREATE POLICY "Allow all actions for accounts" ON public.accounts FOR ALL USING (true);

-- Modtime Triggers
DROP TRIGGER IF EXISTS update_annotations_modtime ON public.annotations;
CREATE TRIGGER update_annotations_modtime BEFORE UPDATE ON public.annotations FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_accounts_modtime ON public.accounts;
CREATE TRIGGER update_accounts_modtime BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE PROCEDURE update_modified_column();




-- ==========================================
-- MESSAGING SWIPE DELETION ARCHITECTURE REWRITE
-- ==========================================
-- Following the PDF: "SWIPE DELETE RELATIONSHIP: When a conversation is swipe-deleted in the UI:"

-- STEP 1: Local Update & STEP 2: Remote Push
-- We need is_deleted, last_read_at, last_message_at, cleared_at columns on the participants table
ALTER TABLE public.participants 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP WITH TIME ZONE;

-- STEP 3: Restoration
-- "If a new message is received in that conversation later, automatically update is_deleted to false remotely."
CREATE OR REPLACE FUNCTION restore_participant_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.participants
    SET is_deleted = false,
        updated_at = timezone('utc'::text, now())
    WHERE conversation_id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS restore_participant_trigger ON public.messages;
CREATE TRIGGER restore_participant_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE PROCEDURE restore_participant_on_new_message();
