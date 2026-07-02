const db = require('./db');
const axios = require('axios');

class OmniGateway {
  constructor(provider) {
    this.provider = provider;
  }

  // Fetch the next available Alive key
  async getActiveKey() {
    const [rows] = await db.query(
      `SELECT id, api_key, base_url, name FROM api_keys_manager 
       WHERE provider = ? AND status = 'Alive' 
       ORDER BY id ASC LIMIT 1`, 
      [this.provider]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Mark a key as Limit/Dead so the system rotates to the next one
  async markKeyAsLimit(id) {
    await db.query(`UPDATE api_keys_manager SET status = 'Limit' WHERE id = ?`, [id]);
    console.log(`[OmniGateway] Key ID ${id} marked as Limit. Rotating...`);
  }

  // Increment usage count (optional metrics)
  async incrementUsage(id) {
    await db.query(`UPDATE api_keys_manager SET used_count = used_count + 1 WHERE id = ?`, [id]);
  }

  // Central execute function that handles failover automatically
  async execute(requestFn) {
    let success = false;
    let attempts = 0;
    const maxAttempts = 3;
    let result = null;

    while (!success && attempts < maxAttempts) {
      const activeKeyRow = await this.getActiveKey();
      
      if (!activeKeyRow) {
        throw new Error(`[OmniGateway] No 'Alive' keys available for provider: ${this.provider}. All keys are Limit/Dead.`);
      }

      const { id, api_key, base_url, name } = activeKeyRow;
      console.log(`[OmniGateway] Attempting request using key: ${name}`);

      try {
        // Execute the actual API request passing the active key details
        result = await requestFn(api_key, base_url);
        success = true;
        await this.incrementUsage(id);
      } catch (error) {
        // Check if error is Rate Limit (429) or Quota Exceeded
        if (error.response && (error.response.status === 429 || error.response.status === 402 || error.response.status === 401)) {
          console.warn(`[OmniGateway] 429 Rate Limit Hit on key: ${name}`);
          await this.markKeyAsLimit(id);
          attempts++;
        } else {
          // If it's a different error (e.g. 500, network issue), throw it without killing the key
          throw error;
        }
      }
    }

    if (!success) {
      throw new Error(`[OmniGateway] Execution failed after ${maxAttempts} attempts due to limits.`);
    }

    return result;
  }
}

module.exports = OmniGateway;
