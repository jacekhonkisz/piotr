import { GoogleAuth } from 'google-auth-library';
import logger from './logger';

export interface GoogleAdsServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export class GoogleAdsServiceAccountService {
  private auth: GoogleAuth;
  private credentials: GoogleAdsServiceAccountCredentials;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(serviceAccountKey: GoogleAdsServiceAccountCredentials) {
    this.credentials = serviceAccountKey;
    this.auth = new GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/adwords']
    });
  }

  /**
   * Get access token (generated on-demand, never expires)
   */
  async getAccessToken(): Promise<string> {
    try {
      // Check if we have a valid cached token
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      logger.info('🔄 Generating new Google Ads service account access token');
      
      const client = await this.auth.getClient();
      const accessTokenResponse = await client.getAccessToken();
      
      if (!accessTokenResponse.token) {
        throw new Error('Failed to get access token from service account');
      }

      // Cache the token for 1 hour (even though it's valid for 1 hour)
      this.accessToken = accessTokenResponse.token;
      this.tokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes

      logger.info('✅ Google Ads service account access token generated successfully');
      return this.accessToken;
    } catch (error) {
      logger.error('❌ Error generating service account access token:', error);
      throw new Error(`Service account authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test service account authentication
   */
  async testAuthentication(): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('🔍 Testing Google Ads service account authentication');
      
      const accessToken = await this.getAccessToken();
      
      // Test with a simple Google Ads API call
      const response = await fetch('https://googleads.googleapis.com/v14/customers', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        logger.info('✅ Google Ads service account authentication successful');
        return { success: true };
      } else {
        const errorText = await response.text();
        logger.error('❌ Google Ads service account authentication failed:', response.status, errorText);
        return { success: false, error: `Authentication failed: ${response.status} - ${errorText}` };
      }
    } catch (error) {
      logger.error('❌ Error testing service account authentication:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get service account info
   */
  getServiceAccountInfo() {
    return {
      client_email: this.credentials.client_email,
      project_id: this.credentials.project_id,
      type: this.credentials.type
    };
  }
}
