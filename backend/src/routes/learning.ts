/**
 * Learning Routes
 * Handles learning topics, lessons, and progress tracking
 */

import express from 'express';
import { executeQuery, executeProcedure } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';

const router = express.Router();

// Type definitions for learning results
interface LessonRecord {
  LessonID: number;
  TopicID: number;
  XPReward: number;
  CoinReward: number;
  Title?: string;
  TopicTitle?: string;
  Content?: string;
  Duration?: number;
}

interface ProgressRecord {
  IsCompleted?: boolean;
  CompletedAt?: Date;
  ProgressPercentage?: number;
  LastAccessedAt?: Date;
  TotalTopics?: number;
  CompletedTopics?: number;
  TotalLessons?: number;
  CompletedLessons?: number;
}

interface UserProfileRecord {
  Tier?: string;
  TotalXP?: number;
}

interface TopicRecord {
  TopicID: number;
  XPReward: number;
  CoinReward: number;
  Title?: string;
}

interface CountResult {
  CompletedCount?: number;
  TotalCount?: number;
}

/**
 * GET /api/learning/topics
 * Get all learning topics with user progress
 */
router.get('/topics', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT 
        t.TopicID,
        t.Title,
        t.Description,
        t.Icon,
        t.Difficulty,
        t.EstimatedDuration,
        t.XPReward,
        t.CoinReward,
        COALESCE(up.IsCompleted, 0) as IsCompleted,
        COALESCE(up.CompletedAt, NULL) as CompletedAt,
        COALESCE(up.CurrentLesson, 0) as CurrentLesson,
        COALESCE(up.Progress, 0) as Progress
      FROM LearningTopics t
      LEFT JOIN UserLearningProgress up ON t.TopicID = up.TopicID AND up.UserID = @userId
      WHERE t.IsActive = 1
      ORDER BY t.OrderIndex, t.Title
    `;

    const result = await executeQuery(query, { userId });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch learning topics', 500, error);
  }
});

/**
 * GET /api/learning/topic/:id
 * Get specific topic with lessons
 */
router.get('/topic/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const topicId = req.params.id;

    // Get topic details
    const topicQuery = `
      SELECT 
        t.*,
        COALESCE(up.IsCompleted, 0) as IsCompleted,
        COALESCE(up.CurrentLesson, 0) as CurrentLesson,
        COALESCE(up.Progress, 0) as Progress
      FROM LearningTopics t
      LEFT JOIN UserLearningProgress up ON t.TopicID = up.TopicID AND up.UserID = @userId
      WHERE t.TopicID = @topicId
    `;

    const topicResult = await executeQuery(topicQuery, { userId, topicId });

    if (topicResult.recordset.length === 0) {
      return errorResponse(res, 'Topic not found', 404);
    }

    // Get lessons for this topic
    const lessonsQuery = `
      SELECT 
        l.LessonID,
        l.Title,
        l.Content,
        l.LessonType,
        l.OrderIndex,
        l.XPReward,
        l.CoinReward,
        COALESCE(ul.IsCompleted, 0) as IsCompleted,
        COALESCE(ul.CompletedAt, NULL) as CompletedAt
      FROM LearningLessons l
      LEFT JOIN UserLessonProgress ul ON l.LessonID = ul.LessonID AND ul.UserID = @userId
      WHERE l.TopicID = @topicId AND l.IsActive = 1
      ORDER BY l.OrderIndex
    `;

    const lessonsResult = await executeQuery(lessonsQuery, { userId, topicId });

    return successResponse(res, {
      topic: topicResult.recordset[0],
      lessons: lessonsResult.recordset,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch topic details', 500, error);
  }
});

/**
 * POST /api/learning/complete-lesson
 * Mark lesson as completed and award XP/coins
 */
router.post('/complete-lesson', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { lessonId } = req.body;

    if (!lessonId) {
      return errorResponse(res, 'Lesson ID is required', 400);
    }

    // Get lesson details
    const lessonQuery = `
      SELECT 
        l.*,
        t.Title as TopicTitle
      FROM LearningLessons l
      INNER JOIN LearningTopics t ON l.TopicID = t.TopicID
      WHERE l.LessonID = @lessonId
    `;

    const lessonResult = await executeQuery(lessonQuery, { lessonId });

    if (lessonResult.recordset.length === 0) {
      return errorResponse(res, 'Lesson not found', 404);
    }

    const lesson = lessonResult.recordset[0] as LessonRecord;

    // Check if already completed
    const existingProgress = await executeQuery(
      'SELECT * FROM UserLessonProgress WHERE UserID = @userId AND LessonID = @lessonId',
      { userId, lessonId }
    );

    if (existingProgress.recordset.length > 0) {
      return errorResponse(res, 'Lesson already completed', 400);
    }

    // Award XP and coins
    if (lesson.XPReward > 0) {
      await executeProcedure('sp_UpdateUserXP', {
        UserID: userId,
        XPToAdd: lesson.XPReward,
      });
    }

    if (lesson.CoinReward > 0) {
      await executeProcedure('sp_UpdateUserCoins', {
        UserID: userId,
        CoinsToAdd: lesson.CoinReward,
      });
    }

    // Mark lesson as completed
    await executeQuery(
      'INSERT INTO UserLessonProgress (UserID, LessonID, IsCompleted, CompletedAt) VALUES (@userId, @lessonId, 1, GETUTCDATE())',
      { userId, lessonId }
    );

    // Update topic progress
    await executeProcedure('sp_UpdateTopicProgress', {
      UserID: userId,
      TopicID: lesson.TopicID,
    });

    return successResponse(res, {
      message: 'Lesson completed successfully',
      rewards: {
        xp: lesson.XPReward,
        coins: lesson.CoinReward,
      },
      lesson: {
        id: lesson.LessonID,
        title: lesson.Title,
        topicTitle: lesson.TopicTitle,
      },
    });
  } catch (error) {
    return errorResponse(res, 'Failed to complete lesson', 500, error);
  }
});

/**
 * POST /api/learning/complete-topic
 * Mark topic as completed and award bonus XP/coins
 */
router.post('/complete-topic', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { topicId } = req.body;

    if (!topicId) {
      return errorResponse(res, 'Topic ID is required', 400);
    }

    // Get topic details
    const topicQuery = `
      SELECT * FROM LearningTopics WHERE TopicID = @topicId
    `;

    const topicResult = await executeQuery(topicQuery, { topicId });

    if (topicResult.recordset.length === 0) {
      return errorResponse(res, 'Topic not found', 404);
    }

    const topicRecord = topicResult.recordset[0] as TopicRecord;

    // Check if all lessons are completed
    const completedLessonsQuery = `
      SELECT COUNT(*) as CompletedCount
      FROM UserLessonProgress ulp
      INNER JOIN LearningLessons l ON ulp.LessonID = l.LessonID
      WHERE ulp.UserID = @userId AND l.TopicID = @topicId AND ulp.IsCompleted = 1
    `;

    const totalLessonsQuery = `
      SELECT COUNT(*) as TotalCount
      FROM LearningLessons
      WHERE TopicID = @topicId AND IsActive = 1
    `;

    const [completedResult, totalResult] = await Promise.all([
      executeQuery(completedLessonsQuery, { userId, topicId }),
      executeQuery(totalLessonsQuery, { topicId }),
    ]);

    const completedCount = (completedResult.recordset[0] as CountResult).CompletedCount || 0;
    const totalCount = (totalResult.recordset[0] as CountResult).TotalCount || 0;

    if (completedCount < totalCount) {
      return errorResponse(res, 'All lessons must be completed before completing the topic', 400);
    }

    // Check if topic already completed
    const existingProgress = await executeQuery(
      'SELECT * FROM UserLearningProgress WHERE UserID = @userId AND TopicID = @topicId',
      { userId, topicId }
    );

    if (existingProgress.recordset.length > 0 && (existingProgress.recordset[0] as { IsCompleted: boolean }).IsCompleted) {
      return errorResponse(res, 'Topic already completed', 400);
    }

    // Award topic completion bonus
    if (topicRecord.XPReward > 0) {
      await executeProcedure('sp_UpdateUserXP', {
        UserID: userId,
        XPToAdd: topicRecord.XPReward,
      });
    }

    if (topicRecord.CoinReward > 0) {
      await executeProcedure('sp_UpdateUserCoins', {
        UserID: userId,
        CoinsToAdd: topicRecord.CoinReward,
      });
    }

    // Mark topic as completed
    if (existingProgress.recordset.length > 0) {
      await executeQuery(
        'UPDATE UserLearningProgress SET IsCompleted = 1, CompletedAt = GETUTCDATE() WHERE UserID = @userId AND TopicID = @topicId',
        { userId, topicId }
      );
    } else {
      await executeQuery(
        'INSERT INTO UserLearningProgress (UserID, TopicID, IsCompleted, CompletedAt) VALUES (@userId, @topicId, 1, GETUTCDATE())',
        { userId, topicId }
      );
    }

    // Check for topic completion achievements
    await executeProcedure('sp_CheckTopicAchievements', {
      UserID: userId,
      TopicID: topicId,
    });

    return successResponse(res, {
      message: 'Topic completed successfully',
      rewards: {
        xp: topicRecord.XPReward,
        coins: topicRecord.CoinReward,
      },
      topic: {
        id: topicRecord.TopicID,
        title: topicRecord.Title,
      },
    });
  } catch (error) {
    return errorResponse(res, 'Failed to complete topic', 500, error);
  }
});

/**
 * GET /api/learning/progress
 * Get user's overall learning progress
 */
router.get('/progress', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT 
        COUNT(DISTINCT t.TopicID) as TotalTopics,
        COUNT(DISTINCT CASE WHEN up.IsCompleted = 1 THEN t.TopicID END) as CompletedTopics,
        COUNT(DISTINCT l.LessonID) as TotalLessons,
        COUNT(DISTINCT ulp.LessonID) as CompletedLessons,
        SUM(CASE WHEN up.IsCompleted = 1 THEN t.XPReward ELSE 0 END) as TotalXPEarned,
        SUM(CASE WHEN up.IsCompleted = 1 THEN t.CoinReward ELSE 0 END) as TotalCoinsEarned
      FROM LearningTopics t
      LEFT JOIN UserLearningProgress up ON t.TopicID = up.TopicID AND up.UserID = @userId
      LEFT JOIN LearningLessons l ON t.TopicID = l.TopicID AND l.IsActive = 1
      LEFT JOIN UserLessonProgress ulp ON l.LessonID = ulp.LessonID AND ulp.UserID = @userId AND ulp.IsCompleted = 1
      WHERE t.IsActive = 1
    `;

    const result = await executeQuery(query, { userId });
    const progress = result.recordset[0] as ProgressRecord;

    // Calculate completion percentage
    const totalTopics = progress.TotalTopics || 0;
    const completedTopics = progress.CompletedTopics || 0;
    const totalLessons = progress.TotalLessons || 0;
    const completedLessons = progress.CompletedLessons || 0;
    
    const topicCompletionRate = totalTopics > 0 
      ? Math.round((completedTopics / totalTopics) * 100) 
      : 0;
    
    const lessonCompletionRate = totalLessons > 0 
      ? Math.round((completedLessons / totalLessons) * 100) 
      : 0;

    return successResponse(res, {
      totalTopics,
      completedTopics,
      totalLessons,
      completedLessons,
      topicCompletionRate,
      lessonCompletionRate,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch learning progress', 500, error);
  }
});

