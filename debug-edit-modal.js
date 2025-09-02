/**
 * Debug script to verify EditClientModal Google Ads integration
 */

const fs = require('fs');

const checkEditModalIntegration = () => {
  console.log('🔍 Debugging EditClientModal Google Ads Integration...\n');
  
  const editModalContent = fs.readFileSync('./src/components/EditClientModal.tsx', 'utf8');
  
  // Check 1: Platform selection state
  const hasPlatformSelection = editModalContent.includes('selectedPlatform') &&
                              editModalContent.includes('setSelectedPlatform') &&
                              editModalContent.includes('useState<\'meta\' | \'google\'>');
  console.log(`✅ Platform selection state: ${hasPlatformSelection}`);
  
  // Check 2: Google Ads form fields
  const hasGoogleAdsFields = editModalContent.includes('google_ads_customer_id') &&
                            editModalContent.includes('google_ads_refresh_token') &&
                            editModalContent.includes('google_ads_enabled');
  console.log(`✅ Google Ads form fields: ${hasGoogleAdsFields}`);
  
  // Check 3: Platform tabs
  const hasPlatformTabs = editModalContent.includes('Platform Selection Tabs') ||
                         (editModalContent.includes('selectedPlatform === \'meta\'') &&
                          editModalContent.includes('selectedPlatform === \'google\''));
  console.log(`✅ Platform tabs logic: ${hasPlatformTabs}`);
  
  // Check 4: Google Ads validation function
  const hasGoogleValidation = editModalContent.includes('validateGoogleAdsCredentials') &&
                             editModalContent.includes('customerIdFormat') &&
                             editModalContent.includes('refreshTokenFormat');
  console.log(`✅ Google Ads validation: ${hasGoogleValidation}`);
  
  // Check 5: Form submission with Google Ads
  const hasGoogleSubmission = editModalContent.includes('google_ads_customer_id !== client.google_ads_customer_id') &&
                             editModalContent.includes('updates.google_ads_enabled');
  console.log(`✅ Google Ads in submission: ${hasGoogleSubmission}`);
  
  // Check 6: Required icons imported
  const hasRequiredIcons = editModalContent.includes('Facebook') &&
                          editModalContent.includes('Target');
  console.log(`✅ Required icons imported: ${hasRequiredIcons}`);
  
  // Check 7: Token fields visibility
  const hasTokenFieldsLogic = editModalContent.includes('showTokenFields') &&
                             editModalContent.includes('setShowTokenFields') &&
                             editModalContent.includes('Aktualizuj tokeny');
  console.log(`✅ Token fields visibility logic: ${hasTokenFieldsLogic}`);
  
  // Check 8: Initialize Google Ads data from client
  const hasGoogleAdsInit = editModalContent.includes('client.google_ads_customer_id') &&
                          editModalContent.includes('client.google_ads_refresh_token') &&
                          editModalContent.includes('client.google_ads_enabled');
  console.log(`✅ Google Ads data initialization: ${hasGoogleAdsInit}`);
  
  console.log('\n📊 Integration Summary:');
  console.log('======================');
  
  const checks = [
    hasPlatformSelection,
    hasGoogleAdsFields,
    hasPlatformTabs,
    hasGoogleValidation,
    hasGoogleSubmission,
    hasRequiredIcons,
    hasTokenFieldsLogic,
    hasGoogleAdsInit
  ];
  
  const passedChecks = checks.filter(check => check).length;
  const totalChecks = checks.length;
  
  console.log(`Passed: ${passedChecks}/${totalChecks} checks`);
  
  if (passedChecks === totalChecks) {
    console.log('\n🎉 EditClientModal Google Ads integration is COMPLETE!');
    console.log('\n📋 Usage Instructions:');
    console.log('1. Open any client edit modal');
    console.log('2. Click "Aktualizuj tokeny" button');
    console.log('3. You should see platform tabs: Meta Ads | Google Ads');
    console.log('4. Click "Google Ads" tab to see Google Ads fields');
    console.log('5. Fill in Customer ID and Refresh Token');
    console.log('6. Enable the checkbox for Google Ads reporting');
    console.log('7. Click "Test połączenia Google Ads" to validate');
    console.log('8. Save changes');
  } else {
    console.log('\n⚠️  Some integration components are missing.');
    console.log('Review the failed checks above.');
  }
  
  // Additional debugging: Find the exact location of the token management section
  const tokenSectionRegex = /Zarządzanie tokenami API[\s\S]*?showTokenFields.*?\{([\s\S]*?)\}/;
  const tokenSectionMatch = editModalContent.match(tokenSectionRegex);
  
  if (tokenSectionMatch) {
    console.log('\n🔍 Token Management Section Found:');
    console.log('The section exists and should show platform tabs when "Aktualizuj tokeny" is clicked.');
  } else {
    console.log('\n❌ Token Management Section NOT found in expected format.');
  }
  
  return passedChecks === totalChecks;
};

// Run the check
if (require.main === module) {
  checkEditModalIntegration();
} 