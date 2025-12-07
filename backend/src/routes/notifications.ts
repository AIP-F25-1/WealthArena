/**
 * Notifications Routes
 * User notifications and alerts
 */

import express from 'express';
import { executeQuery, executeProcedure } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';

const router = express.Router();

/**
 * GET /api/notifications
 * Get user's notifications
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    
    if (!userId || typeof userId !== 'number') {
      console.error('Notifications request with invalid userId:', {
        userId,
        userIdType: typeof userId
      });
      return errorResponse(res, `User ID not found in token (received: ${userId})`, 401);
    }
    const { 
      status = 'all', 
      type, 
      limit = 50, 
      offset = 0,
      unread_only = 'false'
    } = req.query;

    let query = `
      SELECT 
        n.NotificationID,
        n.UserID,
        n.Type,
        n.Title,
        n.Message,
        n.Data,
        n.IsRead,
        n.Priority,
        n.CreatedAt,
        n.ReadAt,
        n.ExpiresAt
      FROM Notifications n
      WHERE n.UserID = @userId
    `;

    const params: any = { userId };

    if (status === 'unread') {
      query += ` AND n.IsRead = 0`;
    } else if (status === 'read') {
      query += ` AND n.IsRead = 1`;
    }

    if (type) {
      query += ` AND n.Type = @type`;
      params.type = type;
    }

    if (unread_only === 'true') {
      query += ` AND n.IsRead = 0`;
    }

    query += ` ORDER BY n.CreatedAt DESC`;

    query = `SELECT * FROM (${query}) as notifications OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    params.offset = Number.parseInt(offset as string);
    params.limit = Number.parseInt(limit as string);

    const result = await executeQuery(query, params);

    return successResponse(res, {
      notifications: result.recordset,
      pagination: {
        limit: Number.parseInt(limit as string),
        offset: Number.parseInt(offset as string),
        total: result.recordset.length
      }
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch notifications', 500, error);
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    
    if (!userId || typeof userId !== 'number') {
      console.error('Unread-count request with invalid userId:', {
        userId,
        userIdType: typeof userId
      });
      return errorResponse(res, `User ID not found in token (received: ${userId})`, 401);
    }

    const query = `
      SELECT COUNT(*) as UnreadCount
      FROM Notifications
      WHERE UserID = @userId AND IsRead = 0
    `;

    const result = await executeQuery(query, { userId });

    const unreadData = result.recordset[0] as { UnreadCount?: number } | undefined;
    return successResponse(res, {
      unreadCount: unreadData?.UnreadCount || 0
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch unread count', 500, error);
  }
});

/**
 * PUT /api/notifications/:notificationId/read
 * Mark notification as read
 */
router.put('/:notificationId/read', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId!;

    const query = `
      UPDATE Notifications 
      SET IsRead = 1, ReadAt = GETUTCDATE()
      WHERE NotificationID = @notificationId AND UserID = @userId
    `;

    const result = await executeQuery(query, {
      notificationId: Number.parseInt(notificationId),
      userId
    });

    if (result.rowsAffected[0] === 0) {
      return errorResponse(res, 'Notification not found', 404);
    }

    return successResponse(res, { message: 'Notification marked as read' });
  } catch (error) {
    return errorResponse(res, 'Failed to mark notification as read', 500, error);
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      UPDATE Notifications 
      SET IsRead = 1, ReadAt = GETUTCDATE()
      WHERE UserID = @userId AND IsRead = 0
    `;

    await executeQuery(query, { userId });

    return successResponse(res, { message: 'All notifications marked as read' });
  } catch (error) {
    return errorResponse(res, 'Failed to mark all notifications as read', 500, error);
  }
});

/**
 * DELETE /api/notifications/:notificationId
 * Delete a notification
 */
router.delete('/:notificationId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId!;

    const query = `
      DELETE FROM Notifications 
      WHERE NotificationID = @notificationId AND UserID = @userId
    `;

    const result = await executeQuery(query, {
      notificationId: Number.parseInt(notificationId),
      userId
    });

    if (result.rowsAffected[0] === 0) {
      return errorResponse(res, 'Notification not found', 404);
    }

    return successResponse(res, { message: 'Notification deleted' });
  } catch (error) {
    return errorResponse(res, 'Failed to delete notification', 500, error);
  }
});

/**
 * DELETE /api/notifications/clear-read
 * Clear all read notifications
 */
router.delete('/clear-read', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      DELETE FROM Notifications 
      WHERE UserID = @userId AND IsRead = 1
    `;

    await executeQuery(query, { userId });

    return successResponse(res, { message: 'Read notifications cleared' });
  } catch (error) {
    return errorResponse(res, 'Failed to clear read notifications', 500, error);
  }
});

/**
 * POST /api/notifications/preferences
 * Update notification preferences
 */
