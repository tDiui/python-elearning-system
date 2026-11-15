const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { promisify } = require('util');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');

const execFileAsync = promisify(execFile);
const MAX_SLIDE_SIZE = 25 * 1024 * 1024;
const SLIDE_UPLOAD_DIR = process.env.LESSON_SLIDE_DIR
  ? path.resolve(process.env.LESSON_SLIDE_DIR)
  : path.join(__dirname, '..', 'uploads', 'lesson-slides');
const ALLOWED_EXTENSIONS = new Set(['.ppt', '.pptx']);

const getSlideExtension = (originalName = '') => path.extname(originalName).toLowerCase();

const hasValidSlideSignature = (buffer, extension) => {
  if (!Buffer.isBuffer(buffer)) return false;
  if (extension === '.pptx') return buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (extension === '.ppt') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  return false;
};

const getLessonSlidePath = (lessonId, asset, extension) => {
  if (!Number.isInteger(lessonId) || lessonId <= 0 || !/^[a-f0-9-]{36}\.(ppt|pptx)$/.test(asset)) {
    throw new Error('Tài liệu slide không hợp lệ.');
  }
  const expectedExtension = extension === 'pdf' ? '.pdf' : extension === 'original' ? '' : null;
  if (expectedExtension === null) throw new Error('Định dạng slide không hợp lệ.');
  return path.join(SLIDE_UPLOAD_DIR, `${lessonId}-${asset}${expectedExtension}`);
};

const createLessonSlide = async (lessonId, buffer, originalName) => {
  const extension = getSlideExtension(originalName);
  if (!ALLOWED_EXTENSIONS.has(extension) || !hasValidSlideSignature(buffer, extension)) {
    throw new Error('Chỉ chấp nhận tệp PowerPoint .ppt hoặc .pptx hợp lệ.');
  }
  if (buffer.length === 0 || buffer.length > MAX_SLIDE_SIZE) {
    throw new Error('Tệp slide phải có dung lượng tối đa 25 MB.');
  }

  const sofficePath = process.env.SOFFICE_PATH || 'soffice';
  const asset = `${crypto.randomUUID()}${extension}`;
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pylearn-slide-'));
  const inputPath = path.join(workDir, `input${extension}`);
  const profilePath = path.join(workDir, 'libreoffice-profile');
  const outputPath = path.join(workDir, 'input.pdf');

  try {
    await fs.promises.writeFile(inputPath, buffer, { flag: 'wx' });
    await fs.promises.mkdir(profilePath, { recursive: true });
    await execFileAsync(sofficePath, [
      '--headless',
      `-env:UserInstallation=${pathToFileURL(profilePath).toString()}`,
      '--convert-to',
      'pdf',
      '--outdir',
      workDir,
      inputPath
    ], { timeout: 60000, maxBuffer: 1024 * 1024 });

    const pdfStat = await fs.promises.stat(outputPath);
    if (!pdfStat.isFile() || pdfStat.size === 0) throw new Error('Không tạo được bản PDF từ tệp PowerPoint.');

    await fs.promises.mkdir(SLIDE_UPLOAD_DIR, { recursive: true });
    const originalFinalPath = getLessonSlidePath(lessonId, asset, 'original');
    const pdfFinalPath = getLessonSlidePath(lessonId, asset, 'pdf');
    const temporaryOriginal = `${originalFinalPath}.tmp`;
    const temporaryPdf = `${pdfFinalPath}.tmp`;
    await fs.promises.copyFile(inputPath, temporaryOriginal, fs.constants.COPYFILE_EXCL);
    try {
      await fs.promises.copyFile(outputPath, temporaryPdf, fs.constants.COPYFILE_EXCL);
      await fs.promises.rename(temporaryOriginal, originalFinalPath);
      await fs.promises.rename(temporaryPdf, pdfFinalPath);
    } catch (error) {
      await fs.promises.rm(temporaryOriginal, { force: true });
      await fs.promises.rm(temporaryPdf, { force: true });
      await fs.promises.rm(originalFinalPath, { force: true });
      throw error;
    }

    return {
      asset,
      slideUrl: `/api/student/lesson/${lessonId}/slides/pdf?asset=${encodeURIComponent(asset)}`,
      originalUrl: `/api/student/lesson/${lessonId}/slides/original?asset=${encodeURIComponent(asset)}`
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Máy chủ chưa cài LibreOffice hoặc chưa cấu hình SOFFICE_PATH.');
    }
    if (error.killed || error.signal === 'SIGTERM') {
      throw new Error('Chuyển đổi PowerPoint quá thời gian cho phép. Hãy thử tệp nhỏ hơn.');
    }
    throw error;
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
};

const removeLessonSlide = async (lessonId, asset) => {
  const originalPath = getLessonSlidePath(lessonId, asset, 'original');
  const pdfPath = getLessonSlidePath(lessonId, asset, 'pdf');
  await Promise.all([
    fs.promises.rm(originalPath, { force: true }),
    fs.promises.rm(pdfPath, { force: true })
  ]);
};

module.exports = {
  ALLOWED_EXTENSIONS,
  MAX_SLIDE_SIZE,
  SLIDE_UPLOAD_DIR,
  createLessonSlide,
  getLessonSlidePath,
  getSlideExtension,
  hasValidSlideSignature,
  removeLessonSlide
};
