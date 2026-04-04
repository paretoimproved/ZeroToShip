"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { GoogleIcon } from "@/components/icons";

interface GoogleAuthButtonProps {
  isLogin: boolean;
  onSuccess: (credential: string) => void;
  onError: () => void;
  disabled: boolean;
}

export default function GoogleAuthButton({ isLogin, onSuccess, onError, disabled }: GoogleAuthButtonProps) {
  const login = useGoogleLogin({
    flow: "auth-code",
    ux_mode: "redirect",
    redirect_uri: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
    onError: () => onError(),
  });

  return (
    <button
      type="button"
      onClick={() => login()}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50"
    >
      <GoogleIcon />
      {isLogin ? "Sign in with Google" : "Sign up with Google"}
    </button>
  );
}