router.post('/preferences', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      emailNotifications,
      pushNotifications,
      smsNotifications,
      tradingAlerts,
      newsAlerts,
      socialAlerts,
      systemAlerts
    } = req.body;

    // Check if preferences exist
    const checkQuery = `
      SELECT UserID FROM NotificationPreferences WHERE UserID = @userId
    `;

    const checkResult = await executeQuery(checkQuery, { userId });

    if (checkResult.recordset.length === 0) {
      // Create new preferences
      await executeQuery(`
        INSERT INTO NotificationPreferences (
          UserID, EmailNotifications, PushNotifications, SMSNotifications,
          TradingAlerts, NewsAlerts, SocialAlerts, SystemAlerts
        ) VALUES (@userId, @emailNotifications, @pushNotifications, @smsNotifications,
                  @tradingAlerts, @newsAlerts, @socialAlerts, @systemAlerts)
      `, {
        userId,
        emailNotifications: emailNotifications ? 1 : 0,
        pushNotifications: pushNotifications ? 1 : 0,
        smsNotifications: smsNotifications ? 1 : 0,
        tradingAlerts: tradingAlerts ? 1 : 0,
        newsAlerts: newsAlerts ? 1 : 0,
        socialAlerts: socialAlerts ? 1 : 0,
        systemAlerts: systemAlerts ? 1 : 0
      });
    } else {
      // Update existing preferences
      await executeQuery(`
        UPDATE NotificationPreferences SET
          EmailNotifications = @emailNotifications,
          PushNotifications = @pushNotifications,
          SMSNotifications = @smsNotifications,
          TradingAlerts = @tradingAlerts,
          NewsAlerts = @newsAlerts,
          SocialAlerts = @socialAlerts,
          SystemAlerts = @systemAlerts,
          UpdatedAt = GETUTCDATE()
        WHERE UserID = @userId
      `, {
        userId,
        emailNotifications: emailNotifications ? 1 : 0,
        pushNotifications: pushNotifications ? 1 : 0,
        smsNotifications: smsNotifications ? 1 : 0,
        tradingAlerts: tradingAlerts ? 1 : 0,
        newsAlerts: newsAlerts ? 1 : 0,
        socialAlerts: socialAlerts ? 1 : 0,
        systemAlerts: systemAlerts ? 1 : 0
      });
    }

    return successResponse(res, { message: 'Notification preferences updated' });
  } catch (error) {
    return errorResponse(res, 'Failed to update notification preferences', 500, error);
  }
});

/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
router.get('/preferences', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT 
        EmailNotifications,
        PushNotifications,
        SMSNotifications,
        TradingAlerts,
        NewsAlerts,
        SocialAlerts,
        SystemAlerts,
        CreatedAt,
        UpdatedAt
      FROM NotificationPreferences
      WHERE UserID = @userId
    `;

    const result = await executeQuery(query, { userId });

    if (result.recordset.length === 0) {
      // Return default preferences
      return successResponse(res, {
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        tradingAlerts: true,
        newsAlerts: true,
        socialAlerts: true,
        systemAlerts: true
      });
    }

    const preferences = result.recordset[0] as {
      EmailNotifications?: number;
      PushNotifications?: number;
      SMSNotifications?: number;
      TradingAlerts?: number;
      NewsAlerts?: number;
      SocialAlerts?: number;
      SystemAlerts?: number;
      CreatedAt?: string;
      UpdatedAt?: string;
    };
    return successResponse(res, {
      emailNotifications: preferences.EmailNotifications === 1,
      pushNotifications: preferences.PushNotifications === 1,
      smsNotifications: preferences.SMSNotifications === 1,
      tradingAlerts: preferences.TradingAlerts === 1,
      newsAlerts: preferences.NewsAlerts === 1,
      socialAlerts: preferences.SocialAlerts === 1,
      systemAlerts: preferences.SystemAlerts === 1,
      createdAt: preferences.CreatedAt,
      updatedAt: preferences.UpdatedAt
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch notification preferences', 500, error);
  }
});

/**
 * POST /api/notifications/send
 * Send a notification (admin only)
 */
router.post('/send', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      targetUserId,
      type,
      title,
      message,
      data,
      priority = 'medium',
      expiresAt
    } = req.body;

    // Check if user has admin privileges (simplified check)
    const adminQuery = `
      SELECT Tier FROM UserProfiles WHERE UserID = @userId
    `;

    const adminResult = await executeQuery(adminQuery, { userId });

    const adminData = adminResult.recordset[0] as { Tier?: string } | undefined;
    if (adminResult.recordset.length === 0 || adminData?.Tier !== 'admin') {
      return errorResponse(res, 'Unauthorized to send notifications', 403);
    }

    if (!targetUserId || !type || !title || !message) {
      return errorResponse(res, 'Missing required fields', 400);
    }

    await executeQuery(`
      INSERT INTO Notifications (
        UserID, Type, Title, Message, Data, Priority, ExpiresAt, CreatedAt
      ) VALUES (@targetUserId, @type, @title, @message, @data, @priority, @expiresAt, GETUTCDATE())
    `, {
      targetUserId: Number.parseInt(targetUserId),
      type,
      title,
      message,
      data: data ? JSON.stringify(data) : null,
      priority,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    return successResponse(res, { message: 'Notification sent successfully' });
  } catch (error) {
    return errorResponse(res, 'Failed to send notification', 500, error);
  }
});

export default router;
