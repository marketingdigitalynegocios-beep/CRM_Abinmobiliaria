"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "../../../lib/validations/agency";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";
const errorClass = "mt-1 text-xs text-danger";

export default function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterInput) {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        setServerError(body.error ?? body.message ?? "No se pudo crear la cuenta");
        return;
      }
      window.location.href = "/dashboard";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Crea tu cuenta</h1>
      <p className="mt-1 text-sm text-gray">
        Registra tu inmobiliaria y empieza a publicar propiedades hoy mismo.
      </p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className={labelClass} htmlFor="agencyName">
            Nombre de la inmobiliaria
          </label>
          <input className={inputClass} id="agencyName" {...register("agencyName")} />
          {errors.agencyName && <p className={errorClass}>{errors.agencyName.message}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="slug">
            Slug (tuapp.com/<strong>slug</strong>)
          </label>
          <input className={inputClass} id="slug" placeholder="mi-inmobiliaria" {...register("slug")} />
          {errors.slug && <p className={errorClass}>{errors.slug.message}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="fullName">
            Tu nombre
          </label>
          <input className={inputClass} id="fullName" {...register("fullName")} />
          {errors.fullName && <p className={errorClass}>{errors.fullName.message}</p>}
        </div>

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
          {submitting ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray">
        ¿Ya tienes cuenta? <a className="font-medium text-primary" href="/login">Inicia sesión</a>
      </p>
    </div>
  );
}
