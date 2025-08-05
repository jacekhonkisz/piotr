require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyContactEmailsMigration() {
  try {
    console.log('🔧 Applying contact_emails migration...');
    
    // First, let's check if the column already exists by trying to query it
    const { data: testData, error: testError } = await supabase
      .from('clients')
      .select('contact_emails')
      .limit(1);
    
    if (testError && testError.message.includes('column "contact_emails" does not exist')) {
      console.log('📝 Adding contact_emails column...');
      
      // The column doesn't exist, so we need to add it
      // Since we can't use RPC directly, let's try a different approach
      console.log('⚠️ Column does not exist. Please run the migration manually in Supabase dashboard or use the migration file.');
      console.log('📄 Migration SQL:');
      console.log(`
ALTER TABLE clients ADD COLUMN contact_emails TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE clients 
SET contact_emails = ARRAY[email] 
WHERE contact_emails IS NULL OR array_length(contact_emails, 1) IS NULL;

CREATE INDEX idx_clients_contact_emails ON clients USING GIN (contact_emails);
      `);
      return;
    }
    
    if (testError) {
      console.error('Error testing column:', testError);
      return;
    }
    
    console.log('✅ contact_emails column exists');
    
    // Get all clients that need migration
    const { data: clients, error: fetchError } = await supabase
      .from('clients')
      .select('id, email, contact_emails')
      .or('contact_emails.is.null,contact_emails.eq.{}');
    
    if (fetchError) {
      console.error('Error fetching clients:', fetchError);
      return;
    }
    
    if (!clients || clients.length === 0) {
      console.log('✅ All clients already have contact_emails set');
    } else {
      console.log(`📝 Migrating ${clients.length} clients...`);
      
      // Update each client
      for (const client of clients) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ contact_emails: [client.email] })
          .eq('id', client.id);
        
        if (updateError) {
          console.error(`Error updating client ${client.email}:`, updateError);
        } else {
          console.log(`✅ Updated ${client.email}`);
        }
      }
    }
    
    // Verify the migration
    const { data: verifyClients, error: verifyError } = await supabase
      .from('clients')
      .select('email, contact_emails')
      .limit(5);
    
    if (verifyError) {
      console.error('Error verifying migration:', verifyError);
    } else {
      console.log('✅ Migration verification:');
      verifyClients?.forEach(client => {
        console.log(`  ${client.email} -> [${client.contact_emails?.join(', ')}]`);
      });
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

applyContactEmailsMigration(); 