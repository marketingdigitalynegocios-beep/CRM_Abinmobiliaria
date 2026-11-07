"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "../../../lib/auth/client";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type LoginInput = z.infer<typeof loginSchema>;

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "mb-1 block text-sm font-medium text-dark";
const errorClass = "mt-1 text-xs text-danger";

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sendingMagicLink, setSendingMagicLink] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setServerError(null);
    setSubmitting(true);
    try {
      const { error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });
      if (error) {
        setServerError(error.message ?? "No se pudo iniciar sesión");
        return;
      }
      window.location.href = "/dashboard";
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMagicLink() {
    const email = getValues("email");
    if (!email) {
      setServerError("Escribe tu email arriba para recibir el enlace");
      return;
    }
    setServerError(null);
    setSendingMagicLink(true);
    try {
      const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/dashboard" });
      if (error) {
        setServerError(error.message ?? "No se pudo enviar el enlace");
        return;
      }
      setMagicLinkSent(true);
    } finally {
      setSendingMagicLink(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Inicia sesión</h1>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input className={inputClass} id="email" type="email" {...register("email")} />
          {errors.email && <p className={errorClass}>{errors.email.message}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="password">
            Contraseña
          </label>
          <input className={inputClass} id="password" type="password" {...register("password")} />
          {errors.password && <p className={errorClass}>{errors.password.message}</p>}
        </div>

        {serverError && <p className="text-sm text-danger">{serverError}</p>}

        <button
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <div className="mt-4 text-center">
        {magicLinkSent ? (
          <p className="text-sm text-success">Revisa tu email, te enviamos un enlace para ingresar.</p>
        ) : (
          <button
            className="text-sm font-medium text-primary disabled:opacity-60"
            disabled={sendingMagicLink}
            onClick={handleMagicLink}
            type="button"
          >
            {sendingMagicLink ? "Enviando..." : "O ingresa sin contraseña (enlace por email)"}
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-gray">
        ¿No tienes cuenta? <a className="font-medium text-primary" href="/register">Regístrate</a>
      </p>
    </div>
  );
}
