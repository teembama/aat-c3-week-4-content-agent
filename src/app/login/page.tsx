"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [authLoading, user, router]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Signed in.");
      router.replace("/");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setNotice(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        toast.error(error.message);
        return;
      }

      const newUser = data.user;
      if (newUser) {
        const displayName = email.trim().split("@")[0];
        const { error: profileErr } = await supabase.from("user_profiles").insert({
          id: newUser.id,
          email: email.trim(),
          display_name: displayName,
          role: "creator",
        });
        if (profileErr) {
          // Non-fatal — the account exists either way; surface it for visibility.
          toast.error(`Signed up, but couldn't create profile: ${profileErr.message}`);
        }
      }

      if (data.session) {
        toast.success("Account created.");
        router.replace("/");
      } else {
        setNotice("Account created — check your email to confirm, then sign in.");
        setMode("signin");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#e1dbd7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-[#d1cbc6] rounded-xl p-6 shadow-sm">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-[#1a1a1a]">Koya Content Lab</h1>
          <p className="text-xs text-[#8a847f] mt-1">Sign in to manage your content pipeline.</p>
        </div>

        <div className="flex mb-5 rounded-lg bg-[#e8e3df] p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
              mode === "signin" ? "bg-white text-[#1f1823] shadow-sm" : "text-[#5a5550]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
              mode === "signup" ? "bg-white text-[#1f1823] shadow-sm" : "text-[#5a5550]"
            }`}
          >
            Sign Up
          </button>
        </div>

        {notice && (
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-800">
            {notice}
          </div>
        )}

        <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#d1cbc6] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1823] focus:border-transparent"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#d1cbc6] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1823] focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2.5 bg-[#1f1823] text-white text-sm font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50 transition-colors"
          >
            {submitting ? "Please wait…" : mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
