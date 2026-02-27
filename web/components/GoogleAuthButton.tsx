"use client";

import { GoogleLogin } from "@react-oauth/google";

interface GoogleAuthButtonProps {
  isLogin: boolean;
  onSuccess: (credential: string) => void;
  onError: () => void;
  disabled: boolean;
}

export default function GoogleAuthButton({ isLogin, onSuccess, onError, disabled }: GoogleAuthButtonProps) {
  if (disabled) {
    return (
      <div className="w-full flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-6 py-3 opacity-50">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {isLogin ? "Sign in with Google" : "Sign up with Google"}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full [&>div]:w-full [&_iframe]:w-full">
      <GoogleLogin
        onSuccess={(response) => {
          if (response.credential) {
            onSuccess(response.credential);
          } else {
            onError();
          }
        }}
        onError={onError}
        text={isLogin ? "signin_with" : "signup_with"}
        width="400"
        theme="outline"
        size="large"
      />
    </div>
  );
}
