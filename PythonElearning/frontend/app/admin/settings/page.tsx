"use client";

import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck
} from 'lucide-react';

type Provider = '' | 'openai' | 'gemini';
type SystemSettings = {
  provider: Provider;
  model: string;
  apiKeyConfigured: boolean;
  prompt: string;
  updatedAt: string | null;
  encryptionConfigured: boolean;
};
type SettingsForm = {
  provider: Provider;
  model: string;
  apiKey: string;
  prompt: string;
};
type ApiResponse<T> = { success: boolean; message?: string; data: T };

const emptyForm: SettingsForm = { provider: '', model: '', apiKey: '', prompt: '' };

async function adminRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');

  const response = await fetch(`http://localhost:5000/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: ['Bearer', token].join(' '),
      ...init?.headers
    }
  });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Không thể hoàn tất yêu cầu cấu hình.');
  }
  return payload;
}

function formFromSettings(settings: SystemSettings): SettingsForm {
  return {
    provider: settings.provider,
    model: settings.model,
    apiKey: '',
    prompt: settings.prompt
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadSettings = async () => {
      try {
        const result = await adminRequest<SystemSettings>('/settings', { signal: controller.signal });
        setSettings(result.data);
        setForm(formFromSettings(result.data));
        setError('');
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error('Lỗi tải cấu hình hệ thống:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải cấu hình hệ thống.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadSettings();
    return () => controller.abort();
  }, [refreshKey]);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const result = await adminRequest<SystemSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(form)
      });
      setSettings(result.data);
      setForm(formFromSettings(result.data));
      setNotice(result.message || 'Đã lưu cấu hình.');
    } catch (saveError) {
      console.error('Lỗi lưu cấu hình hệ thống:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu cấu hình hệ thống.');
    } finally {
      setSaving(false);
    }
  };

  const cancelChanges = () => {
    if (settings) setForm(formFromSettings(settings));
    setError('');
    setNotice('');
    setShowApiKey(false);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Admin&nbsp; › &nbsp;Settings</p>
          <h1 className="text-2xl font-bold text-gray-900">Thiết lập hệ thống</h1>
          <p className="mt-1 text-sm text-gray-500">Quản lý cấu hình AI Lộ trình và trạng thái các nhóm thiết lập khác.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError('');
            setNotice('');
            setRefreshKey((key) => key + 1);
          }}
          disabled={loading || saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </header>

      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <Check size={17} /> {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {!settings?.encryptionConfigured && (
        <section aria-label="Thiết lập khóa mã hóa" className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-amber-950">Cần cấu hình khóa mã hóa trên máy chủ</h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                API Key sẽ chỉ được lưu sau khi backend có biến môi trường <code className="rounded bg-amber-100 px-1 py-0.5">SYSTEM_SETTINGS_ENCRYPTION_KEY</code> gồm 64 ký tự hex.
                Tạo khóa cục bộ bằng lệnh dưới đây, thêm kết quả vào <code className="rounded bg-amber-100 px-1 py-0.5">backend/.env</code>, rồi khởi động lại backend.
              </p>
              <code className="mt-3 block overflow-x-auto rounded-lg border border-amber-200 bg-white/80 p-3 text-xs text-gray-700">
                node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
              </code>
              <p className="mt-2 text-xs leading-5 text-amber-800">
                Chỉ tạo khóa mới khi chưa có tệp cấu hình được lưu. Nếu tệp đã tồn tại, hãy khôi phục khóa cũ thay vì tạo khóa khác. Không chia sẻ khóa; nếu mất khóa, backend không thể giải mã API Key đã lưu.
              </p>
            </div>
          </div>
        </section>
      )}

      {loading && !settings ? (
        <div className="flex min-h-48 items-center justify-center text-sm font-medium text-gray-500">
          <span className="flex items-center gap-2"><RefreshCw size={16} className="animate-spin" /> Đang tải cấu hình...</span>
        </div>
      ) : (
        <>
          <form onSubmit={(event) => void saveSettings(event)} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-5 sm:px-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Bot size={20} /></span>
              <div>
                <h2 className="font-bold text-gray-900">AI Lộ trình học tập</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">Cấu hình nhà cung cấp, model, API Key và prompt mẫu theo đặc tả UC3.3.</p>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600">
                  Nhà cung cấp AI
                  <select
                    value={form.provider}
                    onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as Provider }))}
                    required
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="" disabled>Chọn nhà cung cấp</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600">
                  Model
                  <input
                    value={form.model}
                    onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                    required
                    maxLength={150}
                    placeholder="Nhập model đã được cấp quyền"
                    className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="font-normal text-gray-400">Nhập đúng tên model của nhà cung cấp; hệ thống không tự chọn model.</span>
                </label>
              </div>

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600">
                API Key
                <span className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.apiKey}
                    onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
                    required={!settings?.apiKeyConfigured}
                    maxLength={2048}
                    placeholder={settings?.apiKeyConfigured ? 'Đã lưu — nhập giá trị mới để thay thế' : 'Nhập API Key'}
                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-3 pr-11 text-sm font-normal text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((visible) => !visible)}
                    aria-label={showApiKey ? 'Ẩn API Key' : 'Hiện API Key'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700"
                  >
                    {showApiKey ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
                <span className="font-normal text-gray-400">
                  {settings?.apiKeyConfigured
                    ? 'Để trống nếu giữ nguyên key hiện tại. Giá trị đã lưu không được gửi về trình duyệt.'
                    : 'Key được mã hóa AES-256-GCM trước khi ghi vào tệp cấu hình trên máy chủ.'}
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600">
                Prompt mẫu
                <textarea
                  value={form.prompt}
                  onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
                  required
                  maxLength={20000}
                  rows={9}
                  placeholder="Nhập prompt mẫu cho AI Lộ trình"
                  className="resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal leading-6 text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <span className="text-right font-normal text-gray-400">{form.prompt.length.toLocaleString('vi-VN')} / 20.000 ký tự</span>
              </label>

              {settings?.updatedAt && (
                <p className="text-xs text-gray-400">
                  Lưu lần cuối: {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(settings.updatedAt))}
                </p>
              )}

              <div className="flex flex-col-reverse justify-between gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center">
                <p className="flex items-center gap-1.5 text-xs text-gray-500"><LockKeyhole size={14} /> API Key được mã hóa khi lưu trên máy chủ.</p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelChanges}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Hủy thay đổi
                  </button>
                  <button
                    type="submit"
                    disabled={saving || loading || !settings?.encryptionConfigured}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                  </button>
                </div>
              </div>
            </div>
          </form>

          <section className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-5">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-blue-700" />
            <div>
              <h2 className="text-sm font-bold text-blue-950">Lưu cấu hình chưa đồng nghĩa với tích hợp AI</h2>
              <p className="mt-1 text-sm leading-6 text-blue-900">
                Backend hiện chưa có client gọi OpenAI/Gemini. Trang này lưu cấu hình an toàn; việc kiểm tra API Key và áp dụng cấu hình vào tạo lộ trình cần phần tích hợp AI riêng. Không có yêu cầu AI nào được gửi từ thao tác lưu.
              </p>
            </div>
          </section>

          <section aria-label="Các nhóm thiết lập chưa hỗ trợ" className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700"><Settings2 size={17} /> Thông báo</div>
              <p className="mt-2 text-sm text-gray-500">Chưa hỗ trợ cấu hình chung. Đặc tả chưa xác định các trường và hành vi cụ thể.</p>
            </article>
            <article className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700"><LockKeyhole size={17} /> Sao lưu / phục hồi</div>
              <p className="mt-2 text-sm text-gray-500">Tạm bỏ qua theo yêu cầu; trang không tạo backup hoặc thay đổi dữ liệu SQL Server.</p>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
