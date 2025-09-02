#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function updateDomainSettings() {
  console.log('🔧 Updating domain settings for pbmreports.pl...\n');
  
  try {
    const response = await fetch('https://api.resend.com/domains/f2859f39-87d5-4b8b-9ec1-f8e4dac28782', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        openTracking: false,
        clickTracking: true,
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log(`❌ Failed to update domain: ${JSON.stringify(error)}`);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Domain settings updated successfully!');
    console.log(`📧 Domain: ${result.name}`);
    console.log(`📊 Status: ${result.status}`);
    console.log(`🔍 Open Tracking: ${result.openTracking ? 'Enabled' : 'Disabled'}`);
    console.log(`🖱️ Click Tracking: ${result.clickTracking ? 'Enabled' : 'Disabled'}`);
    
    if (result.status === 'verified') {
      console.log('\n🎉 Domain is verified and ready to use!');
      console.log('You can now send emails from: reports@pbmreports.pl');
    } else {
      console.log('\n⚠️  Domain is still pending verification.');
      console.log('Please add the DNS records to your domain registrar.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

updateDomainSettings();
