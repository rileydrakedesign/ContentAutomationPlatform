-- Voice Tab Refactoring Migration
-- Adds voice_type column to support separate Post and Reply voice settings

-- Add voice_type column to user_voice_settings
ALTER TABLE user_voice_settings
ADD COLUMN IF NOT EXISTS voice_type TEXT DEFAULT 'reply' CHECK (voice_type IN ('post', 'reply'));

-- Add special_notes column for custom AI instructions
ALTER TABLE user_voice_settings
ADD COLUMN IF NOT EXISTS special_notes TEXT;

-- Drop existing unique constraint on user_id (if exists)
ALTER TABLE user_voice_settings
DROP CONSTRAINT IF EXISTS user_voice_settings_user_id_key;

-- Add new compound unique constraint for user_id + voice_type
ALTER TABLE user_voice_settings
ADD CONSTRAINT user_voice_settings_user_id_voice_type_key UNIQUE (user_id, voice_type);

-- Create table for chat history in voice editor
CREATE TABLE IF NOT EXISTS voice_editor_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_type TEXT NOT NULL CHECK (voice_type IN ('post', 'reply')),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, voice_type)
);

-- Enable RLS on new table
ALTER TABLE voice_editor_chat_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for voice_editor_chat_history
CREATE POLICY "Users can view their own chat history" ON voice_editor_chat_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat history" ON voice_editor_chat_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat history" ON voice_editor_chat_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat history" ON voice_editor_chat_history
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_voice_editor_chat_history_user_voice
ON voice_editor_chat_history(user_id, voice_type);
