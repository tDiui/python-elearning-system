IF OBJECT_ID(N'dbo.QuestionBankQuestions', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[QuestionBankQuestions] (
        [QuestionBankQuestionID] INT IDENTITY(1,1) NOT NULL,
        [CourseID] INT NOT NULL,
        [QuestionType] NVARCHAR(50) NOT NULL,
        [Content] NVARCHAR(MAX) NOT NULL,
        [Points] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_QuestionBankQuestions_Points] DEFAULT (1.00),
        [Explanation] NVARCHAR(MAX) NULL,
        [OptionsJSON] NVARCHAR(MAX) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_QuestionBankQuestions_CreatedAt] DEFAULT (SYSDATETIME()),
        [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_QuestionBankQuestions_UpdatedAt] DEFAULT (SYSDATETIME()),
        CONSTRAINT [PK_QuestionBankQuestions] PRIMARY KEY CLUSTERED ([QuestionBankQuestionID]),
        CONSTRAINT [FK_QuestionBankQuestions_Courses]
            FOREIGN KEY ([CourseID]) REFERENCES [dbo].[Courses] ([CourseID]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_QuestionBankQuestions_CourseID]
        ON [dbo].[QuestionBankQuestions] ([CourseID]);
END;
