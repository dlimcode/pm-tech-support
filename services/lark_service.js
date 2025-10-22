// LarkService - Handles all Lark API interactions
// Extracted from server.js as part of Phase 1 refactoring

class LarkService {
  constructor(appId, appSecret) {
    if (!appId || !appSecret) {
      throw new Error('LarkService requires appId and appSecret');
    }
    this.appId = appId;
    this.appSecret = appSecret;
  }

  /**
   * Get tenant access token from Lark API
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    try {
      console.log('Getting Lark access token...');

      const tokenResponse = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: this.appId,
          app_secret: this.appSecret
        })
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.code !== 0) {
        console.error('Failed to get access token:', tokenData.msg);
        throw new Error(`Failed to get access token: ${tokenData.msg}`);
      }

      console.log('Access token obtained');
      return tokenData.tenant_access_token;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  /**
   * Get user information from Lark API
   * @param {string|object} userId - User ID (can be object with open_id, user_id, etc.)
   * @returns {Promise<object|null>} User information or null
   */
  async getUserInfo(userId) {
    try {
      console.log('Fetching user info for:', userId);
      console.log('User ID type:', typeof userId, 'Value:', JSON.stringify(userId));

      // Extract the actual user ID from the sender object if needed
      let actualUserId = userId;
      if (typeof userId === 'object') {
        // Try different ID properties in order of preference
        actualUserId = userId.open_id || userId.user_id || userId.id;
        console.log('Extracted user ID from object:', actualUserId);
        console.log('Available IDs in object:', {
          open_id: userId.open_id,
          user_id: userId.user_id,
          union_id: userId.union_id,
          id: userId.id
        });
      }

      if (!actualUserId) {
        console.error('No valid user ID provided');
        return null;
      }

      console.log('Using user ID for API call:', actualUserId);

      // Get access token
      const accessToken = await this.getAccessToken();

      // Determine the correct endpoint based on user ID format
      let endpoint;
      let userIdType;

      if (actualUserId.startsWith('ou_')) {
        // This is an open_id
        endpoint = `https://open.larksuite.com/open-apis/contact/v3/users/${actualUserId}?user_id_type=open_id`;
        userIdType = 'open_id';
      } else if (actualUserId.match(/^[a-f0-9]{8}$/)) {
        // This looks like a user_id (8 hex characters)
        endpoint = `https://open.larksuite.com/open-apis/contact/v3/users/${actualUserId}?user_id_type=user_id`;
        userIdType = 'user_id';
      } else {
        // Default to treating as open_id
        endpoint = `https://open.larksuite.com/open-apis/contact/v3/users/${actualUserId}?user_id_type=open_id`;
        userIdType = 'open_id';
      }

      console.log('Using endpoint:', endpoint);
      console.log('User ID type determined:', userIdType);

      try {
        console.log('Calling Lark API:', endpoint);

        const userResponse = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const userData = await userResponse.json();
        console.log('User API response:', userData);

        if (userData.code === 0 && userData.data?.user) {
          const userInfo = {
            user_id: actualUserId,
            name: userData.data.user.name || 'Unknown User',
            email: userData.data.user.email || null,
            mobile: userData.data.user.mobile || null,
            avatar: userData.data.user.avatar?.avatar_240 || null
          };

          console.log('User info fetched successfully:', userInfo);
          return userInfo;
        } else {
          console.log('API call failed:', 'Code:', userData.code, 'Message:', userData.msg);
        }
      } catch (apiError) {
        console.log('API call error:', apiError.message);
      }

      console.error('API call failed for user ID:', actualUserId);

      // Try a simple fallback approach - return basic info with the user ID
      console.log('Attempting fallback user info creation');
      const userIdString = String(actualUserId);
      return {
        user_id: actualUserId,
        name: userIdString.includes('ou_') ? 'Lark User (ID: ' + userIdString.substring(0, 10) + '...)' : 'Lark User',
        email: null,
        mobile: null,
        avatar: null,
        fallback: true
      };
    } catch (error) {
      console.error('Error fetching user info:', error);
      console.error('Stack trace:', error.stack);
      return null;
    }
  }

  /**
   * Send message to Lark chat or user
   * @param {string} chatId - Chat ID or user ID
   * @param {string} message - Message text to send
   * @returns {Promise<void>}
   */
  async sendMessage(chatId, message) {
    try {
      console.log('Sending message to chat:', chatId);
      console.log('Message content:', message);

      // Get access token
      const accessToken = await this.getAccessToken();

      // Detect the ID type based on the chat ID format
      let idType = 'chat_id';
      if (chatId.startsWith('ou_')) {
        idType = 'user_id';
      } else if (chatId.startsWith('oc_')) {
        idType = 'chat_id';
      } else if (chatId.startsWith('og_')) {
        idType = 'chat_id';
      }

      const messagePayload = {
        receive_id_type: idType,
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({
          text: message
        }),
        uuid: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      console.log('Message payload:', JSON.stringify(messagePayload, null, 2));

      const messageResponse = await fetch(`https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=${idType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({
            text: message
          }),
          uuid: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })
      });

      const messageData = await messageResponse.json();

      console.log('Lark API response status:', messageResponse.status);
      console.log('Lark API response data:', JSON.stringify(messageData, null, 2));

      if (messageData.code !== 0) {
        console.error('Lark API Error Details:', {
          code: messageData.code,
          msg: messageData.msg,
          data: messageData.data,
          error: messageData.error
        });
        throw new Error(`Failed to send message: ${messageData.msg || 'Unknown error'}`);
      }

      console.log('Message sent successfully:', messageData);
    } catch (error) {
      console.error('Error sending message to Lark:', error);
      console.error('Error details:', error.message);
    }
  }
}

module.exports = LarkService;
