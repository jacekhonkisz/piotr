require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function findBelmonte() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%belmonte%');
  
  console.log('Clients matching "belmonte":', clients);
}

findBelmonte();
