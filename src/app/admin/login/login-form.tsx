"use client";

import { useActionState, useId } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { signIn, type SignInState } from "@/server/actions/auth";
import ko from "../../../../messages/ko.json";

const t = ko.admin.login;

export function LoginForm({ notice }: { notice: string | null }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, null);
  const errorId = useId();

  const badCredentials = state?.error === "unauthorized" || state?.error === "invalid_input";
  const message = state ? (badCredentials ? t.errorInvalid : t.errorRetry) : notice;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field
        label={t.email}
        name="email"
        type="email"
        autoComplete="username"
        defaultValue={state?.email}
        invalid={badCredentials}
        describedBy={message ? errorId : undefined}
      />
      <Field
        label={t.password}
        name="password"
        type="password"
        autoComplete="current-password"
        invalid={badCredentials}
        describedBy={message ? errorId : undefined}
      />

      {message ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-label font-bold text-danger">
          <Icon name="alert-circle" size={16} />
          {message}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="h-12 w-full gap-2 rounded-ui-sm text-button-lg font-bold disabled:opacity-85"
      >
        {pending ? <Icon name="spinner" size={18} className="animate-spin" /> : null}
        {t.submit}
      </Button>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type: "email" | "password";
  autoComplete: string;
  defaultValue?: string;
  invalid: boolean;
  describedBy: string | undefined;
};

function Field({ label, name, type, autoComplete, defaultValue, invalid, describedBy }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-bold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 w-full rounded-ui-sm border-[1.5px] bg-surface px-3 text-body text-ink outline-none",
          "focus-visible:ring-3 focus-visible:ring-brand/30",
          invalid ? "border-danger" : "border-line-strong focus-visible:border-brand",
        )}
      />
    </div>
  );
}
