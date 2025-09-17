const { createClient } = require('@supabase/supabase-js');
const { MetaAPIService } = require('../src/lib/meta-api');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function validateAllTokens() {
  console.log('🔍 Starting token validation for all clients...');

  try {
    // Get all clients
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*');

    if (error) {
      console.error('Error fetching clients:', error);
      return;
    }

    console.log(`📊 Found ${clients.length} clients to validate`);

    let validCount = 0;
    let invalidCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;

    for (const client of clients) {
      console.log(`\n🔍 Validating token for client: ${client.name} (${client.email})`);
      
      try {
        const metaService = new MetaAPIService(client.meta_access_token);
        const tokenValidation = await metaService.validateAndConvertToken();

        let newStatus = 'unknown';
        let needsUpdate = false;

        if (tokenValidation.valid) {
          if (tokenValidation.isLongLived) {
            newStatus = 'valid';
            validCount++;
            console.log('  ✅ Token is valid and long-lived');
          } else if (tokenValidation.expiresAt) {
            const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry <= 0) {
              newStatus = 'expired';
              expiredCount++;
              console.log(`  ❌ Token expired ${Math.abs(daysUntilExpiry)} days ago`);
            } else if (daysUntilExpiry <= 30) {
              newStatus = 'expiring_soon';
              expiringSoonCount++;
              console.log(`  ⚠️ Token expires in ${daysUntilExpiry} days`);
            } else {
              newStatus = 'valid';
              validCount++;
              console.log(`  ✅ Token is valid, expires in ${daysUntilExpiry} days`);
            }
          } else {
            newStatus = 'valid';
            validCount++;
            console.log('  ✅ Token is valid');
          }

          // Check if we need to convert the token
          if (tokenValidation.convertedToken) {
            console.log('  🔄 Converting token to long-lived...');
            needsUpdate = true;
          }
        } else {
          newStatus = 'invalid';
          invalidCount++;
          console.log(`  ❌ Token validation failed: ${tokenValidation.error}`);
        }

        // Update client record if status changed or token was converted
        if (client.token_health_status !== newStatus || needsUpdate) {
          const updateData = {
            token_health_status: newStatus,
            last_token_validation: new Date().toISOString(),
            api_status: tokenValidation.valid ? 'valid' : 'invalid'
          };

          if (tokenValidation.convertedToken) {
            updateData.meta_access_token = tokenValidation.convertedToken;
            updateData.token_refresh_count = (client.token_refresh_count || 0) + 1;
          }

          if (tokenValidation.expiresAt) {
            updateData.token_expires_at = tokenValidation.expiresAt.toISOString();
          }

          const { error: updateError } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', client.id);

          if (updateError) {
            console.error(`  ❌ Failed to update client ${client.name}:`, updateError);
          } else {
            console.log(`  ✅ Updated client ${client.name} status to: ${newStatus}`);
          }
        } else {
          console.log(`  ℹ️ No update needed for client ${client.name}`);
        }

      } catch (error) {
        console.error(`  ❌ Error validating token for client ${client.name}:`, error.message);
        invalidCount++;
        
        // Update status to invalid
        await supabase
          .from('clients')
          .update({
            token_health_status: 'invalid',
            last_token_validation: new Date().toISOString(),
            api_status: 'invalid'
          })
          .eq('id', client.id);
      }
    }

    // Print summary
    console.log('\n📊 Token Validation Summary:');
    console.log(`  ✅ Valid: ${validCount}`);
    console.log(`  ⚠️ Expiring Soon: ${expiringSoonCount}`);
    console.log(`  ❌ Expired: ${expiredCount}`);
    console.log(`  ❌ Invalid: ${invalidCount}`);
    console.log(`  📈 Total: ${clients.length}`);

    // Send email alert if there are issues
    if (invalidCount > 0 || expiredCount > 0 || expiringSoonCount > 0) {
      console.log('\n🚨 Alerts:');
      if (invalidCount > 0) {
        console.log(`  - ${invalidCount} invalid tokens need immediate attention`);
      }
      if (expiredCount > 0) {
        console.log(`  - ${expiredCount} expired tokens need refresh`);
      }
      if (expiringSoonCount > 0) {
        console.log(`  - ${expiringSoonCount} tokens expiring soon`);
      }
    }

  } catch (error) {
    console.error('❌ Error in token validation script:', error);
  }
}

// Run the validation
if (require.main === module) {
  validateAllTokens()
    .then(() => {
      console.log('\n✅ Token validation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Token validation failed:', error);
      process.exit(1);
    });
}

module.exports = { validateAllTokens }; 