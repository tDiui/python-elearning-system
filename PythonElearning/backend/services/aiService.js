const { GoogleGenAI } = require('@google/genai');

// Hàm bóc tách JSON an toàn bằng Regex (Chống lỗi model nói lan man ngoài khối JSON)
const extractSafeJSON = (rawText) => {
  if (!rawText) throw new Error('Phản hồi từ AI trống');
  
  // Tìm vị trí của dấu { đầu tiên và dấu } cuối cùng
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Không tìm thấy cấu trúc JSON hợp lệ trong phản hồi');
  }
  
  const jsonString = rawText.substring(firstBrace, lastBrace + 1);
  return JSON.parse(jsonString);
};

// Hàm gọi AI đa nền tảng (Universal LLM Caller)
const callLLMProvider = async (promptText, options = {}) => {
  // Có thể truyền provider từ DB (UC3.3) hoặc lấy mặc định từ file .env
  const provider = options.provider || process.env.AI_PROVIDER || 'gemini'; // 'gemini' | 'openai'
  const startTime = Date.now();

  try {
    // ==========================================
    // NHÁNH 1: GOOGLE GEMINI
    // ==========================================
    if (provider === 'gemini') {
      const modelName = options.modelName || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: {
          temperature: 0.2, // Hạ nhiệt độ thấp để AI bớt "sáng tạo" lung tung, bám sát ID thật
          responseMimeType: 'application/json', // Ép trả về chuẩn MIME JSON
        }
      });

      const rawText = response.text;
      const parsedData = extractSafeJSON(rawText);

      return {
        success: true,
        provider: 'Google Gemini',
        modelName: modelName,
        rawResponse: rawText,
        parsedData: parsedData,
        promptTokens: response.usageMetadata?.promptTokenCount || null,
        completionTokens: response.usageMetadata?.candidatesTokenCount || null,
        processingTimeMs: Date.now() - startTime
      };
    }

    // ==========================================
    // NHÁNH 2: OPENAI / CHATGPT / DEEPSEEK / GROQ / OLLAMA
    // (Dùng fetch thuần của Node.js 18+, không cần cài thêm thư viện)
    // ==========================================
    if (provider === 'openai') {
      const apiUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
      const modelName = options.modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: 'Bạn là hệ thống gợi ý lộ trình học tập. Chỉ trả về duy nhất định dạng JSON hợp lệ.' },
            { role: 'user', content: promptText }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' } // Ép chuẩn JSON của OpenAI
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Lỗi khi gọi OpenAI API');
      }

      const rawText = result.choices?.[0]?.message?.content || '';
      const parsedData = extractSafeJSON(rawText);

      return {
        success: true,
        provider: 'OpenAI Compatible',
        modelName: modelName,
        rawResponse: rawText,
        parsedData: parsedData,
        promptTokens: result.usage?.prompt_tokens || null,
        completionTokens: result.usage?.completion_tokens || null,
        processingTimeMs: Date.now() - startTime
      };
    }

    throw new Error(`Provider '${provider}' chưa được hỗ trợ.`);

  } catch (error) {
    return {
      success: false,
      provider: provider,
      modelName: options.modelName || 'unknown',
      rawResponse: null,
      parsedData: null,
      errorMessage: error.message,
      processingTimeMs: Date.now() - startTime
    };
  }
};

module.exports = { callLLMProvider, extractSafeJSON };