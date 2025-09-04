#!/usr/bin/env node

// Alternative method to generate Google Ads refresh token
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function generateToken() {
  console.log('🔑 Google Ads Refresh Token Generator\n');
  
  const clientId = await ask('Enter your OAuth Client ID: ');
  const clientSecret = await ask('Enter your OAuth Client Secret: ');
  
  // Generate authorization URL
  const scope = 'https://www.googleapis.com/auth/adwords';
  const redirectUri = 'urn:ietf:wg:oauth:2.0:oob';
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `response_type=code&` +
    `access_type=offline&` +
    `prompt=consent`;
  
  console.log('\n📋 Steps:');
  console.log('1. Open this URL in your browser:');
  console.log('\n' + authUrl + '\n');
  console.log('2. Sign in with your Google Ads Manager account');
  console.log('3. Grant permissions');
  console.log('4. Copy the authorization code from the page');
  
  const authCode = await ask('\nEnter the authorization code: ');
  
  try {
    // Exchange code for tokens
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });
    
    if (response.ok) {
      const tokens = await response.json();
      console.log('\n✅ Success! Your refresh token is:');
      console.log('\n🔑 REFRESH TOKEN (copy this):');
      console.log(tokens.refresh_token);
      console.log('\n📋 Next steps:');
      console.log('1. Go to /admin/google-ads-tokens');
      console.log('2. Paste this refresh token');
      console.log('3. Save and test the connection');
    } else {
      const error = await response.text();
      console.log('❌ Error:', error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  rl.close();
}

generateToken();
