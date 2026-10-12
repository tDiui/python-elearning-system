const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const settingsFile = path.resolve(__dirname, '../../data/system-settings.enc');
const backupFile = `${settingsFile}.previous`;
const providers = ['openai', 'gemini'];

const emptySettings = () => ({
  provider: '',
  model: '',
  apiKey: '',
  prompt: '',
  updatedAt: null
});

const getEncryptionKey = () => {
  const value = process.env.SYSTEM_SETTINGS_ENCRYPTION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(value)) return null;
  return Buffer.from(value, 'hex');
};

const encryptSettings = (settings, key) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(settings), 'utf8'),
    cipher.final()
  ]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
};

const decryptSettings = (value, key) => {
  const [version, ivHex, tagHex, encryptedHex] = value.split(':');
  if (version !== 'v1' || !ivHex || !tagHex || !encryptedHex) {
    throw new Error('Tệp cấu hình hệ thống không đúng định dạng.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]).toString('utf8');
  const parsed = JSON.parse(decrypted);

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !providers.includes(parsed.provider) ||
    typeof parsed.model !== 'string' ||
    typeof parsed.apiKey !== 'string' ||
    typeof parsed.prompt !== 'string'
  ) {
    throw new Error('Nội dung cấu hình hệ thống không hợp lệ.');
  }
  return parsed;
};

const readSettings = async (key) => {
  try {
    const encrypted = await fs.readFile(settingsFile, 'utf8');
    return decryptSettings(encrypted, key);
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        const encryptedBackup = await fs.readFile(backupFile, 'utf8');
        return decryptSettings(encryptedBackup, key);
      } catch (backupError) {
        if (backupError.code === 'ENOENT') return emptySettings();
        throw backupError;
      }
    }
    throw error;
  }
};

const writeSettings = async (settings, key) => {
  const directory = path.dirname(settingsFile);
  await fs.mkdir(directory, { recursive: true });

  const temporaryFile = `${settingsFile}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temporaryFile, encryptSettings(settings, key), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600
    });
    try {
      await fs.rename(temporaryFile, settingsFile);
    } catch (error) {
      if (!['EPERM', 'EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;

      await fs.rm(backupFile, { force: true });
      try {
        await fs.rename(settingsFile, backupFile);
      } catch (moveError) {
        if (moveError.code !== 'ENOENT') throw moveError;
      }

      try {
        await fs.rename(temporaryFile, settingsFile);
      } catch (replaceError) {
        try {
          await fs.rename(backupFile, settingsFile);
        } catch (restoreError) {
          console.error('Không thể khôi phục tệp cấu hình trước đó:', restoreError);
          throw new Error('Không thể thay thế hoặc khôi phục tệp cấu hình. Giữ nguyên tệp .previous để phục hồi.');
        }
        throw replaceError;
      }
      await fs.rm(backupFile, { force: true });
    }
  } finally {
    await fs.rm(temporaryFile, { force: true });
  }
};

const publicSettings = (settings, encryptionConfigured) => ({
  provider: settings.provider,
  model: settings.model,
  apiKeyConfigured: Boolean(settings.apiKey),
  prompt: settings.prompt,
  updatedAt: settings.updatedAt,
  encryptionConfigured
});

const getSystemSettings = async (req, res) => {
  const key = getEncryptionKey();
  try {
    if (!key) {
      try {
        await fs.access(settingsFile);
        return res.status(503).json({
          success: false,
          message: 'Thiếu SYSTEM_SETTINGS_ENCRYPTION_KEY hoặc khóa không hợp lệ; không thể mở cấu hình đã lưu.'
        });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      return res.json({
        success: true,
        data: publicSettings(emptySettings(), false)
      });
    }

    const settings = await readSettings(key);
    return res.json({
      success: true,
      data: publicSettings(settings, true)
    });
  } catch (error) {
    console.error('Không thể đọc cấu hình hệ thống:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể đọc cấu hình hệ thống. Kiểm tra khóa mã hóa và tệp cấu hình.'
    });
  }
};

const updateSystemSettings = async (req, res) => {
  const key = getEncryptionKey();
  if (!key) {
    return res.status(503).json({
      success: false,
      message: 'Chưa cấu hình SYSTEM_SETTINGS_ENCRYPTION_KEY hợp lệ trong backend .env.'
    });
  }

  try {
    const { provider, model, apiKey, prompt } = req.body || {};
    if (!providers.includes(provider)) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn OpenAI hoặc Gemini.' });
    }
    if (typeof model !== 'string' || !model.trim() || model.trim().length > 150) {
      return res.status(400).json({ success: false, message: 'Tên model là bắt buộc và tối đa 150 ký tự.' });
    }
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 20000) {
      return res.status(400).json({ success: false, message: 'Prompt là bắt buộc và tối đa 20.000 ký tự.' });
    }
    if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 2048)) {
      return res.status(400).json({ success: false, message: 'API Key không hợp lệ.' });
    }
    const current = await readSettings(key);
    const nextApiKey = typeof apiKey === 'string' && apiKey.length > 0
      ? apiKey
      : current.apiKey;

    if (!nextApiKey) {
      return res.status(400).json({ success: false, message: 'Cần nhập API Key trước khi lưu cấu hình AI.' });
    }

    const settings = {
      provider,
      model: model.trim(),
      apiKey: nextApiKey,
      prompt,
      updatedAt: new Date().toISOString()
    };

    await writeSettings(settings, key);
    return res.json({
      success: true,
      message: 'Đã lưu cấu hình mã hóa trên máy chủ.',
      data: publicSettings(settings, true)
    });
  } catch (error) {
    console.error('Không thể lưu cấu hình hệ thống:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lưu cấu hình hệ thống. Vui lòng kiểm tra quyền ghi và khóa mã hóa.'
    });
  }
};

module.exports = { getSystemSettings, updateSystemSettings };
