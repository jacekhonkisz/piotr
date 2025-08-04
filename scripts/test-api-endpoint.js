// Test script to verify the API endpoint is working

const testApiEndpoint = async () => {
  try {
    console.log('Testing API endpoint...');
    
    // Test data for March 2024
    const testData = {
      dateRange: {
        start: '2024-03-01',
        end: '2024-03-31'
      },
      clientId: '5703e71f-1222-4178-885c-ce72746d0713' // Real client ID from logs
    };
    
    console.log('Test request data:', testData);
    
    // Make API call
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail without proper auth, but we can see the structure
      },
      body: JSON.stringify(testData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Run the test
testApiEndpoint(); 