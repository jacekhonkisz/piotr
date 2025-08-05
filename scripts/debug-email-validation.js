require('dotenv').config({ path: '.env.local' });

// Test the exact validation logic from the component
const validateEmail = (email) => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
};

const validateEmails = (mainEmail, contactEmails) => {
  console.log('🔍 Testing email validation...');
  console.log('Main email:', mainEmail);
  console.log('Contact emails:', contactEmails);
  
  // Check if main email is valid
  const mainValid = validateEmail(mainEmail);
  console.log('Main email valid:', mainValid);
  
  if (!mainValid) {
    console.log('❌ Main email validation failed');
    return false;
  }
  
  // Check if all contact emails are valid
  for (let i = 0; i < contactEmails.length; i++) {
    const email = contactEmails[i];
    if (email) {
      const valid = validateEmail(email);
      console.log(`Contact email ${i + 1} (${email}) valid:`, valid);
      if (!valid) {
        console.log('❌ Contact email validation failed');
        return false;
      }
    }
  }
  
  // Check for duplicates
  const allEmails = [mainEmail, ...contactEmails.filter(email => email && email.trim() !== '')];
  const uniqueEmails = new Set(allEmails);
  console.log('All emails:', allEmails);
  console.log('Unique emails:', Array.from(uniqueEmails));
  console.log('Duplicate check:', allEmails.length === uniqueEmails.size);
  
  if (allEmails.length !== uniqueEmails.size) {
    console.log('❌ Duplicate emails detected');
    return false;
  }
  
  console.log('✅ All validations passed');
  return true;
};

// Test with the emails from your screenshot
console.log('=== Testing with your emails ===');
const result = validateEmails(
  'jac.honkisz@gmail.com',
  ['a.honkisz01@gmail.com']
);

console.log('\n=== Final result ===');
console.log('Validation passed:', result);

// Test individual email validation
console.log('\n=== Individual email tests ===');
console.log('jac.honkisz@gmail.com:', validateEmail('jac.honkisz@gmail.com'));
console.log('a.honkisz01@gmail.com:', validateEmail('a.honkisz01@gmail.com'));

// Test for potential duplicates
console.log('\n=== Duplicate detection test ===');
const testEmails = ['jac.honkisz@gmail.com', 'a.honkisz01@gmail.com'];
const uniqueTest = new Set(testEmails);
console.log('Original:', testEmails);
console.log('Unique:', Array.from(uniqueTest));
console.log('Has duplicates:', testEmails.length !== uniqueTest.size); 