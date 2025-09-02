#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function checkDomains() {
  console.log('🔍 Checking Resend domains...\n');
  
  try {
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log(`❌ Failed to fetch domains: ${JSON.stringify(error)}`);
      return;
    }
    
    const result = await response.json();
    console.log('📧 Your Resend domains:');
    console.log('='.repeat(50));
    
    if (result.data && result.data.length > 0) {
      result.data.forEach((domain, index) => {
        console.log(`\n${index + 1}. Domain: ${domain.name}`);
        console.log(`   ID: ${domain.id}`);
        console.log(`   Status: ${domain.status}`);
        console.log(`   Region: ${domain.region || 'N/A'}`);
        console.log(`   Created: ${new Date(domain.created_at).toLocaleString()}`);
        
        if (domain.records && domain.records.length > 0) {
          console.log('   DNS Records:');
          domain.records.forEach(record => {
            console.log(`     ${record.record} ${record.name} ${record.value}`);
          });
        }
      });
      
      // Find the domain with the ID you mentioned
      const targetDomain = result.data.find(d => d.id === 'f2859f39-87d5-4b8b-9ec1-f8e4dac28782');
      if (targetDomain) {
        console.log(`\n🎯 Found your target domain: ${targetDomain.name}`);
        console.log(`   Status: ${targetDomain.status}`);
        
        if (targetDomain.status === 'verified') {
          console.log('   ✅ Domain is verified and ready to use!');
        } else {
          console.log('   ⚠️  Domain needs verification. Please add the DNS records shown above.');
        }
      }
      
    } else {
      console.log('No domains found.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDomains();
