import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SubmitButton from '../components/ui/SubmitButton';
import { useToast } from '../context/ToastContext';
export default function AdminLogin() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  if (user) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password, rememberMe);
      toast.success('Welcome back!');
      navigate('/admin');
    } catch (err) {
      const msg = err.response?.status === 401 ? 'Invalid email or password' : 'Sign in failed. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-aegean-500 px-4">
      <form onSubmit={handleSubmit} className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl">
        <h1 className="font-serif text-3xl text-aegean-800 text-center mb-2">Admin Login</h1>
        <p className="text-center text-aegean-600 text-sm mb-8">Caza Buena Management</p>
        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded-lg px-4 py-3 mb-4"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border rounded-lg px-4 py-3 mb-4"
        />
        <label className="flex items-center gap-2 mb-6 text-sm text-aegean-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="rounded border-aegean-300 text-aegean-600 focus:ring-aegean-400"
          />
          Remember me
        </label>
        <SubmitButton loading={loading} loadingLabel="Signing in..." className="w-full">
          Sign In
        </SubmitButton>
      </form>
    </div>
  );
}
