IF COL_LENGTH('dbo.Lessons', 'Status') IS NULL
    EXEC(N'ALTER TABLE [dbo].[Lessons] ADD [Status] NVARCHAR(50) NULL');

EXEC(N'UPDATE [dbo].[Lessons] SET [Status] = N''Published'' WHERE [Status] IS NULL');

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Lessons')
      AND name = N'Status'
      AND is_nullable = 1
)
    EXEC(N'ALTER TABLE [dbo].[Lessons] ALTER COLUMN [Status] NVARCHAR(50) NOT NULL');

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.Lessons')
      AND name = N'DF_Lessons_Status'
)
    EXEC(N'ALTER TABLE [dbo].[Lessons] ADD CONSTRAINT [DF_Lessons_Status] DEFAULT (N''Draft'') FOR [Status]');
