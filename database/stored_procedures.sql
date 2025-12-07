-- WealthArena Stored Procedures
-- Missing stored procedures referenced by backend routes
-- Execute this script against Azure SQL Database after deploying users_tables.sql

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Drop existing procedures if they exist
IF OBJECT_ID('sp_CreateUser', 'P') IS NOT NULL DROP PROCEDURE sp_CreateUser;
GO
IF OBJECT_ID('sp_UpdateUserXP', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateUserXP;
GO
IF OBJECT_ID('sp_UpdateUserCoins', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateUserCoins;
GO
IF OBJECT_ID('sp_UpdateLeaderboard', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateLeaderboard;
GO
IF OBJECT_ID('sp_JoinCompetition', 'P') IS NOT NULL DROP PROCEDURE sp_JoinCompetition;
GO

-- =============================================
-- 1. sp_CreateUser
-- Creates a new user and user profile
-- Referenced in: auth.ts line 51
-- =============================================
CREATE PROCEDURE sp_CreateUser
    @Email NVARCHAR(255),
    @PasswordHash NVARCHAR(255),
    @Username NVARCHAR(100),
    @FirstName NVARCHAR(100) = NULL,
    @LastName NVARCHAR(100) = NULL,
    @DisplayName NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Insert into Users table
        INSERT INTO Users (Email, Username, PasswordHash, FirstName, LastName, IsActive, CreatedAt, UpdatedAt)
        VALUES (@Email, @Username, @PasswordHash, @FirstName, @LastName, 1, GETUTCDATE(), GETUTCDATE());
        
        -- Get the newly created UserID
        DECLARE @UserID INT = SCOPE_IDENTITY();
        
        -- Insert into UserProfiles table with default values
        INSERT INTO UserProfiles (
            UserID, DisplayName, Tier, TotalXP, CurrentLevel, TotalCoins,
            WinRate, TotalTrades, CurrentStreak, HasCompletedOnboarding,
            CreatedAt, UpdatedAt
        )
        VALUES (
            @UserID,
            ISNULL(@DisplayName, @Username),
            'beginner',
            0,
            1,
            0,
            0.0,
            0,
            0,
            0,
            GETUTCDATE(),
            GETUTCDATE()
        );
        
        -- Return the UserID
        SELECT @UserID AS UserID;
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO

-- =============================================
-- 2. sp_UpdateUserXP
-- Updates user XP and calculates new level
-- Referenced in: user.ts line 163, game.ts line 196
-- =============================================
CREATE PROCEDURE sp_UpdateUserXP
    @UserID INT,
    @XPToAdd INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate XP amount
        IF @XPToAdd <= 0
        BEGIN
            RAISERROR('XP amount must be greater than 0', 16, 1);
            RETURN;
        END
        
        -- Update TotalXP
        UPDATE UserProfiles
        SET TotalXP = TotalXP + @XPToAdd,
            UpdatedAt = GETUTCDATE()
        WHERE UserID = @UserID;
        
        -- Get current XP and calculate new level
        DECLARE @TotalXP INT;
        DECLARE @CurrentLevel INT;
        DECLARE @NewLevel INT;
        DECLARE @LevelUp BIT = 0;
        
        SELECT @TotalXP = TotalXP, @CurrentLevel = CurrentLevel
        FROM UserProfiles
        WHERE UserID = @UserID;
        
        -- Calculate new level based on XP thresholds
        -- Level 1: 0-99 XP
        -- Level 2: 100-299 XP
        -- Level 3: 300-599 XP
        -- Level 4: 600-999 XP
        -- Level 5+: 1000+ XP (formula: FLOOR(TotalXP / 200) + 1)
        IF @TotalXP < 100
            SET @NewLevel = 1;
        ELSE IF @TotalXP < 300
            SET @NewLevel = 2;
        ELSE IF @TotalXP < 600
            SET @NewLevel = 3;
        ELSE IF @TotalXP < 1000
            SET @NewLevel = 4;
        ELSE
            SET @NewLevel = FLOOR(@TotalXP / 200.0) + 1;
        
        -- Check if level increased
        IF @NewLevel > @CurrentLevel
        BEGIN
            SET @LevelUp = 1;
            UPDATE UserProfiles
            SET CurrentLevel = @NewLevel
            WHERE UserID = @UserID;
        END
        
        -- Return updated values
        SELECT @TotalXP AS TotalXP, @NewLevel AS CurrentLevel, @LevelUp AS LevelUp;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO

-- =============================================
-- 3. sp_UpdateUserCoins
-- Updates user coins balance
-- Referenced in: user.ts line 187, game.ts line 201
-- =============================================
CREATE PROCEDURE sp_UpdateUserCoins
    @UserID INT,
    @CoinsToAdd INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validate coin amount (allow negative for deductions)
        IF @CoinsToAdd = 0
        BEGIN
            RAISERROR('Coin amount cannot be 0', 16, 1);
            RETURN;
        END
        
        -- Update TotalCoins
        UPDATE UserProfiles
        SET TotalCoins = TotalCoins + @CoinsToAdd,
            UpdatedAt = GETUTCDATE()
        WHERE UserID = @UserID;
        
        -- Return updated TotalCoins
        DECLARE @TotalCoins INT;
        SELECT @TotalCoins = TotalCoins
        FROM UserProfiles
        WHERE UserID = @UserID;
        
        SELECT @TotalCoins AS TotalCoins;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO

-- =============================================
-- 4. sp_UpdateLeaderboard
-- Updates user leaderboard entry with performance metrics
-- Referenced in: game.ts line 221
-- =============================================
CREATE PROCEDURE sp_UpdateLeaderboard
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Convert UserID to NVARCHAR for compatibility with portfolios.user_id
        DECLARE @UserIDStr NVARCHAR(50) = CAST(@UserID AS NVARCHAR(50));
        
        -- Calculate performance metrics from portfolios and trades
        DECLARE @TotalReturns DECIMAL(18,6) = 0;
        DECLARE @WinRate DECIMAL(18,6) = 0;
        DECLARE @TotalTrades INT = 0;
        DECLARE @ProfitFactor DECIMAL(18,6) = 0;
        DECLARE @SharpeRatio DECIMAL(18,6) = 0;
        DECLARE @MaxDrawdown DECIMAL(18,6) = 0;
        DECLARE @CurrentStreak INT = 0;
        DECLARE @PortfolioID BIGINT = NULL;
        
        -- Get user's active portfolio
        SELECT TOP 1
            @PortfolioID = id,
            @TotalReturns = ISNULL(total_return, 0),
            @SharpeRatio = ISNULL(sharpe_ratio, 0),
            @MaxDrawdown = ISNULL(max_drawdown_actual, 0),
            @WinRate = ISNULL(win_rate, 0),
            @ProfitFactor = ISNULL(profit_factor, 0)
        FROM portfolios
        WHERE user_id = @UserIDStr AND is_active = 1
        ORDER BY updated_at DESC;
        
        -- Calculate trade statistics
        IF @PortfolioID IS NOT NULL
        BEGIN
            SELECT 
                @TotalTrades = COUNT(*),
                @WinRate = CASE 
                    WHEN COUNT(*) > 0 THEN 
                        COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) * 100.0 / COUNT(*)
                    ELSE 0
                END
            FROM trades
            WHERE portfolio_id = @PortfolioID AND realized_pnl IS NOT NULL;
            
            -- Calculate profit factor
            DECLARE @TotalProfit DECIMAL(18,2) = 0;
            DECLARE @TotalLoss DECIMAL(18,2) = 0;
            
            SELECT 
                @TotalProfit = ISNULL(SUM(CASE WHEN realized_pnl > 0 THEN realized_pnl ELSE 0 END), 0),
                @TotalLoss = ISNULL(ABS(SUM(CASE WHEN realized_pnl < 0 THEN realized_pnl ELSE 0 END)), 0)
            FROM trades
            WHERE portfolio_id = @PortfolioID AND realized_pnl IS NOT NULL;
            
            IF @TotalLoss > 0
                SET @ProfitFactor = @TotalProfit / @TotalLoss;
            
            -- Calculate current streak (consecutive winning trades)
            SELECT @CurrentStreak = COUNT(*)
            FROM (
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY trade_date DESC) as rn,
                    realized_pnl
                FROM trades
                WHERE portfolio_id = @PortfolioID 
                    AND realized_pnl IS NOT NULL
                    AND trade_date >= DATEADD(day, -30, GETUTCDATE())
            ) ranked
            WHERE rn <= (SELECT COUNT(*) FROM trades WHERE portfolio_id = @PortfolioID AND realized_pnl > 0)
                AND realized_pnl > 0;
        END
        
        -- Update or insert into leaderboard_entries
        IF EXISTS (SELECT 1 FROM leaderboard_entries WHERE user_id = @UserIDStr AND portfolio_id = @PortfolioID)
        BEGIN
            UPDATE leaderboard_entries
            SET 
                total_return = @TotalReturns,
                sharpe_ratio = @SharpeRatio,
                max_drawdown = @MaxDrawdown,
                win_rate = @WinRate,
                profit_factor = @ProfitFactor,
                updated_at = GETUTCDATE()
            WHERE user_id = @UserIDStr AND portfolio_id = @PortfolioID;
        END
        ELSE IF @PortfolioID IS NOT NULL
        BEGIN
            INSERT INTO leaderboard_entries (
                user_id, portfolio_id, total_return, sharpe_ratio, max_drawdown,
                win_rate, profit_factor, period_start, period_end, asset_class,
                created_at, updated_at
            )
            VALUES (
                @UserIDStr, @PortfolioID, @TotalReturns, @SharpeRatio, @MaxDrawdown,
                @WinRate, @ProfitFactor, DATEADD(month, -1, GETUTCDATE()), GETUTCDATE(), 'stocks',
                GETUTCDATE(), GETUTCDATE()
            );
        END
        
        -- Calculate overall rank
        UPDATE le
        SET overall_rank = ranked.rank
        FROM leaderboard_entries le
        INNER JOIN (
            SELECT 
                id,
                ROW_NUMBER() OVER (ORDER BY total_return DESC) as rank
            FROM leaderboard_entries
            WHERE period_end >= DATEADD(month, -1, GETUTCDATE())
        ) ranked ON le.id = ranked.id
        WHERE le.user_id = @UserIDStr AND le.portfolio_id = @PortfolioID;
        
        -- Update UserProfiles with latest metrics
        UPDATE UserProfiles
        SET 
            WinRate = @WinRate,
            TotalTrades = @TotalTrades,
            CurrentStreak = @CurrentStreak,
            UpdatedAt = GETUTCDATE()
        WHERE UserID = @UserID;
        
        -- Return success status
        SELECT 1 AS Success, 'Leaderboard updated successfully' AS Message;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO

-- =============================================
-- 5. sp_JoinCompetition
-- Joins a user to a competition
-- Referenced in: leaderboard.ts line 292
-- =============================================
CREATE PROCEDURE sp_JoinCompetition
    @CompetitionID INT,
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Verify competition exists and is active
        DECLARE @CompetitionStatus NVARCHAR(20);
        DECLARE @MaxParticipants INT;
        DECLARE @CurrentParticipants INT;
        DECLARE @EntryFee INT;
        
        SELECT 
            @CompetitionStatus = Status,
            @MaxParticipants = MaxParticipants,
            @CurrentParticipants = CurrentParticipants,
            @EntryFee = EntryFee
        FROM Competitions
        WHERE CompetitionID = @CompetitionID;
        
        IF @CompetitionStatus IS NULL
        BEGIN
            SELECT -1 AS ResultCode, 'Competition not found' AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        IF @CompetitionStatus != 'active'
        BEGIN
            SELECT -1 AS ResultCode, 'Competition is not active' AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        -- Check if competition has available slots
        IF @CurrentParticipants >= @MaxParticipants
        BEGIN
            SELECT -2 AS ResultCode, 'Competition is full' AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        -- Check if user is already participating
        IF EXISTS (SELECT 1 FROM CompetitionParticipants WHERE CompetitionID = @CompetitionID AND UserID = @UserID)
        BEGIN
            SELECT -3 AS ResultCode, 'User is already participating in this competition' AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        -- Check if user has enough coins for entry fee
        IF @EntryFee > 0
        BEGIN
            DECLARE @UserCoins INT;
            SELECT @UserCoins = TotalCoins FROM UserProfiles WHERE UserID = @UserID;
            
            IF @UserCoins < @EntryFee
            BEGIN
                SELECT -4 AS ResultCode, 'Insufficient coins for entry fee' AS Message;
                ROLLBACK TRANSACTION;
                RETURN;
            END
            
            -- Deduct entry fee
            UPDATE UserProfiles
            SET TotalCoins = TotalCoins - @EntryFee
            WHERE UserID = @UserID;
        END
        
        -- Insert into CompetitionParticipants with initial metrics (all zeros)
        INSERT INTO CompetitionParticipants (
            CompetitionID, UserID, TotalReturns, WinRate, TotalTrades,
            ProfitFactor, SharpeRatio, MaxDrawdown, CurrentStreak, TotalXP,
            LastUpdated
        )
        VALUES (
            @CompetitionID, @UserID, 0, 0, 0,
            0, 0, 0, 0, 0,
            GETUTCDATE()
        );
        
        -- Update Competitions table
        UPDATE Competitions
        SET CurrentParticipants = CurrentParticipants + 1
        WHERE CompetitionID = @CompetitionID;
        
        -- Return success with competition details
        SELECT 
            0 AS ResultCode,
            'Successfully joined competition' AS Message,
            @CompetitionID AS CompetitionID,
            @MaxParticipants AS MaxParticipants,
            @CurrentParticipants + 1 AS CurrentParticipants;
        
        COMMIT TRANSACTION;
        
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO

PRINT 'WealthArena stored procedures created successfully!';
PRINT 'Procedures created: sp_CreateUser, sp_UpdateUserXP, sp_UpdateUserCoins, sp_UpdateLeaderboard, sp_JoinCompetition';

