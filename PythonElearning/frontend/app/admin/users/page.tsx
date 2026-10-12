"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  LockKeyhole,
  LockKeyholeOpen,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/Input';

type Role = { id: number; name: string };
type AdminUser = {
  id: number;
  fullName: string;
  email: string;
  studentId: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
};
type ApiResponse<T> = { success: boolean; message?: string; data: T };
type UserList = { users: AdminUser[]; roles: Role[] };
type UserForm = { fullName: string; email: string; studentId: string; roleId: string; password: string };

const initialForm: UserForm = { fullName: '', email: '', studentId: '', roleId: '', password: '' };
const normalizeRole = (role: string) => role
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');
const isStudentRoleName = (roleName: string) => ['student', 'sinh vien'].includes(normalizeRole(roleName));

const subscribeToUser = (callback: () => void) => {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
};

const getCurrentUserId = () => {
  const storedUser = localStorage.getItem('user');
  if (!storedUser) return '';
  try {
    const user = JSON.parse(storedUser) as { id?: number };
    return typeof user.id === 'number' ? String(user.id) : '';
  } catch {
    return '';
  }
};

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');

  const response = await fetch(`http://localhost:5000/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers
    }
  });
  const result = await response.json() as ApiResponse<T>;
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Không thể hoàn tất yêu cầu.');
  }
  return result;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const currentUserIdSnapshot = useSyncExternalStore(subscribeToUser, getCurrentUserId, () => '');
  const currentUserId = currentUserIdSnapshot ? Number(currentUserIdSnapshot) : null;

  useEffect(() => {
    let ignoreResult = false;
    adminRequest<UserList>('/users')
      .then((result) => {
        if (ignoreResult) return;
        setUsers(result.data.users);
        setRoles(result.data.roles);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (ignoreResult) return;
        const message = loadError instanceof Error ? loadError.message : 'Không thể tải danh sách người dùng.';
        setError(message);
        setLoading(false);
        if (message.includes('đăng nhập lại')) router.replace('/login');
      });
    return () => {
      ignoreResult = true;
    };
  }, [refreshKey, router]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const matchesSearch = !normalizedSearch || [
        user.fullName,
        user.email,
        isStudentRoleName(user.role.name) ? user.studentId || '' : '',
        user.role.name
      ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      const matchesRole = roleFilter === 'all' || String(user.role.id) === roleFilter;
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? user.isActive : !user.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const activeCount = users.filter((user) => user.isActive).length;
  const adminCount = users.filter((user) => adminRole(user.role.name)).length;

  function adminRole(roleName: string) {
    return ['admin', 'quan tri vien'].includes(normalizeRole(roleName));
  }

  function openCreateModal() {
    setEditingUser(null);
    setForm({ ...initialForm, roleId: roles[0] ? String(roles[0].id) : '' });
    setError('');
    setModalOpen(true);
  }

  function openEditModal(user: AdminUser) {
    setEditingUser(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      studentId: user.studentId || '',
      roleId: String(user.role.id),
      password: ''
    });
    setError('');
    setModalOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        fullName: form.fullName,
        email: form.email,
        roleId: Number(form.roleId),
        ...(isStudentRole ? { studentId: form.studentId } : {}),
        ...(editingUser ? {} : { password: form.password })
      };
      const result = await adminRequest<AdminUser>(
        editingUser ? `/users/${editingUser.id}` : '/users',
        {
          method: editingUser ? 'PUT' : 'POST',
          body: JSON.stringify(body)
        }
      );
      setNotice(result.message || (editingUser ? 'Đã cập nhật người dùng.' : 'Đã thêm người dùng.'));
      setModalOpen(false);
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu người dùng.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: AdminUser) {
    const action = user.isActive ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc muốn ${action} tài khoản "${user.fullName}" không?`)) return;

    setActionUserId(user.id);
    setError('');
    try {
      const result = await adminRequest<{ id: number; isActive: boolean }>(`/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive })
      });
      setNotice(result.message || `Đã ${action} tài khoản.`);
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không thể thay đổi trạng thái tài khoản.');
    } finally {
      setActionUserId(null);
    }
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Xóa tài khoản "${user.fullName}"? Thao tác này không thể hoàn tác.`)) return;

    setActionUserId(user.id);
    setError('');
    try {
      const result = await adminRequest<null>(`/users/${user.id}`, { method: 'DELETE' });
      setNotice(result.message || 'Đã xóa người dùng.');
      setLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa người dùng.');
    } finally {
      setActionUserId(null);
    }
  }

  const selectedRole = roles.find((role) => String(role.id) === form.roleId);
  const isStudentRole = selectedRole ? isStudentRoleName(selectedRole.name) : false;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng</h1>
          <p className="mt-1 text-sm text-gray-500">Quản lý tài khoản, trạng thái và phân quyền trong hệ thống.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          Thêm người dùng
        </button>
      </div>

      {notice && (
        <div role="status" className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {notice}
          <button type="button" onClick={() => setNotice('')} aria-label="Đóng thông báo">
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
          <button type="button" onClick={() => setError('')} aria-label="Đóng thông báo lỗi">
            <X size={16} />
          </button>
        </div>
      )}

      <section aria-label="Tổng quan người dùng" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Users size={21} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{users.length}</p><p className="text-xs font-semibold text-gray-500">Tổng người dùng</p></div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><GraduationCap size={22} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{activeCount}</p><p className="text-xs font-semibold text-gray-500">Tài khoản hoạt động</p></div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><ShieldCheck size={21} /></div>
          <div><p className="text-2xl font-bold text-gray-900">{adminCount}</p><p className="text-xs font-semibold text-gray-500">Tài khoản quản trị</p></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              aria-label="Tìm kiếm người dùng"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo họ tên, email, mã sinh viên hoặc vai trò..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <select
            aria-label="Lọc theo vai trò"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Tất cả vai trò</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <select
            aria-label="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã khóa</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-gray-500">Đang tải người dùng...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            {users.length ? 'Không tìm thấy người dùng phù hợp.' : 'Chưa có người dùng nào trong hệ thống.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Người dùng</th>
                  <th className="px-5 py-3.5 font-semibold">Mã sinh viên</th>
                  <th className="px-5 py-3.5 font-semibold">Vai trò</th>
                  <th className="px-5 py-3.5 font-semibold">Trạng thái</th>
                  <th className="px-5 py-3.5 font-semibold">Ngày tạo</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-gray-50/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{user.fullName}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{user.email}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {isStudentRoleName(user.role.name) ? user.studentId || '—' : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        adminRole(user.role.name) ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {user.role.name}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.isActive ? 'text-emerald-700' : 'text-gray-500'}`}>
                        <span className={`h-2 w-2 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {user.isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-gray-500">
                      {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(user.createdAt))}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => openEditModal(user)} title="Chỉnh sửa người dùng" aria-label={`Chỉnh sửa ${user.fullName}`} className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600">
                          <Pencil size={16} />
                        </button>
                        <button type="button" disabled={actionUserId === user.id} onClick={() => void toggleStatus(user)} title={user.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} aria-label={`${user.isActive ? 'Khóa' : 'Mở khóa'} ${user.fullName}`} className="rounded-lg p-2 text-gray-500 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50">
                          {user.isActive ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}
                        </button>
                        <button type="button" disabled={actionUserId === user.id || user.id === currentUserId} onClick={() => void deleteUser(user)} title={user.id === currentUserId ? 'Không thể xóa tài khoản đang đăng nhập' : 'Xóa người dùng'} aria-label={`Xóa ${user.fullName}`} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
          Hiển thị {filteredUsers.length} / {users.length} người dùng
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModalOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="user-form-title" className="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="user-form-title" className="text-xl font-bold text-gray-900">{editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng'}</h2>
                <p className="mt-1 text-sm text-gray-500">{editingUser ? 'Cập nhật thông tin và vai trò tài khoản.' : 'Tạo tài khoản mới trong hệ thống.'}</p>
              </div>
              <button type="button" disabled={saving} onClick={() => setModalOpen(false)} aria-label="Đóng biểu mẫu" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <Input label="Họ và tên" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} maxLength={100} required />
              <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={150} required />
              {isStudentRole && (
                <Input
                  label="Mã sinh viên"
                  value={form.studentId}
                  onChange={(event) => setForm({ ...form, studentId: event.target.value })}
                  maxLength={50}
                  required
                />
              )}
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Vai trò
                <select required value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
                  <option value="" disabled>Chọn vai trò</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </label>
              {!editingUser && (
                <Input label="Mật khẩu ban đầu" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={6} required />
              )}
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="mt-2 flex justify-end gap-3">
                <button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Hủy
                </button>
                <button type="submit" disabled={saving || roles.length === 0} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? 'Đang lưu...' : editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
