import { useEffect, useState } from 'react';
import { KeyRound, Plus, Settings, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import AdminModal from '../components/admin/AdminModal';
import AdminTableShell from '../components/ui/AdminTableShell';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

const emptyAccountForm = () => ({
  name: '',
  email: '',
  password: '',
  role: 'admin',
});

function FieldLabel({ children, required }) {
  return (
    <span className="block text-sm font-medium text-aegean-700 mb-1.5">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );
}

export default function AdminSettings() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [accountError, setAccountError] = useState('');

  const loadAccounts = () =>
    api
      .get('/auth/admins')
      .then((r) => setAccounts(r.data))
      .catch((e) => setError(getApiError(e)))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadAccounts();
  }, []);

  const openPasswordModal = () => {
    setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    setPasswordError('');
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    setPasswordError('');
  };

  const openAccountModal = () => {
    setAccountForm(emptyAccountForm());
    setAccountError('');
    setAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setAccountModalOpen(false);
    setAccountForm(emptyAccountForm());
    setAccountError('');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordForm.new_password.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New passwords do not match.');
      return;
    }

    const ok = await confirm({
      title: 'Change your password?',
      message: 'You will stay signed in with your current session.',
      confirmLabel: 'Yes, update password',
    });
    if (!ok) return;

    setPasswordSubmitting(true);
    try {
      await api.patch('/auth/me/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success('Password updated.');
      closePasswordModal();
    } catch (err) {
      const msg = getApiError(err);
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setAccountError('');

    if (accountForm.password.length < 8) {
      setAccountError('Password must be at least 8 characters.');
      return;
    }

    const ok = await confirm({
      title: 'Create admin account?',
      message: `${accountForm.email.trim()} will be able to sign in to the admin panel.`,
      confirmLabel: 'Yes, create account',
    });
    if (!ok) return;

    setAccountSubmitting(true);
    try {
      await api.post('/auth/admins', {
        name: accountForm.name.trim(),
        email: accountForm.email.trim(),
        password: accountForm.password,
        role: accountForm.role,
      });
      toast.success('Admin account created.');
      closeAccountModal();
      setLoading(true);
      loadAccounts();
    } catch (err) {
      const msg = getApiError(err);
      setAccountError(msg);
      toast.error(msg);
    } finally {
      setAccountSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl text-aegean-800 flex items-center gap-2">
          <Settings size={28} className="shrink-0" />
          Settings
        </h1>
        <p className="text-sm text-aegean-600 mt-1">Manage your login and admin panel access.</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>
      )}

      <section className="bg-white rounded-2xl border border-aegean-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-medium text-aegean-800 flex items-center gap-2">
              <KeyRound size={18} />
              Your password
            </h2>
            <p className="text-sm text-aegean-600 mt-1">
              Signed in as <span className="font-medium">{user?.email}</span>
            </p>
          </div>
          <button type="button" onClick={openPasswordModal} className="btn-primary text-sm py-2 px-4 shrink-0">
            Change password
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-aegean-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="font-medium text-aegean-800 flex items-center gap-2">
              <UserPlus size={18} />
              Admin accounts
            </h2>
            <p className="text-sm text-aegean-600 mt-1">People who can sign in to this admin panel.</p>
          </div>
          <button type="button" onClick={openAccountModal} className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2 shrink-0">
            <Plus size={16} />
            Add account
          </button>
        </div>

        <div className="lg:hidden space-y-3">
          {accounts.map((account) => (
            <div key={account.id} className="border border-aegean-100 rounded-xl p-4 text-sm">
              <p className="font-medium text-aegean-800">{account.name}</p>
              <p className="text-aegean-600 mt-1">{account.email}</p>
              <p className="text-xs text-aegean-500 mt-2 capitalize">
                {account.role} · Added {format(new Date(account.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          ))}
        </div>

        <AdminTableShell minWidth="640px">
          <thead>
            <tr className="text-left text-aegean-600 border-b border-aegean-100">
              <th className="pb-3 pr-4 font-medium">Name</th>
              <th className="pb-3 pr-4 font-medium">Email</th>
              <th className="pb-3 pr-4 font-medium">Role</th>
              <th className="pb-3 font-medium">Added</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-b border-aegean-50 last:border-0">
                <td className="py-3 pr-4 text-aegean-800">{account.name}</td>
                <td className="py-3 pr-4 text-aegean-700">{account.email}</td>
                <td className="py-3 pr-4 capitalize text-aegean-600">{account.role}</td>
                <td className="py-3 text-aegean-500">
                  {format(new Date(account.created_at), 'MMM d, yyyy')}
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTableShell>

        {accounts.length === 0 && (
          <p className="text-sm text-aegean-500 text-center py-6">No admin accounts found.</p>
        )}
      </section>

      <AdminModal
        open={passwordModalOpen}
        onClose={closePasswordModal}
        title="Change password"
        description="Enter your current password, then choose a new one (at least 8 characters)."
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          <div>
            <FieldLabel required>Current password</FieldLabel>
            <input
              type="password"
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))}
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel required>New password</FieldLabel>
            <input
              type="password"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel required>Confirm new password</FieldLabel>
            <input
              type="password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm((f) => ({ ...f, confirm_password: e.target.value }))}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div className="flex flex-wrap gap-3 justify-end pt-2">
            <button type="button" onClick={closePasswordModal} className="btn-outline text-sm py-2 px-4">
              Cancel
            </button>
            <SubmitButton loading={passwordSubmitting} loadingLabel="Saving...">
              Update password
            </SubmitButton>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={accountModalOpen}
        onClose={closeAccountModal}
        title="Add admin account"
        description="Create a new login for the admin panel. Share the password securely with the new user."
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          {accountError && <p className="text-sm text-red-600">{accountError}</p>}
          <div>
            <FieldLabel required>Name</FieldLabel>
            <input
              type="text"
              value={accountForm.name}
              onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
              required
              maxLength={100}
              className={inputClass}
              placeholder="e.g. Front Desk"
            />
          </div>
          <div>
            <FieldLabel required>Email</FieldLabel>
            <input
              type="email"
              value={accountForm.email}
              onChange={(e) => setAccountForm((f) => ({ ...f, email: e.target.value }))}
              required
              className={inputClass}
              placeholder="admin@cazabuena.com"
            />
          </div>
          <div>
            <FieldLabel required>Password</FieldLabel>
            <input
              type="password"
              value={accountForm.password}
              onChange={(e) => setAccountForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <select
              value={accountForm.role}
              onChange={(e) => setAccountForm((f) => ({ ...f, role: e.target.value }))}
              className={inputClass}
            >
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-3 justify-end pt-2">
            <button type="button" onClick={closeAccountModal} className="btn-outline text-sm py-2 px-4">
              Cancel
            </button>
            <SubmitButton loading={accountSubmitting} loadingLabel="Creating...">
              Create account
            </SubmitButton>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
