import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function runMigration() {
  console.log('Running voice type migration...');

  try {
    // Add voice_type column
    console.log('Adding voice_type column...');
    await sql`
      ALTER TABLE user_voice_settings
      ADD COLUMN IF NOT EXISTS voice_type TEXT DEFAULT 'reply' CHECK (voice_type IN ('post', 'reply'))
    `;
    console.log('✓ voice_type column added');

    // Add special_notes column
    console.log('Adding special_notes column...');
    await sql`
      ALTER TABLE user_voice_settings
      ADD COLUMN IF NOT EXISTS special_notes TEXT
    `;
    console.log('✓ special_notes column added');

    // Drop old unique constraint (may not exist, that's ok)
    console.log('Updating unique constraint...');
    try {
      await sql`
        ALTER TABLE user_voice_settings
        DROP CONSTRAINT IF EXISTS user_voice_settings_user_id_key
      `;
    } catch (e) {
      console.log('  (old constraint did not exist, continuing...)');
    }

    // Add new compound unique constraint
    try {
      await sql`
        ALTER TABLE user_voice_settings
        ADD CONSTRAINT user_voice_settings_user_id_voice_type_key UNIQUE (user_id, voice_type)
      `;
      console.log('✓ compound unique constraint added');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✓ compound unique constraint already exists');
      } else {
        throw e;
      }
    }

    // Create chat history table
    console.log('Creating voice_editor_chat_history table...');
    await sql`
      CREATE TABLE IF NOT EXISTS voice_editor_chat_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        voice_type TEXT NOT NULL CHECK (voice_type IN ('post', 'reply')),
        messages JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, voice_type)
      )
    `;
    console.log('✓ voice_editor_chat_history table created');

    // Enable RLS
    console.log('Enabling RLS...');
    await sql`
      ALTER TABLE voice_editor_chat_history ENABLE ROW LEVEL SECURITY
    `;
    console.log('✓ RLS enabled');

    // Create RLS policies
    console.log('Creating RLS policies...');

    // Drop existing policies first (in case of re-run)
    await sql`DROP POLICY IF EXISTS "Users can view their own chat history" ON voice_editor_chat_history`;
    await sql`DROP POLICY IF EXISTS "Users can insert their own chat history" ON voice_editor_chat_history`;
    await sql`DROP POLICY IF EXISTS "Users can update their own chat history" ON voice_editor_chat_history`;
    await sql`DROP POLICY IF EXISTS "Users can delete their own chat history" ON voice_editor_chat_history`;

    await sql`
      CREATE POLICY "Users can view their own chat history" ON voice_editor_chat_history
      FOR SELECT USING (auth.uid() = user_id)
    `;
    await sql`
      CREATE POLICY "Users can insert their own chat history" ON voice_editor_chat_history
      FOR INSERT WITH CHECK (auth.uid() = user_id)
    `;
    await sql`
      CREATE POLICY "Users can update their own chat history" ON voice_editor_chat_history
      FOR UPDATE USING (auth.uid() = user_id)
    `;
    await sql`
      CREATE POLICY "Users can delete their own chat history" ON voice_editor_chat_history
      FOR DELETE USING (auth.uid() = user_id)
    `;
    console.log('✓ RLS policies created');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