/**
 * GET /api/learning/recommendations
 * Get personalized learning recommendations
 */
router.get('/recommendations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Get user's completed topics to avoid duplicates
    const completedTopicsQuery = `
      SELECT TopicID FROM UserLearningProgress 
      WHERE UserID = @userId AND IsCompleted = 1
    `;

    const completedResult = await executeQuery(completedTopicsQuery, { userId });
    const completedTopicIds = completedResult.recordset.map((row: any) => row.TopicID);

    // Get user's tier and interests for personalized recommendations
    const userQuery = `
      SELECT up.Tier, up.InterestAreas
      FROM UserProfiles up
      WHERE up.UserID = @userId
    `;

    const userResult = await executeQuery(userQuery, { userId });
    const userProfile = userResult.recordset[0] as UserProfileRecord;

    // Get recommended topics based on user profile
    let recommendationsQuery = `
      SELECT TOP 5
        t.TopicID,
        t.Title,
        t.Description,
        t.Icon,
        t.Difficulty,
        t.EstimatedDuration,
        t.XPReward,
        t.CoinReward
      FROM LearningTopics t
      WHERE t.IsActive = 1
    `;

    // Filter out completed topics
    if (completedTopicIds.length > 0) {
      recommendationsQuery += ` AND t.TopicID NOT IN (${completedTopicIds.map((id: any) => `'${id}'`).join(',')})`;
    }

    // Add tier-based filtering
    if (userProfile?.Tier === 'beginner') {
      recommendationsQuery += ` AND t.Difficulty IN ('beginner', 'intermediate')`;
    } else if (userProfile?.Tier === 'advanced') {
      recommendationsQuery += ` AND t.Difficulty IN ('intermediate', 'advanced')`;
    }

    recommendationsQuery += ` ORDER BY t.OrderIndex, t.Title`;

    const recommendationsResult = await executeQuery(recommendationsQuery, { userId });

    return successResponse(res, {
      recommendations: recommendationsResult.recordset,
      userProfile: {
        tier: userProfile?.Tier || 'beginner',
        completedTopics: completedTopicIds.length,
      },
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch learning recommendations', 500, error);
  }
});

export default router;
