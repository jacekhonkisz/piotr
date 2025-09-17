#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function getDomainRecords() {
  console.log('🔍 Getting DNS records for pbmreports.pl...\n');
  
  try {
    const response = await fetch('https://api.resend.com/domains/f2859f39-87d5-4b8b-9ec1-f8e4dac28782', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log(`❌ Failed to fetch domain details: ${JSON.stringify(error)}`);
      return;
    }
    
    const domain = await response.json();
    
    console.log(`📧 Domain: ${domain.name}`);
    console.log(`🆔 ID: ${domain.id}`);
    console.log(`📊 Status: ${domain.status}`);
    console.log(`🌍 Region: ${domain.region}`);
    
    if (domain.records && domain.records.length > 0) {
      console.log('\n📋 DNS Records to add to your domain:');
      console.log('='.repeat(60));
      
      domain.records.forEach((record, index) => {
        console.log(`\n${index + 1}. Record Type: ${record.record}`);
        console.log(`   Name: ${record.name}`);
        console.log(`   Value: ${record.value}`);
        console.log(`   Priority: ${record.priority || 'N/A'}`);
        
        if (record.record === 'MX') {
          console.log('   📧 This is for email routing');
        } else if (record.record === 'TXT') {
          console.log('   🔐 This is for domain verification');
        } else if (record.record === 'CNAME') {
          console.log('   🔗 This is for subdomain routing');
        }
      });
      
      console.log('\n📝 Instructions:');
      console.log('1. Go to your domain registrar (where you bought pbmreports.pl)');
      console.log('2. Find the DNS management section');
      console.log('3. Add each of the records shown above');
      console.log('4. Wait for DNS propagation (can take up to 24 hours)');
      console.log('5. Resend will automatically verify once DNS is updated');
      
    } else {
      console.log('\n⚠️  No DNS records found. This might indicate an issue.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getDomainRecords();
