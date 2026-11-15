# Backend configuration

## Encrypted admin AI settings

The admin Settings page stores its AI provider, model, API key, and prompt in
`data/system-settings.enc`. The settings file is encrypted with
AES-256-GCM and is excluded from Git.

Before saving settings, add a `SYSTEM_SETTINGS_ENCRYPTION_KEY` value containing
64 hexadecimal characters to the backend `.env` file. Generate a key locally
with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep this key private and stable. If it is lost or changed, the backend cannot
decrypt the existing settings file. The current backend does not yet call
OpenAI or Gemini, so saving credentials here does not validate the key or apply
it to AI generation.

## Lesson publishing status

Lessons use `Status` (`Draft` or `Published`) and the existing
`DurationMinutes` field. Existing lessons are initialized as `Published`;
newly created lessons start as `Draft`. To add the status column to another
SQL Server database, run this idempotent script from the backend directory:

```powershell
.\node_modules\.bin\prisma.cmd db execute --file prisma\manual-updates\add_lesson_status.sql --schema prisma\schema.prisma
.\node_modules\.bin\prisma.cmd generate --schema prisma\schema.prisma
```

## Course question bank

The teacher question bank requires the `QuestionBankQuestions` table. Apply its
idempotent SQL Server script from the backend directory before using the
question-bank API:

```powershell
.\node_modules\.bin\prisma.cmd db execute --file prisma\manual-updates\add_question_bank.sql --schema prisma\schema.prisma
.\node_modules\.bin\prisma.cmd generate --schema prisma\schema.prisma
```
