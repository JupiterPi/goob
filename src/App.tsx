"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useConvexAuth,
  useMutation,
} from "convex/react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/clerk-react";
import Home from "./Home";
import { useEffect } from "react";
import { api } from "../convex/_generated/api";
import { BrowserRouter, Route, Routes } from "react-router";
import { GoalPage } from "./goals";
import { FriendPage } from "./friends";
import { CompleteCommitmentsPage } from "./commitments";

export default function App() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const storeUser = useMutation(api.functions.storeUser);
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    async function storeCurrentUser() {
      await storeUser();
    }
    storeCurrentUser();
  }, [isAuthenticated, storeUser, user?.id]);

  return (
    <>
      <header className="sticky top-0 z-10 bg-amber-300 p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row items-center">
        <a href="/" className="text-lg font-semibold">GOOB</a>
        <div className="flex-1"></div>
        <a href="https://github.com/JupiterPi/goob" target="_blank" rel="noopener noreferrer" className="me-4">
          <img src="/github.svg" alt="GitHub" className="inline size-6" />
        </a>
        <UserButton />
      </header>
      <main className="p-8">
        <Authenticated>
          <BrowserRouter>
            <Routes>
              <Route index element={<Home />} />
              <Route path="goal/:goalId" element={<GoalPage />} />
              <Route path="friend/:friendId" element={<FriendPage />} />
              <Route path="complete/:key" element={<CompleteCommitmentsPage />} />
            </Routes>
          </BrowserRouter>
        </Authenticated>
        <Unauthenticated>
          <SignInForm />
        </Unauthenticated>
        <AuthLoading>
          Loading...
          {/* todo: loading spinner */}
        </AuthLoading>
      </main>
    </>
  );
}

function SignInForm() {
  return (
    <div className="flex flex-col gap-5 mx-auto">
      <p>Log in now to GET OUT OF BED!</p>
      <SignInButton mode="modal">
        <button className="bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2 cursor-pointer hover:bg-amber-300">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2 cursor-pointer hover:bg-amber-300">
          Sign up
        </button>
      </SignUpButton>
    </div>
  );
}

export function BackButton() {
  return (
    <div className="flex items-start">
      <button
        className="mb-4"
        onClick={() => {
          window.history.back();
        }}
      >
        &lt; Back
      </button>
    </div>
  );
}
