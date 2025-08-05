-- Add contact_emails field to clients table for multiple email addresses
-- This allows sending reports to multiple email addresses per client

ALTER TABLE clients 
ADD COLUMN contact_emails TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add comment to explain the field
COMMENT ON COLUMN clients.contact_emails IS 'Array of email addresses for sending reports. First email is the main login email.';

-- Create an index for better performance when querying by email addresses
CREATE INDEX idx_clients_contact_emails ON clients USING GIN (contact_emails);

-- Migrate existing single email to contact_emails array
-- This ensures backward compatibility by moving the existing email to the first position
UPDATE clients 
SET contact_emails = ARRAY[email] 
WHERE contact_emails IS NULL OR array_length(contact_emails, 1) IS NULL;

-- Add a constraint to ensure at least one email is always present
ALTER TABLE clients 
ADD CONSTRAINT clients_contact_emails_not_empty 
CHECK (array_length(contact_emails, 1) > 0);

-- Add a constraint to ensure all emails are valid format
ALTER TABLE clients 
ADD CONSTRAINT clients_contact_emails_valid_format 
CHECK (
  array_length(contact_emails, 1) IS NULL OR 
  (SELECT bool_and(email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') 
   FROM unnest(contact_emails) AS email)
); 