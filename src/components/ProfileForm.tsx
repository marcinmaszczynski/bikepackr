import React, { useState } from "react";
import { User, Lock, KeyRound } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  displayName: string;
  successType?: "name" | "password";
  serverError?: string;
}

export default function ProfileForm({ displayName: initialDisplayName, successType, serverError }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [nameError, setNameError] = useState<string | undefined>();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});

  function handleNameSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!displayName.trim()) {
      e.preventDefault();
      setNameError("Nazwa nie może być pusta");
    }
  }

  function handlePasswordSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    const next: typeof passwordErrors = {};
    if (!currentPassword) next.current = "Wpisz obecne hasło";
    if (!newPassword) {
      next.new = "Wpisz nowe hasło";
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      next.new = `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków`;
    }
    if (!confirmNewPassword) {
      next.confirm = "Potwierdź nowe hasło";
    } else if (newPassword !== confirmNewPassword) {
      next.confirm = "Hasła nie są identyczne";
    }
    if (Object.keys(next).length > 0) {
      e.preventDefault();
      setPasswordErrors(next);
    }
  }

  return (
    <div className="space-y-8">
      <ServerError message={serverError} />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold">Nazwa wyświetlana</h2>
        {successType === "name" && (
          <p className="mb-4 rounded-lg border border-green-500/30 bg-green-900/30 px-3 py-2 text-sm text-green-300">
            Nazwa wyświetlana została zaktualizowana.
          </p>
        )}
        <form
          method="POST"
          action="/api/profile/update-name"
          className="space-y-4"
          onSubmit={handleNameSubmit}
          noValidate
        >
          <FormField
            id="display_name"
            label="Nazwa"
            value={displayName}
            onChange={(v) => {
              setDisplayName(v);
              if (nameError) setNameError(undefined);
            }}
            placeholder="Jak mamy Cię nazywać?"
            error={nameError}
            icon={<User className="size-4" />}
          />
          <SubmitButton pendingText="Zapisywanie..." icon={<User className="size-4" />}>
            Zapisz nazwę
          </SubmitButton>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold">Zmiana hasła</h2>
        {successType === "password" && (
          <p className="mb-4 rounded-lg border border-green-500/30 bg-green-900/30 px-3 py-2 text-sm text-green-300">
            Hasło zostało zmienione.
          </p>
        )}
        <form
          method="POST"
          action="/api/profile/change-password"
          className="space-y-4"
          onSubmit={handlePasswordSubmit}
          noValidate
        >
          <FormField
            id="current_password"
            label="Obecne hasło"
            type={showCurrentPassword ? "text" : "password"}
            value={currentPassword}
            onChange={(v) => {
              setCurrentPassword(v);
              if (passwordErrors.current) setPasswordErrors((p) => ({ ...p, current: undefined }));
            }}
            placeholder="Twoje obecne hasło"
            error={passwordErrors.current}
            icon={<Lock className="size-4" />}
            endContent={
              <PasswordToggle
                visible={showCurrentPassword}
                onToggle={() => {
                  setShowCurrentPassword((v) => !v);
                }}
              />
            }
          />
          <FormField
            id="new_password"
            label="Nowe hasło"
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
            onChange={(v) => {
              setNewPassword(v);
              if (passwordErrors.new) setPasswordErrors((p) => ({ ...p, new: undefined }));
            }}
            placeholder="Min. 6 znaków"
            error={passwordErrors.new}
            icon={<KeyRound className="size-4" />}
            endContent={
              <PasswordToggle
                visible={showNewPassword}
                onToggle={() => {
                  setShowNewPassword((v) => !v);
                }}
              />
            }
          />
          <FormField
            id="confirm_new_password"
            label="Potwierdź nowe hasło"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmNewPassword}
            onChange={(v) => {
              setConfirmNewPassword(v);
              if (passwordErrors.confirm) setPasswordErrors((p) => ({ ...p, confirm: undefined }));
            }}
            placeholder="Wpisz nowe hasło ponownie"
            error={passwordErrors.confirm}
            icon={<KeyRound className="size-4" />}
            endContent={
              <PasswordToggle
                visible={showConfirmPassword}
                onToggle={() => {
                  setShowConfirmPassword((v) => !v);
                }}
              />
            }
          />
          <SubmitButton pendingText="Zmienianie hasła..." icon={<Lock className="size-4" />}>
            Zmień hasło
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
