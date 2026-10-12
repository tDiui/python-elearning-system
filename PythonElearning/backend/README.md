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
