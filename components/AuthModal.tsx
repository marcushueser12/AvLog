import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { signIn, signUp } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (isSignUp && !acceptedTerms) {
      setError('You must accept the Terms of Service to create an account.');
      return;
    }
    
    setLoading(true);

    try {
      const result = isSignUp ? await signUp(email, password) : await signIn(email, password);
      
      if (result.error) {
        // Handle specific error messages
        if (result.error.message.includes('email not confirmed') || result.error.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link to verify your account before signing in.');
        } else {
          setError(result.error.message);
        }
      } else {
        // Success - auth context will update automatically
        if (isSignUp) {
          // Show success message for signup
          setError(null);
          alert('Account created! Please check your email to confirm your account before signing in.');
        }
        onClose();
        setEmail('');
        setPassword('');
        setAcceptedTerms(false);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="bg-white/90 backdrop-blur-md border border-[#E2E8F0] rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-[#003366]">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <button
            onClick={onClose}
            className="text-[#003366]/60 hover:text-[#003366] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-[#003366]/70 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl text-[#003366] placeholder-[#003366]/40 focus:outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-[#003366]/70 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl text-[#003366] placeholder-[#003366]/40 focus:outline-none focus:ring-2 focus:ring-[#007BFF] focus:border-[#007BFF]"
              placeholder="••••••••"
            />
          </div>

          {isSignUp && (
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms-checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 w-4 h-4 text-[#007BFF] bg-white border-[#E2E8F0] rounded focus:ring-[#007BFF] focus:ring-2"
              />
              <label htmlFor="terms-checkbox" className="text-xs text-[#003366]/70 cursor-pointer">
                I agree to the{' '}
                <a href="/TERMS_OF_SERVICE.md" target="_blank" rel="noopener noreferrer" className="text-[#007BFF] hover:underline">
                  Terms of Service
                </a>
                {' '}and{' '}
                <a href="/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" className="text-[#007BFF] hover:underline">
                  Privacy Policy
                </a>
                . I acknowledge that I am responsible for verifying the accuracy of all AI-generated flight data.
              </label>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (isSignUp && !acceptedTerms)}
            className="w-full px-6 py-3 bg-[#003366] hover:bg-[#003366]/90 disabled:bg-[#003366]/50 text-white rounded-xl font-bold transition-all shadow-lg shadow-[#003366]/20 disabled:cursor-not-allowed shiny-button"
          >
            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-sm text-[#003366]/70 hover:text-[#007BFF] transition-colors"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
